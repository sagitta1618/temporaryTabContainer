function callback(tab) {
    console.log('tab = ' + tab)
    console.log('cookieStoreId = ' + tab.cookieStoreId)
    if (tab.cookieStoreId == 'firefox-default') {
        console.log('default tab detected')
        priv9.createNew(tab.url)
        browser.tabs.remove(tab.id)
        //tab.cookieStoreId = 'firefox-container-1' // does'nt seems to work
        console.log('tab id = ' + tab.id)
        //browser.tabs.reload(tab.Id)
        console.log('tab set at ' + tab.cookieStoreId)

        // now way to update current tab cookieStoreId
        // or maybe just by setting it like this and reload()
        console.log('tab url = ' + tab.url)
        //browser.tabs.update(tab.id, {url:'https://www.google.com'}) // working

        // can close the tab and open a new one ...
        //priv9.createNew()
    }
}

// check if newtab is in a context otherwise, close it and create a container tab to load the url
function callback2(details) {
    console.log('onBeforeRequest : ' + details.url)
    console.log(details)
    console.log('URL = ' + details.url.slice(0,5))
    // TODO not do it for the last tab in the windows
    browser.tabs.query({}).then((a) => {
        if (a.length > 0) {
            if(details.url.slice(0,5) != 'about') {
            //console.log('not a local URL')
            browser.tabs.get(details.tabId).then(
            (tab) => {
                    if (tab.cookieStoreId == 'firefox-default') {
                        console.log('default cookie')
                        //if(tab.id != 1){
                          //  console.log('for ulr = ' + details.url)
/*
                          new Promise(function(resolve, reject){
                            priv9.createNew(details.url);
                            resolve();
                          }).then(() => {browser.tabs.remove(tab.id)})
                          */
                          priv9.createNew2(details.url).then(
                            function(a){console.log('fullfilled with value:', a); // there you remove the tab
                            browser.tabs.remove(tab.id);},
                            console.log('error in promise'))
                        //} else {
                          //  console.log('first tab')
                        //}
                    } else {
                        console.log('already in container')
                    }
            })
          }
        } else {
          console.log('latest tab open')
        }
    })
}

function callback3(details) {
  console.log('URLLL = ' + details.url)
}
//browser.tabs.onCreated.addListener(callback)
//browser.webNavigation.onBeforeNavigate.addListener(callback2)
filter = {urls: ["<all_urls>"], types: ["main_frame"]}
browser.webRequest.onBeforeRequest.addListener(callback2, filter, ['blocking'])
//browser.webNavigation.onCreateNavigationTarget.addListener(callback2)

// maybe need permission ?


// focus not on address bar = bug in API
browser.commands.onCommand.addListener(function(command) {
  if (command == "openNewContainer") {
    priv9.createNew()
    console.log("received openNewContainer event")
    // add some code here
  } else {
    console.log("not good command received")
  }
})


