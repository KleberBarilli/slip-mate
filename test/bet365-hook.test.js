const test = require("node:test");
const assert = require("node:assert/strict");
const { extractSelectionFromStem } = require("../bet365-hook.js");

test("maps a row-aligned odd to the closest fixture side", () => {
  const { closestSideIndex, twoRowSideIndex } = require("../bet365-hook.js");
  assert.equal(closestSideIndex(220, [190, 220]), 1);
  assert.equal(closestSideIndex(190, [190, 220]), 0);
  assert.equal(closestSideIndex(205, [190, 220]), -1);
  assert.equal(twoRowSideIndex(220, [190, 220, 360]), 1);
  assert.equal(twoRowSideIndex(190, [190, 220, 360]), 0);
});

test("extracts Bet365 IDs and native OD from a React stem", () => {
  const fixture = {
    nodeName: "EV",
    data: { FI: "185360040", N1: "Arsenal", N2: "Chelsea" },
    parent: null
  };
  const market = {
    nodeName: "MA",
    data: { ID: "7788", NA: "Match Result", MA: "7788" },
    parent: fixture
  };
  const participant = {
    nodeName: "PA",
    data: { ID: "40586567", OD: "13/5", NA: "Arsenal" },
    parent: market
  };

  assert.deepEqual(extractSelectionFromStem(participant, { decimalOdd: "3.60" }), {
    eventId: "185360040",
    selectionId: "40586567",
    fractionalOdd: "13/5",
    decimalOdd: 3.6,
    selectionName: "Arsenal",
    subjectName: "",
    teamName: "",
    marketName: "Match Result",
    eventName: "Arsenal v Chelsea",
    handicap: "",
    marketId: "7788"
  });
});

test("refuses a stem without the deep-link fields", () => {
  assert.equal(
    extractSelectionFromStem({ data: { ID: "40586567", OD: "13/5" }, parent: null }),
    null
  );
});

test("finds a stem by walking up a React fiber", () => {
  const { findStemOnNode } = require("../bet365-hook.js");
  const stem = { data: { ID: "2", OD: "1/1" } };
  const node = {
    __reactFiber$slipmate: {
      memoizedProps: {},
      return: { memoizedProps: { stem }, return: null }
    }
  };

  assert.equal(findStemOnNode(node), stem);
});

test("refuses suspended selections", () => {
  const fixture = { data: { FI: "10" }, parent: null };
  const participant = {
    data: { ID: "20", OD: "1/1", SU: "1" },
    parent: fixture
  };
  assert.equal(extractSelectionFromStem(participant), null);
});

test("does not mistake a propagated short selection label for the event name", () => {
  const fixture = {
    nodeName: "EV",
    data: { N1: "Arsenal", N2: "Chelsea" },
    parent: null
  };
  const market = {
    nodeName: "MA",
    data: { MA: "7788", NA: "Resultado da partida" },
    parent: fixture
  };
  const participant = {
    nodeName: "PA",
    data: { FI: "185360040", ID: "40586567", OD: "13/10", NA: "1" },
    parent: market
  };

  const selection = extractSelectionFromStem(participant, { decimalOdd: "2.30" });
  assert.equal(selection.selectionName, "1");
  assert.equal(selection.marketName, "Resultado da partida");
  assert.equal(selection.eventName, "Arsenal v Chelsea");
});

test("uses visible page context when ancestry does not expose names", () => {
  const participant = {
    nodeName: "PA",
    data: { FI: "185360040", ID: "40586567", OD: "13/10", NA: "X" },
    parent: null
  };

  const selection = extractSelectionFromStem(participant, {
    decimalOdd: "4.75",
    marketName: "Resultado da partida",
    eventName: "Arsenal v Chelsea"
  });
  assert.equal(selection.marketName, "Resultado da partida");
  assert.equal(selection.eventName, "Arsenal v Chelsea");
});

