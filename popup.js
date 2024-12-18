document.addEventListener("DOMContentLoaded", function() {
  const generateButton = document.getElementById("generateButton");
  const messageElement = document.getElementById("message");

  function formatMultipleBetUrl(betString) {
      const tpPattern = /\TP=BS(\d+)-(\d+)/g;
      const matches = [...betString.matchAll(tpPattern)];
      const betStringPattern = /N#o=([\d/]+)#/g;
      const betStringMatches = [...betString.matchAll(betStringPattern)];
      const formattedBetString = betStringMatches
          .map((match) => match[1])
          .join('/');
      const formattedValues = formattedBetString.split('/');
      const valuesN7Array = [];
      for (let i = 0; i < formattedValues.length; i += 2) {
          if (i + 1 < formattedValues.length) {
              valuesN7Array.push(`${formattedValues[i]}/${formattedValues[i + 1]}`);
          }
      }
      const formattedTips = matches.map((match, index) => {
          const eventID = match[1];
          const marketID = match[2];
          return `%7C${eventID}-${marketID}~${valuesN7Array[index]}`;
      });

      const formattedUrl = `https://www.bet365.com/dl/sportsbookredirect?bet=1&bs=${formattedTips.join(
    '',
  )}`;
      return formattedUrl;
  }

  generateButton.addEventListener("click", function() {
      chrome.tabs.query({
          active: true,
          currentWindow: true
      }, function(tabs) {
          chrome.tabs.sendMessage(
              tabs[0].id, {
                  action: "getBetstring"
              },
              function(response) {
                  const betString = response.betstring;

                  if (!betString) {
                      messageElement.textContent = "not found";
                      return;
                  }
                  const formattedUrl = formatMultipleBetUrl(betString);
                  navigator.clipboard
                      .writeText(formattedUrl)
                      .then(() => {
                          messageElement.textContent = "URL copied to clipboard!";
                      })
                      .catch((error) => {
                          console.error("Error copying to clipboard:", error);
                          messageElement.textContent = "Error copying to clipboard.";
                      });

              })
      });
  });

  linkButton.addEventListener("click", function() {
      chrome.tabs.create({
          url: "http://telegram.me/the_smart_bettor_bot"
      });
  });
});