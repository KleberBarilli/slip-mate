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
