const test = require("node:test");
const assert = require("node:assert/strict");

require("../i18n.js");
const { displayContext, displayName } = require("../slip-ui.js");

test("expands 1X2 labels when fixture and result market names are available", () => {
  const selection = {
    selectionId: "10",
    selectionName: "1",
    marketName: "Resultado da partida",
    eventName: "Arsenal v Chelsea"
  };

  assert.equal(displayName(selection), "Arsenal (1)");
  assert.equal(displayName({ ...selection, selectionName: "X" }), "Empate (X)");
  assert.equal(displayName({ ...selection, selectionName: "2" }), "Chelsea (2)");
});

test("shows market and event together without repeating a short selection", () => {
  assert.equal(
    displayContext({
      selectionName: "1",
      marketName: "Resultado da partida",
      eventName: "Arsenal v Chelsea"
    }),
    "Resultado da partida · Arsenal v Chelsea"
  );

  assert.equal(
    displayContext({ selectionName: "1", marketName: "1", eventName: "1" }),
    "Mercado Bet365"
  );
});

test("adds a missing handicap to the visible selection name", () => {
  assert.equal(
    displayName({ selectionId: "20", selectionName: "Mais de", handicap: "2.5" }),
    "Mais de 2.5"
  );
});
