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

  function hasFixtureSides(value) {
    return cleanLabel(value)
      .split(/\s+(?:v|vs\.?|x|@|-|–|—)\s+/i)
      .filter(Boolean).length === 2;
  }

  function closestSideIndex(participantCenter, teamCenters) {
    if (!Number.isFinite(participantCenter) || teamCenters?.length !== 2) return -1;
    const distances = teamCenters.map((center) =>
      Number.isFinite(center) ? Math.abs(participantCenter - center) : Infinity
    );
    if (!Number.isFinite(distances[0]) || !Number.isFinite(distances[1])) return -1;
    if (Math.abs(distances[0] - distances[1]) < 2) return -1;
    return distances[0] < distances[1] ? 0 : 1;
  }

  function twoRowSideIndex(participantCenter, rowCenters, maxDistance = 70) {
    if (!Number.isFinite(participantCenter) || !Array.isArray(rowCenters)) return -1;
    const nearby = rowCenters
      .filter(Number.isFinite)
      .filter((center) => Math.abs(center - participantCenter) <= maxDistance)
      .filter((center, index, values) =>
        values.findIndex((value) => Math.abs(value - center) < 2) === index
      )
      .sort((left, right) => left - right);
    if (nearby.length !== 2 || Math.abs(nearby[1] - nearby[0]) < 2) return -1;
    return Math.abs(participantCenter - nearby[0]) <
      Math.abs(participantCenter - nearby[1]) ? 0 : 1;
  }

  function isUsefulContextLabel(value, selectionName) {
    const label = cleanLabel(value);
    if (!label || label === cleanLabel(selectionName)) return false;
    return !/^\d+(?:[.,]\d+)?$/.test(label);
  }

  function hasUsableSelectionLabel(selection) {
    const label = cleanLabel(
      selection?.subjectName || selection?.teamName ||
      selection?.selectionName || selection?.handicap
    );
    if (!label) return false;

    const isShortResult = /^(?:1|x|2)$/i.test(label) &&
      /resultado|match result|full[- ]time result|moneyline|vencedor|winner|1x2/i
        .test(cleanLabel(selection?.marketName));
    return !isShortResult || hasFixtureSides(selection?.eventName);
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
    const subjectName = cleanLabel(context.subjectName);
    const contextTeamName = cleanLabel(context.teamName);
    const visibleSelectionName = cleanLabel(context.selectionName);
    const selectionName = cleanLabel(
      (subjectName || contextTeamName) && visibleSelectionName
        ? visibleSelectionName
        : stem.data.NA || visibleSelectionName
    );
    let eventName = cleanLabel(context.eventName);
    let marketName = cleanLabel(context.marketName);
    let marketId = "";
    // A fixture read from the visible coupon is more reliable than a generic
    // React ancestor. Some event stems expose only the competition as NA.
    let eventNameRank = hasFixtureSides(eventName) ? 4 : eventName ? 1 : 0;
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
          hasFixtureSides(candidateName) &&
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

    const eventSides = eventName
      .split(/\s+(?:v|vs\.?|x|@|-|–|—)\s+/i)
      .map(cleanLabel)
      .filter(Boolean);
    const usesTeamLine =
      /handicap|spread|to win|winner|moneyline|match betting|draw no bet|vencedor/i
        .test(`${marketName} ${selectionName}`) ||
      /^[+-]\s*\d/.test(selectionName);
    const sideIndex = Number(context.sideIndex);
    const teamName = contextTeamName || (
      !subjectName &&
      usesTeamLine &&
      Number.isInteger(sideIndex) &&
      sideIndex >= 0 &&
      sideIndex < eventSides.length
        ? eventSides[sideIndex]
        : ""
    );
    const decimalOdd = Number.parseFloat(String(context.decimalOdd || "").replace(",", "."));
    return {
      eventId,
      selectionId,
      fractionalOdd,
      decimalOdd: Number.isFinite(decimalOdd) && decimalOdd > 1 ? decimalOdd : null,
      selectionName,
      subjectName,
      teamName,
      marketName,
      eventName,
      handicap: String(stem.data.HA || stem.data.HD || "").trim(),
      marketId
    };
  }

  const api = {
    closestSideIndex,
    extractSelectionFromStem,
    findStemOnNode,
    hasFixtureSides,
    hasUsableSelectionLabel,
    nameFromData,
    twoRowSideIndex
  };
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

  function getDisplayContext(element, pointer = {}) {
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

    function playerNameNodes(container) {
      if (!(container instanceof Element)) return [];
      const paragraphs = [...container.querySelectorAll("p")].filter((node) => {
        const value = visibleText(node, 100);
        return value && /\p{L}/u.test(value);
      });
      if (paragraphs.length > 0) return paragraphs;

      const playerHeader = [...container.querySelectorAll("*")].find((node) =>
        node.children.length === 0 &&
        /^(?:player|jogador)\s*\/\s*(?:last|últim)/i.test(visibleText(node, 100))
      );
      let list = playerHeader?.parentElement;
      let depth = 0;

      while (list instanceof Element && depth < 4) {
        const names = [...list.children].map((row) =>
          [...row.querySelectorAll("span, p, div")].find((node) => {
            const value = node.children.length === 0 ? visibleText(node, 100) : "";
            return value &&
              /\p{L}/u.test(value) &&
              value.toLocaleUpperCase() !== "N/A" &&
              !/^(?:player|jogador)\s*\//i.test(value);
          })
        ).filter(Boolean);
        if (names.length > 0) return names;
        list = list.parentElement;
        depth += 1;
      }

      return [];
    }

    function findPlayerCard() {
      let cursor = participant;
      let depth = 0;

      while (cursor && depth < 12) {
        const hasPlayerModuleClass = [...cursor.classList]
          .some((className) => /^(?:plr|prp|rrb|rrd)-/.test(className));
        if (!hasPlayerModuleClass) {
          cursor = cursor.parentElement;
          depth += 1;
          continue;
        }
        const tabGroups = new Map();

        for (const tab of cursor.querySelectorAll("[data-content]")) {
          if (!(tab.parentElement instanceof Element)) continue;
          if (!tabGroups.has(tab.parentElement)) tabGroups.set(tab.parentElement, []);
          tabGroups.get(tab.parentElement).push(tab);
        }

        const hasMarketTabs = [...tabGroups.values()].some((tabs) => tabs.length >= 2);
        const hasPlayerHeader = [...cursor.querySelectorAll("*")].some((node) =>
          node.children.length === 0 &&
          /^(?:player|jogador)\s*\/\s*(?:last|últim)/i.test(visibleText(node, 100))
        );
        if (
          hasPlayerModuleClass &&
          (hasMarketTabs || hasPlayerHeader) &&
          playerNameNodes(cursor).length > 0 &&
          cursor.querySelectorAll(".rgl-43895c").length > 0
        ) {
          return cursor;
        }

        cursor = cursor.parentElement;
        depth += 1;
      }

      return null;
    }

    function activePlayerMarket(card) {
      if (!(card instanceof Element)) return "";
      const tabGroups = new Map();

      for (const tab of card.querySelectorAll("[data-content]")) {
        if (!(tab.parentElement instanceof Element)) continue;
        if (!tabGroups.has(tab.parentElement)) tabGroups.set(tab.parentElement, []);
        tabGroups.get(tab.parentElement).push(tab);
      }

      for (const tabs of tabGroups.values()) {
        if (tabs.length < 2) continue;
        const classCounts = tabs.map((tab) => tab.classList.length);
        const maxClassCount = Math.max(...classCounts);
        const minClassCount = Math.min(...classCounts);
        if (maxClassCount === minClassCount) continue;
        const active = tabs.find((tab) => tab.classList.length === maxClassCount);
        const value = visibleText(active, 100) || cleanLabel(active?.dataset.content);
        if (value) return value;
      }

      return "";
    }

    function eventNameFromContainer(container) {
      if (!container?.querySelectorAll) return "";

      for (const separator of container.querySelectorAll("span, div")) {
        if (separator.children.length > 0) continue;
        if (!/^(?:v|vs\.?|x)$/i.test(visibleText(separator, 8))) continue;
        const siblings = [...(separator.parentElement?.children || [])];
        const separatorIndex = siblings.indexOf(separator);
        const before = siblings
          .slice(0, separatorIndex)
          .reverse()
          .map((node) => visibleText(node, 100))
          .find((value) => value && /\p{L}/u.test(value));
        const after = siblings
          .slice(separatorIndex + 1)
          .map((node) => visibleText(node, 100))
          .find((value) => value && /\p{L}/u.test(value));
        if (before && after) return `${before} v ${after}`;
      }

      return "";
    }

    function siblingSelectionName() {
      if (!(participant.parentElement instanceof Element)) return "";
      return [...participant.parentElement.children]
        .filter((node) => node !== participant && !node.matches(".rgl-43895c"))
        .map((node) => visibleText(node, 100))
        .find((value) => value && value !== decimalOdd) || "";
    }

    function isCompetitorLabel(value) {
      const label = cleanLabel(value);
      if (!label || !/\p{L}/u.test(label) || label.toLocaleUpperCase() === "N/A") {
        return false;
      }
      if (/^(?:mon|tue|wed|thu|fri|sat|sun|seg|ter|qua|qui|sex|sáb|sab|dom)\b/i.test(label)) {
        return false;
      }
      return !/^(?:to win|vencedor|winner|moneyline|handicap|spread|total(?: maps| goals| points| games| sets)?|map total|game total|match result|resultado(?: da partida)?|1x2|over|under|mais de|menos de|yes|no|sim|não)$/i
        .test(label);
    }

    function uniqueCompetitorLabels(container) {
      if (!(container instanceof Element)) return [];
      const nodes = container.children.length === 0
        ? [container]
        : [...container.querySelectorAll("span, p, div")]
          .filter((node) => node.children.length === 0);
      return nodes
        .filter((node) => !node.closest(".rgl-43895c"))
        .map((node) => visibleText(node, 100))
        .filter(isCompetitorLabel)
        .filter((value, index, values) => values.indexOf(value) === index);
    }

    function teamPairFromContainer(container) {
      if (!(container instanceof Element)) return [];

      const strongNames = [...container.querySelectorAll(
        "[class*='TeamName'], [class*='FixtureDetails_Team'], [class*='CompetitorName']"
      )]
        .map((node) => visibleText(node, 100))
        .filter(isCompetitorLabel)
        .filter((value, index, values) => values.indexOf(value) === index);
      if (strongNames.length === 2) return strongNames;

      const branches = [container, ...container.querySelectorAll("div, section, article, li")]
        .filter((node) => !node.contains(participant))
        .filter((node) => node.querySelectorAll(".rgl-43895c").length === 0)
        .map((node) => ({
          labels: uniqueCompetitorLabels(node),
          size: node.querySelectorAll("*").length
        }))
        .filter((candidate) => candidate.labels.length === 2)
        .sort((left, right) => left.size - right.size);
      return branches[0]?.labels || [];
    }

    function selectionSideIndex(boundary, teamNames = []) {
      let orderedFallback = -1;
      let cursor = participant.parentElement;
      while (cursor && cursor !== boundary.parentElement) {
        const participants = [...cursor.querySelectorAll(".rgl-43895c")];
        const index = participants.findIndex((node) =>
          node === participant ||
          node.contains(participant) ||
          participant.contains(node)
        );
        if (participants.length === 2 && index >= 0) return index;
        if (
          orderedFallback < 0 &&
          index >= 0 &&
          participants.length > 2 &&
          participants.length % 2 === 0
        ) {
          orderedFallback = index % 2;
        }
        if (cursor === boundary) break;
        cursor = cursor.parentElement;
      }

      const participantRect = participant.getBoundingClientRect?.();
      if (
        participantRect &&
        participantRect.height > 0 &&
        teamNames.length === 2
      ) {
        const participantY = participantRect.top + participantRect.height / 2;
        const distances = teamNames.map((teamName) => {
          const matchingNodes = [...boundary.querySelectorAll("span, p, div")]
            .filter((node) => !node.closest(".rgl-43895c"))
            .filter((node) => visibleText(node, 100) === teamName)
            .map((node) => node.getBoundingClientRect?.())
            .filter((rect) => rect && rect.height > 0)
            .map((rect) => Math.abs(participantY - (rect.top + rect.height / 2)));
          return matchingNodes.length ? Math.min(...matchingNodes) : Infinity;
        });
        if (Number.isFinite(distances[0]) && Number.isFinite(distances[1])) {
          return distances[0] <= distances[1] ? 0 : 1;
        }
      }

      return orderedFallback;
    }

    function pageGeometrySideIndex(teamNames) {
      const participantRect = participant.getBoundingClientRect?.();
      if (!participantRect || participantRect.height <= 0 || teamNames.length !== 2) {
        return -1;
      }

      const participantCenter = participantRect.top + participantRect.height / 2;
      const teamCenters = teamNames.map((teamName) => {
        const distances = [...scope.document.querySelectorAll("span, p, div")]
          .filter((node) => !node.closest(".rgl-43895c"))
          .filter((node) => visibleText(node, 100) === teamName)
          .map((node) => node.getBoundingClientRect?.())
          .filter((rect) => rect && rect.height > 0)
          .map((rect) => rect.top + rect.height / 2)
          .sort((left, right) =>
            Math.abs(left - participantCenter) - Math.abs(right - participantCenter)
          );
        return distances[0];
      });

      return closestSideIndex(participantCenter, teamCenters);
    }

    function participantColumnSideIndex() {
      const participantRect = participant.getBoundingClientRect?.();
      if (!participantRect || participantRect.height <= 0 || participantRect.width <= 0) {
        return -1;
      }
      const participantCenter = participantRect.top + participantRect.height / 2;
      const rowCenters = [...scope.document.querySelectorAll(".rgl-43895c")]
        .map((node) => node.getBoundingClientRect?.())
        .filter((rect) => rect && rect.height > 0 && rect.width > 0)
        .filter((rect) => {
          const overlap = Math.max(0,
            Math.min(rect.right, participantRect.right) -
            Math.max(rect.left, participantRect.left)
          );
          return overlap >= Math.min(rect.width, participantRect.width) * 0.75;
        })
        .map((rect) => rect.top + rect.height / 2);
      return twoRowSideIndex(participantCenter, rowCenters);
    }

    function pointerCompetitorSideIndex() {
      const pointerX = Number(pointer.x);
      const pointerY = Number(pointer.y);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return -1;

      const candidates = [...scope.document.querySelectorAll("span, p, div")]
        .filter((node) => node.children.length === 0)
        .map((node) => ({
          label: visibleText(node, 100),
          rect: node.getBoundingClientRect?.()
        }))
        .filter(({ label, rect }) =>
          isCompetitorLabel(label) &&
          rect && rect.height > 0 && rect.width > 0 &&
          rect.right < pointerX - 20 &&
          pointerX - rect.right < 750 &&
          Math.abs((rect.top + rect.height / 2) - pointerY) <= 70
        )
        .sort((left, right) => right.rect.right - left.rect.right);
      if (candidates.length < 2) return -1;

      const nearestRight = candidates[0].rect.right;
      const rowCenters = candidates
        .filter(({ rect }) => nearestRight - rect.right < 80)
        .map(({ rect }) => rect.top + rect.height / 2);
      return twoRowSideIndex(pointerY, rowCenters);
    }

    function couponContext() {
      let cursor = participant;
      let depth = 0;
      let sideIndex = -1;

      while (cursor && depth < 10) {
        const headers = [...cursor.querySelectorAll("header")]
          .map((node) => visibleText(node, 20).toLocaleUpperCase());
        const participants = cursor.querySelectorAll(".rgl-43895c");
        if (participants.length >= 2) {
          const candidateSideIndex = selectionSideIndex(cursor);
          if (sideIndex < 0 && candidateSideIndex >= 0) sideIndex = candidateSideIndex;
          const teams = teamPairFromContainer(cursor);
          if (teams.length === 2) {
            const isThreeWay = headers.includes("1") &&
              headers.includes("X") && headers.includes("2");
            return {
              marketName: isThreeWay ? "1X2" : "",
              eventName: `${teams[0]} v ${teams[1]}`,
              teamNames: teams,
              sideIndex: selectionSideIndex(cursor, teams)
            };
          }
        }
        if (headers.includes("1") && headers.includes("X") && headers.includes("2")) {
          return {
            marketName: "1X2",
            eventName: "",
            teamNames: [],
            sideIndex: -1
          };
        }
        cursor = cursor.parentElement;
        depth += 1;
      }

      return { marketName: "", eventName: "", teamNames: [], sideIndex };
    }

    function standardMarketName() {
      let cursor = participant;
      let depth = 0;

      while (cursor && depth < 9) {
        const isRenderedMarket = [...cursor.classList]
          .some((className) => /^rrb-/.test(className));
        if (isRenderedMarket && cursor.querySelectorAll(".rgl-43895c").length > 0) {
          const candidate = [...cursor.querySelectorAll("span")]
            .filter((node) => !node.closest(".rgl-43895c"))
            .map((node) => visibleText(node, 160))
            .find((value) => value && /\p{L}/u.test(value));
          if (candidate) return candidate;
        }
        cursor = cursor.parentElement;
        depth += 1;
      }

      return "";
    }

    function playerDetails(card) {
      if (!(card instanceof Element)) return { subjectName: "", marketName: "" };
      const names = playerNameNodes(card);
      const activeMarket = activePlayerMarket(card);
      const meaningfulMarket = /^(?:main|principal)$/i.test(activeMarket)
        ? ""
        : activeMarket;
      let cursor = participant;

      while (cursor && cursor !== card) {
        const rowNames = playerNameNodes(cursor);
        if (
          rowNames.length === 1 &&
          cursor.querySelectorAll(".rgl-43895c").length > 0
        ) {
          return {
            subjectName: visibleText(rowNames[0], 100),
            marketName: meaningfulMarket
          };
        }
        cursor = cursor.parentElement;
      }

      const column = participant.parentElement;
      const columnChildren = column ? [...column.children] : [];
      const participantIndex = columnChildren.indexOf(participant);
      const headerCount = columnChildren.length - names.length;

      if (
        participantIndex >= 0 &&
        headerCount >= 0 &&
        headerCount <= 3 &&
        participantIndex >= headerCount
      ) {
        const rowIndex = participantIndex - headerCount;
        const columnHeader = columnChildren
          .slice(0, headerCount)
          .map((node) => visibleText(node, 100))
          .find((value) => value && /\p{L}/u.test(value));
        return {
          subjectName: visibleText(names[rowIndex], 100),
          marketName: columnHeader || meaningfulMarket
        };
      }

      return {
        subjectName: "",
        marketName: meaningfulMarket
      };
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
      .map((value) => value.endsWith(` ${decimalOdd}`)
        ? cleanLabel(value.slice(0, -decimalOdd.length))
        : value)
      .filter((value) => value && value !== decimalOdd);
    const selectionName = explicitSelectionName || participantLines[0] || siblingSelectionName();

    const playerCard = findPlayerCard();
    const player = playerDetails(playerCard);
    const coupon = couponContext();

    const marketGroup = participant.closest(
      ".gl-MarketGroupPod, .gl-MarketGroup, [class*='MarketGroup'], [class*='MarketCoupon']"
    );
    const marketName = player.marketName || coupon.marketName || standardMarketName() || firstText(marketGroup, [
      ".gl-MarketGroupButton_Text",
      "[class*='MarketGroupButton_Text']",
      "[class*='MarketGroupHeader']",
      "[class*='MarketName']"
    ], 160);

    const fixture = participant.closest(
      "[class*='FixtureDetails'], [class*='MarketCouponFixture'], [class*='EventCard']"
    );
    const fixtureTeamNames = fixture
      ? [...fixture.querySelectorAll(
        "[class*='TeamName'], [class*='FixtureDetails_Team'], [class*='CompetitorName']"
      )]
        .map((node) => visibleText(node, 100))
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
      : [];
    const teamNames = coupon.teamNames.length === 2
      ? coupon.teamNames
      : fixtureTeamNames;
    const eventName = eventNameFromContainer(playerCard) || coupon.eventName ||
      (teamNames.length >= 2 ? `${teamNames[0]} v ${teamNames[1]}` : "") ||
      (/\/E\d+\//.test(scope.location?.hash || "")
        ? eventNameFromContainer(scope.document)
        : "");
    const usesTeamLine =
      /handicap|spread|to win|winner|moneyline|match betting|draw no bet|vencedor/i
        .test(`${marketName} ${selectionName}`) ||
      /^[+-]\s*\d/.test(selectionName) ||
      !selectionName;
    const visualSideIndex = usesTeamLine ? pageGeometrySideIndex(teamNames) : -1;
    const columnSideIndex = usesTeamLine ? participantColumnSideIndex() : -1;
    const pointerSideIndex = usesTeamLine ? pointerCompetitorSideIndex() : -1;
    const structuralSideIndex = usesTeamLine
      ? selectionSideIndex(scope.document.documentElement)
      : -1;
    const sideIndex = pointerSideIndex >= 0
      ? pointerSideIndex
      : visualSideIndex >= 0
        ? visualSideIndex
        : columnSideIndex >= 0
          ? columnSideIndex
          : coupon.sideIndex >= 0
            ? coupon.sideIndex
            : structuralSideIndex;
    const teamName = !player.subjectName && usesTeamLine &&
      sideIndex >= 0 && sideIndex < teamNames.length
      ? teamNames[sideIndex]
      : "";

    return {
      participant,
      decimalOdd,
      selectionName,
      subjectName: player.subjectName,
      teamName,
      marketName,
      eventName,
      sideIndex,
      playerMarket: Boolean(playerCard)
    };
  }

  function resolveSelection(path, pointer) {
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      const stem = findStemOnNode(node);
      if (!stem) continue;
      const context = getDisplayContext(node, pointer);
      const selection = extractSelectionFromStem(stem, context);
      if (selection) {
        const errorCode =
          (context.playerMarket && !selection.subjectName) ||
          !hasUsableSelectionLabel(selection)
            ? "selectionLabelUnavailable"
            : "";
        return {
          selection,
          element: context.participant || node,
          errorCode
        };
      }
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
    const resolved = resolveSelection(path, {
      x: event.clientX,
      y: event.clientY
    });
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

    if (resolved.errorCode) {
      block(event);
      const now = Date.now();
      if ((event.type === "pointerdown" || event.type === "click") && now - lastFailureAt > 700) {
        lastFailureAt = now;
        post("BET365_MAPPING_ERROR", { code: resolved.errorCode });
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
