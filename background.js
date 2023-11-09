/* temporary container for each tab
Principle: each time a new tab is open, the extension close it quickly
and then open it in a new temporary container. When a tab is close we check
if there are container that are not used by any tabs and remove them.
*/


var colors = ["blue", "turquoise", "green", "yellow", "orange", "red", "pink", "purple"]
// ideally put this code in a separate script to be accessible by context.js too
class TabContainer {
  constructor() {
    this.counter = 0 // number of container open during session
  }

  getColor(a){ // return color from global 'colors' variable
    return colors[a % colors.length];
  }

  onError(e) {
    console.error(e);
  }

  createNew(url, active=true, pinned=false, index=undefined) { // closure
    const self = this;

    if (url.slice(0,5) === "about"){
      url = null;
    }

    return new Promise(function(resolve, reject) {
      self.counter++;
      const color = self.getColor(self.counter);
      browser.contextualIdentities.create({
        name: "TC" + self.counter,
        color: color,
        icon: "fingerprint"
      }).then(
        function(context){
        console.log(`New TC: ${context.cookieStoreId}.`);
        browser.tabs.create({
          cookieStoreId : context.cookieStoreId,
          url : url,
          active : active,
          pinned : pinned,
          index : index}).then(
            function(tab){
              resolve(tab.id)
            }, 
            self.onError
          );
        }, self.onError);
      })
  }

  cleaning() {
    browser.contextualIdentities.query({}).then((contexts) => {
      this.onGot(contexts) // delete all contexts
      // browser.tabs.query({}).then((tabs) => {
      //   for (let i = 0; i < tabs.length; i++) {
      //     if (tabs[i].cookieStoreId != 'firefox-default') {
      //       // it's a tab that was previously open in a TC
      //       console.log('found old TC tab', tabs[i])
      //       this.createNew(tabs[i].url, tabs[i].active).then((a) => {
      //         console.log('a=', a)
      //         console.log('removing tabid=', tabs[i].id)
      //         browser.tabs.remove(tabs[i].id)
      //         console.log('tab removed')
      //         // when having an activated tab, firefox will clik on
      //         // it and reload it so if we delete the tab it will not
      //         // know it and will raise tab ID error => better user tab reload?
      //       })
      //     }
      //   }
      // })
    }, this.onError)
  }

  onGot(contexts) {
    for (let context of contexts) {
      if ((context.name[0] == 'T') && (context.name[1] == 'C')) {
        console.log('onGot: remaining TC found and deleted')
        browser.contextualIdentities.remove(context.cookieStoreId)
      }
    }
  }

  checkUnusedContainer(tabId) {
    var self = this
    async function check(){
      console.log("checkUnusedContainer")
      var contexts = await browser.contextualIdentities.query({})
      for (let context of contexts) {
        if ((context.name[0] == 'T') && (context.name[1] == 'C')) {
          var cookieStoreId = context.cookieStoreId
          var tabs = await browser.tabs.query({'cookieStoreId' : cookieStoreId})
          if (tabs.length == 0) { // not tabs are using the context so we can remove it
            browser.contextualIdentities.remove(cookieStoreId).then(
              () => {console.log(cookieStoreId, 'deleted')},
              () => {console.log(cookieStoreId, 'already removed')})
          } else if (tabs.length == 1) {
            if (tabs[0].id == tabId){
              browser.contextualIdentities.remove(cookieStoreId).then(
                () => {console.log(cookieStoreId, 'deleted')},
                () => {console.log(cookieStoreId, 'already removed')})
            }
          }
        }
      }
    }
    check()
  }

}

var tc = new TabContainer()
tc.cleaning() // workaround to delete old container from previous session due to "close current tab" problem

// context-menus implementation
browser.contextMenus.create({
  id: "contextNewTCtab",
  title: "Open in New TC tab",
  contexts: ["link"]
});

browser.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == "contextNewTCtab") {
    console.log("open URL in new TC tab");
    tc.createNew(info.linkUrl, active=false)
  }
});

