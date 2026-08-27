(function attachBet365Parser(root, factory) {
  const api = factory(root.SlipMateURL);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SlipMateParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createParser(urlBuilder) {
  function optionalText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function normalizeSelection(value) {
    if (!value || typeof value !== "object") return null;

    const normalized = {
      eventId: String(value.eventId || "").trim(),
      selectionId: String(value.selectionId || "").trim(),
      fractionalOdd: String(value.fractionalOdd || "").trim(),
      decimalOdd: Number(value.decimalOdd) > 1 ? Number(value.decimalOdd) : null,
      selectionName: optionalText(value.selectionName, 160),
      subjectName: optionalText(value.subjectName, 160),
      marketName: optionalText(value.marketName, 160),
      eventName: optionalText(value.eventName, 200),
      handicap: optionalText(value.handicap, 60),
      marketId: optionalText(value.marketId, 80)
    };

    const valid = urlBuilder?.isValidSelection
      ? urlBuilder.isValidSelection(normalized)
      : /^\d+$/.test(normalized.eventId) &&
        /^\d+$/.test(normalized.selectionId) &&
        /^\d+\/\d+$/.test(normalized.fractionalOdd);

    return valid ? normalized : null;
  }

  function detectAuthState({ betstring = "", buttonTexts = [] } = {}) {
    const texts = Array.isArray(buttonTexts)
      ? buttonTexts.map((text) => String(text).trim().toLocaleLowerCase()).filter(Boolean)
      : [];
    const hasLogin = texts.some((text) => ["log in", "login", "entrar"].includes(text));
    const hasJoin = texts.some((text) =>
      ["join", "join now", "cadastre-se", "criar conta", "registre-se"].includes(text)
    );

    // The visible account controls are authoritative. Bet365 can leave an old
    // betstring in sessionStorage after logout, so it must not win this check.
    if (hasLogin && hasJoin) return "logged-out";

    const hasAccount = texts.some((text) =>
      ["my account", "minha conta", "account", "conta"].includes(text)
    );
    if (hasAccount) return "logged-in";
    if (String(betstring || "").trim()) return "logged-in";
    return "unknown";
  }

  function parseLegacyBetstring(betString) {
    const source = typeof betString === "string" ? betString : "";
    if (!source) return [];

    const selections = [];
    const seen = new Set();

    function add(eventId, selectionId, fractionalOdd) {
      const selection = normalizeSelection({ eventId, selectionId, fractionalOdd });
      if (!selection) return false;
      const key = `${selection.eventId}:${selection.selectionId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      selections.push(selection);
      return true;
    }

    // Each `||` block is one leg. Bet365 omits `TP=BS` on some legs (for
    // example a second line of the same player market), so the block fields
    // are authoritative and the topic is only a fallback.
    source.split("||").forEach((block) => {
      if (!block.trim()) return;

      const eventId = block.match(/(?:^|[#|])f=(\d+)(?:#|$)/)?.[1];
      const selectionId = block.match(/(?:^|[#|])fp=(\d+)(?:#|$)/)?.[1];
      const fractionalOdd = block.match(/(?:^|[#|])o=(\d+\/\d+)(?:#|$)/)?.[1];

      if (add(eventId, selectionId, fractionalOdd)) return;

      [...block.matchAll(/TP=BS(\d+)-(\d+)/g)].forEach((topic) =>
        add(topic[1], topic[2], fractionalOdd)
      );
    });

    if (selections.length > 0) return selections;

    // Oldest layout: the odds live in a separate list, aligned with the topics.
    const topics = [...source.matchAll(/TP=BS(\d+)-(\d+)/g)];
    const legacyOdds = [...source.matchAll(/N#o=(\d+\/\d+)#/g)].map((match) => match[1]);

    if (topics.length > 0 && topics.length === legacyOdds.length) {
      topics.forEach((topic, index) => add(topic[1], topic[2], legacyOdds[index]));
    }

    return selections;
  }

  return { detectAuthState, normalizeSelection, parseLegacyBetstring };
});
