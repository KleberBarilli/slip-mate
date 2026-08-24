document.addEventListener("DOMContentLoaded", async () => {
  const statusDot = document.getElementById("statusDot");
  const statusTitle = document.getElementById("statusTitle");
  const statusDetail = document.getElementById("statusDetail");
  const modeToggle = document.getElementById("modeToggle");
  const flowLabel = document.getElementById("flowLabel");
  const selectionCount = document.getElementById("selectionCount");
  const combinedOdd = document.getElementById("combinedOdd");
  const copyButton = document.getElementById("copyButton");
  const clearButton = document.getElementById("clearButton");
  const message = document.getElementById("message");
  const linkButton = document.getElementById("linkButton");
  const updateButton = document.getElementById("updateButton");

  let activeTabId = null;
  let pageState = null;

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function selectionLabel(count) {
    return `${count} ${count === 1 ? "seleção" : "seleções"}`;
  }

  function renderUnavailable() {
    statusDot.className = "status-dot warn";
    statusTitle.textContent = "Bet365 não detectada";
    statusDetail.textContent = "Abra a Bet365 nesta guia e tente novamente.";
    modeToggle.disabled = true;
    copyButton.disabled = true;
    clearButton.disabled = true;
  }

  function render() {
    if (!pageState?.ok) {
      renderUnavailable();
      return;
    }

    const customSelections = pageState.state?.selections || [];
    const useLegacy =
      !pageState.effectiveMode &&
      pageState.authState === "logged-in" &&
      pageState.legacyAvailable;
    const selections = useLegacy ? pageState.legacySelections : customSelections;
    const combined = SlipMateURL.getCombinedDecimal(selections);

    statusDot.className = "status-dot ready";
    modeToggle.disabled = false;
    modeToggle.checked = Boolean(pageState.effectiveMode);

    if (pageState.authState === "logged-out") {
      statusTitle.textContent = "Bet365 deslogada";
      statusDetail.textContent = pageState.effectiveMode
        ? "As odds entram no Slip Mate."
        : "Ative o modo para evitar a tela de login.";
    } else if (pageState.authState === "logged-in") {
      statusTitle.textContent = pageState.effectiveMode
        ? "Modo Slip Mate ativo"
        : useLegacy
          ? "Betslip Bet365 detectado"
          : "Bet365 conectada";
      statusDetail.textContent = pageState.effectiveMode
        ? "As odds entram no slip próprio."
        : useLegacy
          ? "Fluxo clássico preservado."
          : "Ative o modo para usar o slip próprio.";
    } else {
      statusDot.className = "status-dot warn";
      statusTitle.textContent = "Estado da conta indefinido";
      statusDetail.textContent = pageState.effectiveMode
        ? "Modo manual ativo."
        : "Você ainda pode ativar o modo manualmente.";
    }

    flowLabel.textContent = useLegacy ? "Betslip Bet365" : "Slip Mate";
    selectionCount.textContent = selectionLabel(selections.length);
    combinedOdd.textContent = combined ? combined.toFixed(2) : "—";
    copyButton.disabled = selections.length === 0;
    clearButton.disabled = useLegacy || customSelections.length === 0;

    if (pageState.state?.mappingError) setMessage(pageState.state.mappingError, true);
  }

  async function getPageState() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tabs[0]?.id ?? null;
    if (!activeTabId) return null;
    try {
      return await chrome.tabs.sendMessage(activeTabId, {
        action: "SLIP_MATE_GET_PAGE_STATE"
      });
    } catch (_error) {
      return null;
    }
  }

  pageState = await getPageState();
  render();

  copyButton.addEventListener("click", async () => {
    try {
      const selections = pageState.legacyAvailable
        ? pageState.legacySelections
        : pageState.state.selections;
      const url = pageState.legacyAvailable
        ? pageState.legacyUrl
        : SlipMateURL.buildBet365Url(selections, { baseUrl: pageState.baseUrl });
      await navigator.clipboard.writeText(url);
      setMessage("Link Bet365 copiado.");
    } catch (error) {
      setMessage(error.message || "Não foi possível copiar o link.", true);
    }
  });

  clearButton.addEventListener("click", async () => {
    try {
      pageState.state = await SlipMateStore.clear(activeTabId);
      setMessage("Slip Mate limpo.");
      render();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  modeToggle.addEventListener("change", async () => {
    try {
      const enabled = modeToggle.checked;
      pageState.state = await SlipMateStore.setMode(enabled, activeTabId);
      pageState.effectiveMode = enabled;
      await chrome.tabs.sendMessage(activeTabId, {
        action: "SLIP_MATE_STATE_CHANGED",
        state: pageState.state
      });
      render();
    } catch (error) {
      modeToggle.checked = !modeToggle.checked;
      setMessage(error.message, true);
    }
  });

  linkButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://linktr.ee/thesmartbettor" });
  });
  updateButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/KleberBarilli/slip-mate/releases" });
  });
});