// check if newtab is in a context otherwise, close it and create a container tab to load the url
async function callback(details) {
  if (details.url.slice(0,5) === "about" || details.tabId < 0) {
    return;
  }

  const tab = await browser.tabs.get(details.tabId);

  // `firefox-default` is the ID of the tabs which are yet 
  // to be associated with a container
  if (tab.cookieStoreId == "firefox-default") {
    tc.createNew(details.url, active=tab.active, pinned=tab.pinned).then(
      (_) => {
        browser.tabs.remove(tab.id).then((_) => {
          console.log("removed tab:", tab.id);
        }, (error) => {
          console.error("could not remove the tab:", tab.id, error);
        });
      },
      (err) => {
        console.log("could not create new tc tab:", err)
      }
    );

    return {cancel: true};
  } else {
    // if the tab already associated with a container,
    // we should check if the container still exists
    const contexts = await browser.contextualIdentities.query({});
    const tabCtx = contexts.find((c) => c.cookieStoreId === tab.cookieStoreId);

    // could not find associated container for the tab
    // re-open the tab in a new container
    if (tabCtx === undefined) {
      tc.createNew(details.url, active=tab.active, pinned=tab.pinned, index=tab.index).then(
        (a) => {
          console.log("updated container for the tab:", a);
          browser.tabs.remove(tab.id)
        },
        (err) => {
          console.error('could not update container for the tab:', err);
        }
      );

      return {cancel: true};
    }
  }
}

filter = {urls: ["<all_urls>"], types: ["main_frame"]}
browser.webRequest.onBeforeRequest.addListener(callback, filter, ['blocking'])
//browser.webNavigation.onCreateNavigationTarget.addListener(callback2)

// focus not on address bar = bug in API
browser.commands.onCommand.addListener(function(command) {
  if (command == "openNewTCtab") {
    tc.createNew()
    console.log("received openNewContainer event")
  } else {
    console.log("not good command received")
  }
})


// delete temporary container when tab is closing
function rmCallback(tabId, removeInfo) {
  function cleanClosedTabs() {
    tc.checkUnusedContainer()
  }
  setTimeout(cleanClosedTabs, 5000)
  // ISSUE: no time to get tabId, by the time browser.tabs.get(tabId), the 
  // tab is already closed... so instead each time a tab is closed, we trigger
  // a checkUnusedContainer() after 5 s (in case the user want to restore the tab quickly)
/*
  browser.tabs.get(tabId).then((tab) => {
    if (tab.cookieStoreId != 'firefox-default') { // it's a container tab
      console.log('cleaning') // could introduce some delay in case of Ctrl + Shift + Tab
      tc.cleaning()
    }
  })
  */
}
browser.tabs.onRemoved.addListener(rmCallback)

// webrequest is better as it's lower level and avoid partial
// loading of data in the browser (before the tab is closed)
// browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
//   // console.log('Tab updated', tab, 'changeInfo', changeInfo)
//   if ('url' in changeInfo) {
//     if ((changeInfo['url'].slice(0,5) != 'about')
//       & (tab.id >= 0)) {
//       if (tab.cookieStoreId == 'firefox-default') { // default tab
//         tc.createNew(changeInfo['url'], active=tab.active, pinned=tab.pinned).then(
//           function(a){
//             console.log('TC resolved with value:', a) // there you remove the tab
//             browser.tabs.remove(tab.id)},
//           function(b){
//             console.log('error in promise', b)
//           })
//       } else {
//         browser.contextualIdentities.query({}).then((contexts) => {
//           var itsin = false;
//           for (let i = 0; i < contexts.length; i++) {
//             if (tab.cookieStoreId == contexts[i].cookieStoreId) {
//               itsin = true;
//             }
//           }
//           if (itsin == false) {
//             console.log('old TC tab detected', tab)
//             tc.createNew(changeInfo['url'], active=tab.active, pinned=tab.pinned).then(
//               function(a){
//                 console.log('updated TC resolved with value:', a) // there you remove the tab
//                 browser.tabs.remove(tab.id)},
//               function(b){
//                 console.log('error in (updated) promise', b)
//             })
//           }
//         })
//       }
//     }
//   }
// })
