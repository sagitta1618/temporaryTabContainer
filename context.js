// button to open new container
// shortcut to open new container
// function to check and close unopen container
// do it object oriented no ? or as cleas and concise as possible
// right click to make link open in new container


/*
// create new container
function onCreated(context) {
  console.log(`New identity's ID: ${context.cookieStoreId}.`);
}

function onError(e) {
  console.error(e);
}

browser.contextualIdentities.create({
  name: "my-thing",
  color: "purple",
  icon: "briefcase"
}).then(onCreated, onError);
*/


// from the example extension
function eventHandler(event) {
  if (event.target.dataset.action == 'create') {
    browser.tabs.create({
      url: 'about:blank',
      cookieStoreId: event.target.dataset.identity
    });
  }
  if (event.target.dataset.action == 'close-all') {
    browser.tabs.query({
      cookieStoreId: event.target.dataset.identity
    }).then((tabs) => {
      browser.tabs.remove(tabs.map((i) => i.id));
    });
  }
  event.preventDefault();
}

function createOptions(node, identity) {
  for (let option of ['Create', 'Close All']) {
    let a = document.createElement('a');
    a.href = '#';
    a.innerText = option;
    a.dataset.action = option.toLowerCase().replace(' ', '-');
    a.dataset.identity = identity.cookieStoreId;
    a.addEventListener('click', eventHandler);
    node.appendChild(a);
  }
}

var div = document.getElementById('identity-list');

if (browser.contextualIdentities === undefined) {
  div.innerText = 'browser.contextualIdentities not available. Check that the privacy.userContext.enabled pref is set to true, and reload the add-on.';
} else {
  browser.contextualIdentities.query({})
    .then((identities) => {
      if (!identities.length) {
        div.innerText = 'No identities returned from the API.';
        return;
      }

     for (let identity of identities) {
       let row = document.createElement('div');
       let span = document.createElement('span');
       span.className = 'identity';
       span.innerText = identity.name;
       span.style = `color: ${identity.color}`;
       console.log(identity);
       row.appendChild(span);
       createOptions(row, identity);
       div.appendChild(row);
     }
  });
}
