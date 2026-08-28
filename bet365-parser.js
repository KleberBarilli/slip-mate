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
      teamName: optionalText(value.teamName, 160),
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

    const topics = [...source.matchAll(/TP=BS(\d+)-(\d+)/g)];
    const legacyOdds = [...source.matchAll(/N#o=(\d+\/\d+)#/g)].map((match) => match[1]);
    const selections = [];
    const seen = new Set();

    function add(eventId, selectionId, fractionalOdd) {
      const selection = normalizeSelection({ eventId, selectionId, fractionalOdd });
      if (!selection) return;
      const key = `${selection.eventId}:${selection.selectionId}`;
      if (seen.has(key)) return;
      seen.add(key);
      selections.push(selection);
    }

    if (topics.length > 0 && topics.length === legacyOdds.length) {
      topics.forEach((topic, index) => add(topic[1], topic[2], legacyOdds[index]));
      return selections;
    }

    topics.forEach((topic) => {
      const topicIndex = topic.index || 0;
      const previousNormal = source.lastIndexOf("pt=N", topicIndex);
      const previousDivider = source.lastIndexOf("||", topicIndex);
      const start = Math.max(0, previousNormal, previousDivider);
      const nextDivider = source.indexOf("||", topicIndex);
      const end = nextDivider === -1 ? source.length : nextDivider;
      const block = source.slice(start, end);
      const odd = block.match(/(?:^|[#|])o=(\d+\/\d+)(?:#|$)/)?.[1];
      add(topic[1], topic[2], odd);
    });

    if (selections.length > 0) return selections;

    source.split("||").forEach((block) => {
      const eventId = block.match(/(?:^|[#|])f=(\d+)(?:#|$)/)?.[1];
      const selectionId = block.match(/(?:^|[#|])fp=(\d+)(?:#|$)/)?.[1];
      const fractionalOdd = block.match(/(?:^|[#|])o=(\d+\/\d+)(?:#|$)/)?.[1];
      add(eventId, selectionId, fractionalOdd);
    });

    return selections;
  }

  return { detectAuthState, normalizeSelection, parseLegacyBetstring };
});
