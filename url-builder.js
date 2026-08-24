(function attachUrlBuilder(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) module.exports = api;
  root.SlipMateURL = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createUrlBuilder() {
  const BRAZIL_BASE = "https://www.bet365.bet.br";
  const INTERNATIONAL_BASE = "https://www.bet365.com";

  function isValidSelection(selection) {
    return Boolean(
      selection &&
        /^\d+$/.test(String(selection.eventId || "")) &&
        /^\d+$/.test(String(selection.selectionId || "")) &&
        /^\d+\/\d+$/.test(String(selection.fractionalOdd || ""))
    );
  }

  function normalizeBaseUrl(value) {
    const base = String(value || BRAZIL_BASE).replace(/\/$/, "");
    return base.includes("bet365.com") ? INTERNATIONAL_BASE : BRAZIL_BASE;
  }

  function buildBet365Url(selections, options = {}) {
    if (!Array.isArray(selections) || selections.length === 0) {
      throw new Error("Adicione pelo menos uma seleção.");
    }

    if (selections.some((selection) => !isValidSelection(selection))) {
      throw new Error("Uma das seleções não possui os identificadores necessários.");
    }

    const bs = selections
      .map((selection) => {
        const eventId = encodeURIComponent(String(selection.eventId));
        const selectionId = encodeURIComponent(String(selection.selectionId));
        return `%7C${eventId}-${selectionId}~${selection.fractionalOdd}`;
      })
      .join("");

    return `${normalizeBaseUrl(options.baseUrl)}/dl/sportsbookredirect?bet=1&bs=${bs}`;
  }

  function fractionalToDecimal(fractionalOdd) {
    const match = String(fractionalOdd || "").match(/^(\d+)\/(\d+)$/);
    if (!match || Number(match[2]) === 0) return null;
    return 1 + Number(match[1]) / Number(match[2]);
  }

  function getCombinedDecimal(selections) {
    if (!Array.isArray(selections) || selections.length === 0) return null;

    const value = selections.reduce((total, selection) => {
      const decimal =
        Number(selection.decimalOdd) > 1
          ? Number(selection.decimalOdd)
          : fractionalToDecimal(selection.fractionalOdd);
      return decimal ? total * decimal : total;
    }, 1);

    return Number.isFinite(value) ? value : null;
  }

  return {
    BRAZIL_BASE,
    INTERNATIONAL_BASE,
    buildBet365Url,
    fractionalToDecimal,
    getCombinedDecimal,
    isValidSelection,
    normalizeBaseUrl
  };
});