var colors = ["blue", "turquoise", "green", "yellow", "orange", "red", "pink", "purple"]
// ideally put this code in a separate script to be accessible by context.js too
var priv9 = {
  colors : ["blue","pink", "green",  "purple", "turquoise", "yellow", "red", "orange"],
  icol : 0,
  containers : [],
  counter : 0,
  index : 0, // just usefull because I don't know how to pass extra argument to
  // promise callback function
  removedId : [], // store the remove id before deleting them from this.containers
  urls : [],

  onCreated : function (context) {
    console.log(`New identity's ID: ${context.cookieStoreId}.`);
    priv9.containers.push(context.cookieStoreId) // undefied this
    console.log(priv9.containers)
    console.log(priv9.urls)
    browser.tabs.create({cookieStoreId : context.cookieStoreId,
      url: priv9.urls[priv9.urls.length-1],
      active: priv9.active}).then(
      console.log('tab created'), this.onError);
  },

  onError : function (e) {
    console.error(e);
  },

  createNew : function (url, active=true) {
    this.active = active
    this.icol = this.icol + 1
    if (this.icol > this.colors.length) {
      this.icol = this.icol - this.colors.length // not sure about +1
    }
    this.urls.push(url)
    this.counter = this.counter + 1
    console.log("color = " + this.colors[this.icol])
    var self = this
    browser.contextualIdentities.create({
      name: "TC" + this.counter, // add counter here ?
      color: this.colors[this.icol],
      icon: "fingerprint"
    }).then(this.onCreated, this.onError);
  },

  createNew2 : function (url, active=true) {
    //var self = priv9
    return new Promise(function(resolve, reject){
      //console.log("this = " + self)
      priv9.active = active
      priv9.icol = priv9.icol + 1
      if (priv9.icol > priv9.colors.length) {
        priv9.icol = priv9.icol - priv9.colors.length // not sure about +1
      }
      priv9.urls.push(url)
      priv9.counter = priv9.counter + 1
      //console.log("color = " + priv9.colors[priv9.icol])
      browser.contextualIdentities.create({
        name: "TC" + priv9.counter, // add counter here ?
        color: priv9.colors[priv9.icol],
        icon: "fingerprint"
      }).then(function(context){
        console.log(`New identity's ID: ${context.cookieStoreId}.`);
        priv9.containers.push(context.cookieStoreId) // undefied this
        //console.log(priv9.containers)
        //console.log(priv9.urls)
        browser.tabs.create({cookieStoreId : context.cookieStoreId,
          url: priv9.urls[priv9.urls.length-1],
          active : priv9.active}).then(
            function(a){console.log('new tab' + a); resolve(42)}, this.onError);
        }, this.onError)
    })
  },

  cleaning : function() {
    browser.contextualIdentities.query({}).then(this.onGot, this.onError)
  },

  onGot : function(contexts) {
    console.log('found the following context = ' + contexts)
    for (let context of contexts) {
      if ((context.name[0] == 'T') & (context.name[1] == 'C')) {
        console.log('mmh remaining tab found !')
        //browser.contextualIdentities.remove(context.cookieStoreId)
        //console.log('and removed !')
        browser.contextualIdentities.remove(context.cookieStoreId)
//        priv9.containers.push(context.cookieStoreId)
//        priv9.counter = priv9.counter + 1
        console.log('and ADDED to containers list')

      }
    }
  },

  removeContainer : function(ttabs) {
    // callback function (this unavailable)
    console.log("this.index = " + priv9.index)
    console.log("container length : " + ttabs.length)
    if (ttabs.length == 0) {
      browser.contextualIdentities.remove(priv9.containers[priv9.index])
      priv9.removedId.push(priv9.index)
      priv9.containers[priv9.index] = "deleted"
      console.log("container removed : " + priv9.containers[priv9.index])
      console.log(priv9.containers)
    }
  },

  checkUnusedContainer : function(tabId, removeInfo) {
    console.log("checkUnusedContainer")
    priv9.removeUnused(tabId)
  },

  makeClosure : function(i) {
    // this function return the callback function needed when the
    // promise is fullfilled. It keep the local variable i because
    // it forms a closure.
    return function(ttabs) {
      console.log('i = ' + i)
      if (ttabs.length == 0) {
        browser.contextualIdentities.remove(priv9.containers[i])
        priv9.removedId.push(i)
        priv9.containers[i] = "deleted"
        console.log("container removed : " + priv9.containers[i])
        console.log(priv9.containers)
      }
    }
  },

  checkCurrentTab : function(tabs) {
    console.log('checking current closing tabs')
    //console.log('tab.cookieStoreId = ' + tab.cookieStoreId)
  },

  removeUnused : function(tabId) {
    console.log("removeUnused")
    //var closingTab = browser.tabs.get(tabId).then(this.checkCurrentTab, this.onError)
    for (var i = 0; i < this.containers.length; i++) {
      //this.index = i // trick to pass index to callback of promise
      if (this.containers[i] != "deleted") {
        var ttabs = browser.tabs.query({
          "cookieStoreId" : this.containers[i]
        }).then(this.makeClosure(i), this.onError)
      }
    }
  },


}

browser.tabs.onRemoved.addListener(priv9.checkUnusedContainer)
// so each time a tab is closed we check if we can delete an unused container
// removeUnused() : require the list of all active containers
// makeClosure() : ask for the tabs using the context, if none, the context is deleted


// not working properly too ...
browser.windows.onRemoved.addListener(priv9.checkUnusedContainer)

priv9.cleaning() // workaroudn to delete old container from previous session due to "close current tab" problem



// context-menus implementation
browser.contextMenus.create({
  id: "contextNewContainerPriv9",
  title: "Open in New Container",
  contexts: ["link"]
});


browser.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == "contextNewContainerPriv9") {
    console.log("open URL in new priv9 tab");
    priv9.createNew2(info.linkUrl, active=false)
  }
});



/* test code
function onCreated(context) {
  console.log(`New identity's ID: ${context.cookieStoreId}.`);
}

function onError(e) {
  console.error(e);
}

function createNew() {
  browser.contextualIdentities.create({
    name: "the Thing",
    color: "purple",
    icon: "fingerprint"
  }).then(onCreated, onError);
}
*/