test("does not replace a visible fixture with an ancestor competition", () => {
  const event = {
    nodeName: "EV",
    data: { FI: "185360040", NA: "Copa do Brasil" },
    parent: null
  };
  const market = {
    nodeName: "MA",
    data: { ID: "7788", NA: "1X2", MA: "7788" },
    parent: event
  };
  const participant = {
    nodeName: "PA",
    data: { ID: "40586567", OD: "17/20", NA: "1" },
    parent: market
  };

  const selection = extractSelectionFromStem(participant, {
    decimalOdd: "1.85",
    marketName: "1X2",
    eventName: "Internacional v Grêmio"
  });

  assert.equal(selection.eventName, "Internacional v Grêmio");
});

test("keeps the player name separate from a generic player market label", () => {
  const fixture = {
    nodeName: "EV",
    data: { FI: "198646827", N1: "Botafogo", N2: "Athletico-PR" },
    parent: null
  };
  const market = {
    nodeName: "MA",
    data: { ID: "7788", NA: "Para Marcar", MA: "7788" },
    parent: fixture
  };
  const participant = {
    nodeName: "PA",
    data: { ID: "91767340254", OD: "7/4", NA: "Para Marcar" },
    parent: market
  };

  const selection = extractSelectionFromStem(participant, {
    decimalOdd: "2.75",
    subjectName: "Matheus Martins",
    marketName: "Para Marcar",
    eventName: "Botafogo v Athletico-PR"
  });

  assert.equal(selection.subjectName, "Matheus Martins");
  assert.equal(selection.selectionName, "Para Marcar");
  assert.equal(selection.marketName, "Para Marcar");
});

test("keeps a team name separate from its handicap line", () => {
  const fixture = {
    nodeName: "EV",
    data: { FI: "198646900", N1: "Leviatan", N2: "MIBR" },
    parent: null
  };
  const participant = {
    nodeName: "PA",
    data: { ID: "91767349999", OD: "1/2", NA: "+1.5" },
    parent: fixture
  };

  const selection = extractSelectionFromStem(participant, {
    decimalOdd: "1.50",
    selectionName: "+1.5",
    teamName: "MIBR",
    marketName: "Handicap",
    eventName: "Leviatan v MIBR"
  });

  assert.equal(selection.teamName, "MIBR");
  assert.equal(selection.selectionName, "+1.5");
  assert.equal(selection.eventName, "Leviatan v MIBR");
});

test("maps an unlabeled team row after the stem supplies the fixture names", () => {
  const fixture = {
    nodeName: "EV",
    data: { FI: "198646900", N1: "Leviatan", N2: "MIBR" },
    parent: null
  };
  const market = {
    nodeName: "MA",
    data: { ID: "7789", MA: "7789", NA: "To Win" },
    parent: fixture
  };
  const participant = {
    nodeName: "PA",
    data: { ID: "91767350000", OD: "3/2", NA: "To Win" },
    parent: market
  };

  const selection = extractSelectionFromStem(participant, {
    decimalOdd: "2.50",
    selectionName: "To Win",
    marketName: "To Win",
    sideIndex: 1
  });

  assert.equal(selection.teamName, "MIBR");
  assert.equal(selection.eventName, "Leviatan v MIBR");
});

test("prefers a visible player threshold over a propagated market name", () => {
  const fixture = { data: { FI: "198646827" }, parent: null };
  const participant = {
    nodeName: "PA",
    data: { ID: "91767340254", OD: "3/2", NA: "Chutes" },
    parent: fixture
  };

  const selection = extractSelectionFromStem(participant, {
    selectionName: "2+",
    subjectName: "Matheus Martins",
    marketName: "Chutes"
  });

  assert.equal(selection.selectionName, "2+");
  assert.equal(selection.subjectName, "Matheus Martins");
});

test("requires a visible selection or subject label", () => {
  const { hasUsableSelectionLabel } = require("../bet365-hook.js");
  assert.equal(hasUsableSelectionLabel({ selectionName: "" }), false);
  assert.equal(hasUsableSelectionLabel({ selectionName: "X" }), true);
  assert.equal(hasUsableSelectionLabel({ subjectName: "Matheus Martins" }), true);
  assert.equal(hasUsableSelectionLabel({
    selectionName: "1",
    marketName: "1X2",
    eventName: "Copa do Brasil"
  }), false);
  assert.equal(hasUsableSelectionLabel({
    selectionName: "1",
    marketName: "1X2",
    eventName: "Internacional v Grêmio"
  }), true);
});
