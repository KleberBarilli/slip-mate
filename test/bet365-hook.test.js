const test = require("node:test");
const assert = require("node:assert/strict");
const { extractSelectionFromStem } = require("../bet365-hook.js");

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
});
