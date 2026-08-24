(function attachSlipMateI18n(root, factory) {
  const api = factory(root.chrome?.i18n);
  api.createI18n = factory;

  if (typeof module === "object" && module.exports) module.exports = api;
  root.SlipMateI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createI18n(chromeI18n) {
  function getMessage(key, substitutions, fallback = "") {
    try {
      const translated = chromeI18n?.getMessage?.(key, substitutions);
      if (translated) return translated;
    } catch (_error) {
      // Invalid or unavailable browser locale falls back to the bundled PT-BR copy.
    }
    return fallback || String(key || "");
  }

  function localizeDocument(documentRef) {
    if (!documentRef?.querySelectorAll) return;

    documentRef.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = getMessage(
        element.dataset.i18n,
        undefined,
        element.textContent
      );
    });

    documentRef.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute(
        "aria-label",
        getMessage(
          element.dataset.i18nAriaLabel,
          undefined,
          element.getAttribute("aria-label") || ""
        )
      );
    });

    if (documentRef.documentElement) {
      documentRef.documentElement.lang = getMessage(
        "localeCode",
        undefined,
        documentRef.documentElement.lang || "pt-BR"
      );
    }
  }

  return { getMessage, localizeDocument };
});
