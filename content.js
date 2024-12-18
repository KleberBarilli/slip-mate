chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getBetstring") {
    const betString = sessionStorage.getItem("betstring");
    sendResponse({ betstring: betString });
  }
});
