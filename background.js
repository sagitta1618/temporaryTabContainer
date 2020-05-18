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
    this.urls = new Map() // dictionnary with cookieStoreId and url
  }

  getColor(){ // return color from global 'colors' variable
    var a = this.counter
    if (a > colors.length){
      a = a % colors.length
    }
    return colors[a]
  }

  onError(e) {
    console.error(e);
  }

  createNew(url, active=true) { // closure
    var self = this
    return new Promise(function(resolve, reject){
      if (self.urls.has(url)) { // reuse TC
        var cookieStoreId = self.urls.get(url)
        console.log('Using TC:', cookieStoreId);
        browser.tabs.create({cookieStoreId : cookieStoreId,
          url: url,
          active : active}).then(
            function(){resolve(42)}, self.onError)
      } else { // create a new TC
        self.counter = self.counter + 1
        browser.contextualIdentities.create({ // create new TC
          name: "TC" + self.counter,
          color: self.getColor(),
          icon: "fingerprint"
        }).then(
          function(context){
          console.log(`New TC: ${context.cookieStoreId}.`);
          browser.tabs.create({cookieStoreId : context.cookieStoreId,
            url: url,
            active : active}).then(
              function(){resolve(42)}, self.onError);
          }, self.onError)
        }
      })
  }

  cleaning() {
    browser.contextualIdentities.query({}).then(this.onGot, this.onError)
  }

  onGot(contexts) {
    for (let context of contexts) {
      if ((context.name[0] == 'T') & (context.name[1] == 'C')) {
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
        if ((context.name[0] == 'T') & (context.name[1] == 'C')) {
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

function removeCallBack(tabId, removeInfo){
  tc.checkUnusedContainer(tabId)
}

function storeURL(tabId, removeInfo){
  //console.log(tabId, removeInfo)
  browser.tabs.get(tabId).then(tab => {
    console.log(tab.url)
    tc.urls.set(tab.url, tab.cookieStoreId)
  })
}

// so each time a tab is closed we check if we can delete an unused container
// browser.tabs.onRemoved.addListener(removeCallBack)
browser.tabs.onUpdated.addListener(storeURL)
//browser.windows.onRemoved.addListener(removeCallBack)


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
function callback(details) {
  // console.log('callback (onBeforeRequest) : ' + details.url)
  // console.log(details)
  // TODO not do it for the last tab in the windows
  if (details.url.slice(0,5) != 'about') {
    browser.tabs.get(details.tabId).then((tab) => {
      if (tab.cookieStoreId == 'firefox-default') { // default tab
        tc.createNew(details.url).then(
          function(a){
            // console.log('TC resolved with value:', a) // there you remove the tab
            browser.tabs.remove(tab.id)},
          function(b){
            console.log('error in promise')
          })
      }
    })
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
