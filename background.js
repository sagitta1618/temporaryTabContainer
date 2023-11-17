/* temporary container for each tab
Principle: each time a new tab is open, the extension close it quickly
and then open it in a new temporary container. When a tab is close we check
if there are container that are not used by any tabs and remove them.
*/

const colors = ["blue", "turquoise", "green", "yellow", "orange", "red", "pink", "purple"];
const containerPrefix = "TC";
const containerIcon = "fingerprint";
// ideally put this code in a separate script to be accessible by context.js too
class TabContainer {
  constructor() {
    this.counter = 0; // number of container open during session
  }

  getColor(a) { // return color from global 'colors' variable
    return colors[a % colors.length];
  }

  onError(e) {
    console.error(e);
  }

  createNew(url, active = true, pinned = false, index = undefined) { // closure
    const self = this;

    if (url.slice(0, 5) === "about") {
      url = null;
    }

    return new Promise(function (resolve, reject) {
      self.counter++;
      const color = self.getColor(self.counter);
      browser.contextualIdentities.create({
        name: containerPrefix + self.counter,
        color: color,
        icon: containerIcon
      }).then(
        function (context) {
          console.log(`New TC: ${context.cookieStoreId}.`);
          browser.tabs.create({
            cookieStoreId: context.cookieStoreId,
            url: url,
            active: active,
            pinned: pinned,
            index: index
          }).then(
            (tab) => {
              resolve(tab.id)
            },
            self.onError
          );
        }, self.onError);
    })
  }

  cleaning() {
    browser.contextualIdentities.query({}).then((contexts) => {
      this.onGot(contexts); // delete all contexts
    }, this.onError)
  }

  onGot(contexts) {
    for (let context of contexts) {
      if (context.name.slice(0, 2) === containerPrefix) {
        browser.contextualIdentities.remove(context.cookieStoreId);
        console.log("onGot: remaining container found and deleted");
      }
    }
  }

  checkUnusedContainer(tabId) {
    const self = this;
    async function check() {
      console.log("checkUnusedContainer")
      const contexts = await browser.contextualIdentities.query({})
      for (let context of contexts) {
        if (context.name.slice(0, 2) !== containerPrefix) {
          continue;
        }
        const cookieStoreId = context.cookieStoreId
        const tabs = await browser.tabs.query({
          "cookieStoreId": cookieStoreId
        })
        if (tabs.length === 0) { // not tabs are using the context so we can remove it
          browser.contextualIdentities.remove(cookieStoreId).then(
            () => {
              console.log(cookieStoreId, "deleted")
            },
            () => {
              console.log(cookieStoreId, "already removed")
            })
        } else if (tabs.length === 1) {
          if (tabs[0].id === tabId) {
            browser.contextualIdentities.remove(cookieStoreId).then(
              () => {
                console.log(cookieStoreId, "deleted")
              },
              () => {
                console.log(cookieStoreId, "already removed")
              })
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

browser.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === "contextNewTCtab") {
    console.log("open URL in new TC tab");
    tc.createNew(info.linkUrl, active = false)
  }
});

// check if newtab is in a context otherwise, close it and create a container tab to load the url
async function callback(details) {
  if (details.url.slice(0, 5) === "about" || details.tabId < 0) {
    return;
  }

  const tab = await browser.tabs.get(details.tabId);

  // `firefox-default` is the ID of the tabs which are yet 
  // to be associated with a container
  if (tab.cookieStoreId === "firefox-default") {
    // here is a workaround for the users of the Firefox Multi-Account Containers
    // this prevents duplicated tabs creation
    // since they listen the same event in the extension and we are'nt allowed to listen their messages,
    // we have to give to their extension a chance to perform the necessary operations
    setTimeout(function () {
      browser.tabs.get(tab.id)
        .then(
          () => {
            tc.createNew(details.url, active = true, pinned = tab.pinned).then(
              (newId) => {
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
          },
          // if their extension has removed our tab,
          // that means we can ignore that request
          (error) => {
            console.log("the request has been handled by other extension");
          });
    }, 20);

    return {
      cancel: true
    };
  } else {
    // if the tab already associated with a container,
    // we should check if the container still exists
    const contexts = await browser.contextualIdentities.query({});
    const tabCtx = contexts.find((c) => c.cookieStoreId === tab.cookieStoreId);

    // could not find associated container for the tab
    // re-open the tab in a new container
    if (tabCtx === undefined) {
      tc.createNew(details.url, active = tab.active, pinned = tab.pinned, index = tab.index).then(
        (a) => {
          console.log("updated container for the tab:", a);
          browser.tabs.remove(tab.id)
        },
        (err) => {
          console.error('could not update container for the tab:', err);
        }
      );

      return {
        cancel: true
      };
    }
  }
}

// we need the <all_urls> permission to automatically
// open a new tab in a TC when it is not open via a
// "user action" like the context menu. Because we do
// this automatically and do not require user interaction
// we need "<all_urls>" permission and end up with the 
// warning "This extension can access data on all websites"
// using the "activeTab" permission works only if we open
// a new temporary container tab from the context menu or
// keyboard shortcut (= with a user action)
filter = {
  urls: ["<all_urls>"],
  types: ["main_frame"]
}
browser.webRequest.onBeforeRequest.addListener(callback, filter, ['blocking'])

// focus not on address bar = bug in API
browser.commands.onCommand.addListener(function (command) {
  if (command === "openNewTCtab") {
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
}
browser.tabs.onRemoved.addListener(rmCallback)
