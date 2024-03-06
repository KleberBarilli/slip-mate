document.addEventListener("DOMContentLoaded", function () {
  const generateButton = document.getElementById("generateButton");
  const messageElement = document.getElementById("message");

  generateButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "getBetstring" },
        function (response) {
          const betString = response.betstring;

          if (!betString) {
            messageElement.textContent = "not found";
            return;
          }

          const postData = {
            betString: betString,
            keyAccess: "chaves disponíveis para compra em, entre em contato caso tenha interesse"
          };

          const requestOptions = {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(postData),
          };

          fetch(
            "https://smart-bettor-slip-mate-ua5m5.ondigitalocean.app/",
            requestOptions
          )
            .then((response) => response.json())
            .then((data) => {
              if (data?.url) {
                navigator.clipboard
                  .writeText(data.url)
                  .then(() => {
                    messageElement.textContent = "URL copied to clipboard!";
                  })
                  .catch((error) => {
                    console.error("Error copying to clipboard:", error);
                    messageElement.textContent = "Error copying to clipboard.";
                  });
              } else if (data?.error) {
                messageElement.textContent = data.error;
              } else {
                messageElement.textContent = "Internal server error";
              }
            })
            .catch((error) => {
              console.error("Internal Server Error");
              messageElement.textContent = "Internal Server Error.";
            });
        }
      );
    });
  });

  generateButtonBetfair.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "getBetSlipBetfair" },
        function (response) {
          const betState = response.betState;

          if (!betState) {
            messageElement.textContent = "not found";
            return;
          }

          const postData = {
            betState: betState,
            keyAccess: "Free API"
          };

          const requestOptions = {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(postData),
          };

          fetch(
            "https://smart-bettor-slip-mate-ua5m5.ondigitalocean.app/betfair",
            requestOptions
          )
            .then((response) => response.json())
            .then((data) => {
              if (data?.url) {
                navigator.clipboard
                  .writeText(data.url)
                  .then(() => {
                    messageElement.textContent = "URL copied to clipboard!";
                  })
                  .catch((error) => {
                    console.error("Error copying to clipboard:", error);
                    messageElement.textContent = "Error copying to clipboard.";
                  });
              } else if (data?.error) {
                messageElement.textContent = data.error;
              } else {
                messageElement.textContent = "Internal server error";
              }
            })
            .catch((error) => {
              console.error("Internal Server Error");
              messageElement.textContent = "Internal Server Error.";
            });
        }
      );
    });
  });

  contactButton.addEventListener("click", function () {
    chrome.tabs.create({ url: "https://twitter.com/SSBets_" });
  });

  linkButton.addEventListener("click", function () {
    chrome.tabs.create({ url: "https://linktr.ee/thesmartbettor" });
  });
});
