const actionAPI = typeof browser !== 'undefined' ? browser.action : chrome.action;

actionAPI.onClicked.addListener(() => {
  if (typeof browser !== 'undefined') {
    browser.runtime.openOptionsPage();
  } else {
    chrome.runtime.openOptionsPage();
  }
});