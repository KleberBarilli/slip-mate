(function initializeBet365Hook(scope) {
  const PAGE_SOURCE = "SLIP_MATE_PAGE";
  const CONTENT_SOURCE = "SLIP_MATE_CONTENT";

  function ownKeys(value) {
    try {
      return Reflect.ownKeys(value || {});
    } catch (_error) {
      return [];
    }
  }

  function isStem(value) {
    return Boolean(value && typeof value === "object" && value.data && typeof value.data === "object");
  }

  function getStemFromProps(props) {
    if (!props || typeof props !== "object") return null;
    if (isStem(props.stem)) return props.stem;
    if (isStem(props.pushStem)) return props.pushStem;
    return null;
  }

  function findFiber(node) {
    for (const key of ownKeys(node)) {
      if (
        typeof key === "string" &&
        (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"))
      ) {
        return node[key];
      }
    }
    return null;
  }

  function findStemOnNode(node) {
    for (const key of ownKeys(node)) {
      if (typeof key !== "string") continue;
      if (key.startsWith("__reactProps$")) {
        const stem = getStemFromProps(node[key]);
        if (stem) return stem;
      }
    }

    let fiber = findFiber(node);
    let depth = 0;
    while (fiber && depth < 32) {
      const stem =
        getStemFromProps(fiber.memoizedProps) ||
        getStemFromProps(fiber.pendingProps) ||
        getStemFromProps(fiber.stateNode);
      if (stem) return stem;
      fiber = fiber.return;
      depth += 1;
    }
    return null;
  }

  function nameFromData(data) {
    if (!data) return "";
    if (data.NA) return String(data.NA);
    if (data.N1 && data.N2) return `${data.N1} v ${data.N2}`;
    return String(data.N1 || data.N2 || data.HT || "");
  }

  function cleanLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isUsefulContextLabel(value, selectionName) {
    const label = cleanLabel(value);
    if (!label || label === cleanLabel(selectionName)) return false;
    return !/^\d+(?:[.,]\d+)?$/.test(label);
  }

  function extractSelectionFromStem(stem, context = {}) {
    if (!isStem(stem)) return null;

    const selectionId = String(stem.data.ID || "").trim();
    const fractionalOdd = String(stem.data.OD || "").trim();

    if (!/^\d+$/.test(selectionId) || !/^\d+\/\d+$/.test(fractionalOdd)) {
      return null;
    }
    if (stem.data.SU && String(stem.data.SU) !== "0") return null;

    let cursor = stem;
    let eventId = "";
    const selectionName = cleanLabel(stem.data.NA || context.selectionName);
    let eventName = cleanLabel(context.eventName);
    let marketName = cleanLabel(context.marketName);
    let marketId = "";
    let eventNameRank = eventName ? 1 : 0;
    let marketNameRank = marketName ? 1 : 0;
    let depth = 0;

    while (isStem(cursor) && depth < 40) {
      const data = cursor.data;

      if (!marketId && data.MA) marketId = String(data.MA);
      if (!marketId && cursor.nodeName === "MA" && data.ID) marketId = String(data.ID);

      if (cursor !== stem) {
        const candidateName = nameFromData(data);
        const isMarketStem = cursor.nodeName === "MA" || cursor.nodeName === "MG";
        const marketRank = isMarketStem ? 3 : data.MA ? 2 : 0;
        if (
          marketRank > marketNameRank &&
          isUsefulContextLabel(candidateName, selectionName)
        ) {
          marketName = cleanLabel(candidateName);
          marketNameRank = marketRank;
        }
      }

      if (data.FI || data.PF) {
        if (!eventId) eventId = String(data.FI || data.PF);
      }

      if (cursor !== stem) {
        const candidateName = nameFromData(data);
        const isFixtureStem = cursor.nodeName === "EV" || Boolean(data.N1 && data.N2);
        const eventRank = isFixtureStem ? 3 : data.FI || data.PF ? 2 : 0;
        if (
          eventRank > eventNameRank &&
          isUsefulContextLabel(candidateName, selectionName)
        ) {
          eventName = cleanLabel(candidateName);
          eventNameRank = eventRank;
        }
      }

      cursor = cursor.parent;
      depth += 1;
    }

    if (!/^\d+$/.test(eventId)) return null;

    const decimalOdd = Number.parseFloat(String(context.decimalOdd || "").replace(",", "."));
    return {
      eventId,
      selectionId,
      fractionalOdd,
      decimalOdd: Number.isFinite(decimalOdd) && decimalOdd > 1 ? decimalOdd : null,
      selectionName,
      marketName,
      eventName,
      handicap: String(stem.data.HA || stem.data.HD || "").trim(),
      marketId
    };
  }

  const api = { extractSelectionFromStem, findStemOnNode, nameFromData };
  if (typeof module === "object" && module.exports) module.exports = api;

  if (!scope.document || scope.__SLIP_MATE_HOOK_INSTALLED__) return;
  scope.__SLIP_MATE_HOOK_INSTALLED__ = true;

  function getPotentialParticipant(path) {
    return path.find((node) => {
      if (!(node instanceof Element)) return false;
      return (
        node.classList?.contains("rgl-43895c") ||
        node.classList?.contains("rgl-4a5de5")
      );
    });
  }

  function getStemPotential(path) {
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      const stem = findStemOnNode(node);
      if (isStem(stem) && ("OD" in stem.data || stem.nodeName === "PA")) {
        return getDisplayContext(node).participant || node;
      }
    }
    return null;
  }

  function getDisplayContext(element) {
    if (!(element instanceof Element)) return {};
    const participant = element.classList.contains("rgl-43895c")
      ? element
      : element.closest(".rgl-43895c") || element;
    const oddsElement = participant.matches(".rgl-4a5de5")
      ? participant
      : participant.querySelector(".rgl-4a5de5");

    function visibleText(node, maxLength = 160) {
      const value = cleanLabel(node?.innerText || node?.textContent);
      return value && value.length <= maxLength ? value : "";
    }

    function firstText(container, selectors, maxLength) {
      if (!(container instanceof Element)) return "";
      for (const selector of selectors) {
        for (const node of container.querySelectorAll(selector)) {
          const value = visibleText(node, maxLength);
          if (value) return value;
        }
      }
      return "";
    }

    const decimalOdd = visibleText(oddsElement, 16);
    const explicitSelectionName = firstText(participant, [
      ".srb-ParticipantResponsiveText_Name",
      "[class*='ParticipantResponsiveText_Name']",
      "[class*='ParticipantName']",
      "[class*='Participant_Name']"
    ], 120);
    const participantLines = String(participant.innerText || participant.textContent || "")
      .split(/\r?\n/)
      .map(cleanLabel)
      .filter((value) => value && value !== decimalOdd);
    const selectionName = explicitSelectionName || participantLines[0] || "";

    const marketGroup = participant.closest(
      ".gl-MarketGroupPod, .gl-MarketGroup, [class*='MarketGroup'], [class*='MarketCoupon']"
    );
    const marketName = firstText(marketGroup, [
      ".gl-MarketGroupButton_Text",
      "[class*='MarketGroupButton_Text']",
      "[class*='MarketGroupHeader']",
      "[class*='MarketName']"
    ], 160);

    const fixture = participant.closest(
      "[class*='FixtureDetails'], [class*='MarketCouponFixture'], [class*='EventCard']"
    );
    const teamNames = fixture
      ? [...fixture.querySelectorAll(
        "[class*='TeamName'], [class*='FixtureDetails_Team'], [class*='CompetitorName']"
      )]
        .map((node) => visibleText(node, 100))
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
      : [];
    const eventName = teamNames.length >= 2 ? `${teamNames[0]} v ${teamNames[1]}` : "";

    return { participant, decimalOdd, selectionName, marketName, eventName };
  }

  function resolveSelection(path) {
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      const stem = findStemOnNode(node);
      if (!stem) continue;
      const context = getDisplayContext(node);
      const selection = extractSelectionFromStem(stem, context);
      if (selection) return { selection, element: context.participant || node };
    }
    return null;
  }

  let enabled = false;
  let selectedKeys = new Set();
  let lastHandled = { key: "", at: 0 };
  let lastFailureAt = 0;
  const knownElements = new Map();

  function keyFor(selection) {
    return `${selection.eventId}:${selection.selectionId}`;
  }

  function post(type, payload) {
    scope.postMessage({ source: PAGE_SOURCE, type, payload }, "*");
  }

  function rememberElement(key, element) {
    if (!(element instanceof Element)) return;
    element.setAttribute("data-slip-mate-selection-key", key);
    element.toggleAttribute("data-slip-mate-selected", selectedKeys.has(key));
    if (!knownElements.has(key)) knownElements.set(key, new Set());
    knownElements.get(key).add(element);
  }

  function refreshHighlights() {
    for (const [key, elements] of knownElements) {
      for (const element of elements) {
        if (!element.isConnected) {
          elements.delete(element);
        } else {
          element.toggleAttribute("data-slip-mate-selected", selectedKeys.has(key));
        }
      }
      if (elements.size === 0) knownElements.delete(key);
    }
  }

  function block(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function handleSelectionEvent(event) {
    if (!enabled || event.button > 0) return;

    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    const resolved = resolveSelection(path);
    const potential = resolved?.element || getStemPotential(path) || getPotentialParticipant(path);

    if (!resolved) {
      if (!potential) return;
      block(event);
      const now = Date.now();
      if ((event.type === "pointerdown" || event.type === "click") && now - lastFailureAt > 700) {
        lastFailureAt = now;
        post("BET365_MAPPING_ERROR", {
          code: "unsupportedMarket"
        });
      }
      return;
    }

    block(event);
    const key = keyFor(resolved.selection);
    const now = Date.now();
    const isPrimaryEvent = event.type === "pointerdown" || event.type === "click";
    const isDuplicate = lastHandled.key === key && now - lastHandled.at < 800;

    if (isPrimaryEvent && !isDuplicate) {
      lastHandled = { key, at: now };
      rememberElement(key, resolved.element);
      post("BET365_SELECTION", resolved.selection);
    }
  }

  for (const eventName of ["pointerdown", "mousedown", "mouseup", "click"]) {
    document.addEventListener(eventName, handleSelectionEvent, {
      capture: true,
      passive: false
    });
  }

  scope.addEventListener("message", (event) => {
    if (event.source !== scope || event.data?.source !== CONTENT_SOURCE) return;

    if (event.data.type === "SET_MODE") {
      enabled = event.data.payload?.enabled === true;
      document.documentElement?.setAttribute("data-slip-mate-mode", enabled ? "on" : "off");
      return;
    }

    if (event.data.type === "SET_SELECTED_KEYS") {
      const keys = event.data.payload?.keys;
      selectedKeys = new Set(Array.isArray(keys) ? keys.map(String) : []);
      refreshHighlights();
    }
  });

  post("HOOK_READY", { strategy: "react-stem" });
})(typeof globalThis !== "undefined" ? globalThis : this);
