document.addEventListener("DOMContentLoaded", async () => {
  const i18n = globalThis.SlipMateI18n;
  const t = (key, substitutions, fallback) =>
    i18n?.getMessage(key, substitutions, fallback) || fallback;
  i18n?.localizeDocument(document);

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
  const evButton = document.getElementById("evButton");
  const updateButton = document.getElementById("updateButton");

  let activeTabId = null;
  let pageState = null;

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function selectionLabel(count) {
    return count === 1
      ? t("selectionCountOne", String(count), `${count} seleção`)
      : t("selectionCountMany", String(count), `${count} seleções`);
  }

  function renderUnavailable() {
    statusDot.className = "status-dot warn";
    statusTitle.textContent = t("bet365NotDetected", undefined, "Bet365 não detectada");
    statusDetail.textContent = t(
      "openBet365Tab",
      undefined,
      "Abra a Bet365 nesta guia e tente novamente."
    );
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
      statusTitle.textContent = t("bet365SignedOut", undefined, "Bet365 deslogada");
      statusDetail.textContent = pageState.effectiveMode
        ? t("oddsEnterNoLoginSlip", undefined, "As odds entram no Bilhete sem login.")
        : t(
          "enableNoLoginSlipAvoidLogin",
          undefined,
          "Ative o bilhete para evitar a tela de login."
        );
    } else if (pageState.authState === "logged-in") {
      statusTitle.textContent = pageState.effectiveMode
        ? t("noLoginSlipActive", undefined, "Bilhete sem login ativo")
        : useLegacy
          ? t("betslipDetected", undefined, "Betslip Bet365 detectado")
          : t("bet365Connected", undefined, "Bet365 conectada");
      statusDetail.textContent = pageState.effectiveMode
        ? t("oddsEnterOwnSlip", undefined, "As odds entram no bilhete próprio.")
        : useLegacy
          ? t("classicFlowPreserved", undefined, "Fluxo clássico preservado.")
          : t("enableNoLoginSlip", undefined, "Ative o bilhete para usar o slip próprio.");
    } else {
      statusDot.className = "status-dot warn";
      statusTitle.textContent = t(
        "accountStateUnknown",
        undefined,
        "Estado da conta indefinido"
      );
      statusDetail.textContent = pageState.effectiveMode
        ? t(
          "noLoginSlipManualActive",
          undefined,
          "Bilhete sem login ativo manualmente."
        )
        : t(
          "canEnableManually",
          undefined,
          "Você ainda pode ativar o bilhete manualmente."
        );
    }

    flowLabel.textContent = useLegacy
      ? t("betslipBet365", undefined, "Betslip Bet365")
      : t("noLoginSlip", undefined, "Bilhete sem login");
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
      const useLegacy =
        !pageState.effectiveMode &&
        pageState.authState === "logged-in" &&
        pageState.legacyAvailable;
      const selections = useLegacy
        ? pageState.legacySelections
        : pageState.state.selections;
      const url = useLegacy
        ? pageState.legacyUrl
        : SlipMateURL.buildBet365Url(selections, { baseUrl: pageState.baseUrl });
      await navigator.clipboard.writeText(url);
      setMessage(t("bet365LinkCopied", undefined, "Link Bet365 copiado."));
    } catch (error) {
      setMessage(
        error.message || t("copyLinkFailed", undefined, "Não foi possível copiar o link."),
        true
      );
    }
  });

  clearButton.addEventListener("click", async () => {
    try {
      pageState.state = await SlipMateStore.clear(activeTabId);
      setMessage(t("betSlipCleared", undefined, "Bilhete sem login limpo."));
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
  evButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://stakemateapp.com/" });
  });
  updateButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/KleberBarilli/slip-mate/releases" });
  });
});
