const test = require("node:test");
const assert = require("node:assert/strict");

require("../i18n.js");
const {
  displayContext,
  displayEvent,
  displayMarket,
  displayName
} = require("../slip-ui.js");

test("expands 1X2 labels when fixture and result market names are available", () => {
  const selection = {
    selectionId: "10",
    selectionName: "1",
    marketName: "Resultado da partida",
    eventName: "Arsenal v Chelsea"
  };

  assert.equal(displayName(selection), "Arsenal");
  assert.equal(displayName({ ...selection, selectionName: "X" }), "Empate");
  assert.equal(displayName({ ...selection, selectionName: "2" }), "Chelsea");
  assert.equal(
    displayName({ ...selection, marketName: "1X2", selectionName: "1" }),
    "Arsenal"
  );
});

test("keeps market, selection and fixture as separate ticket fields", () => {
  const selection = {
    selectionName: "1",
    marketName: "1X2",
    eventName: "Internacional v Grêmio"
  };

  assert.equal(displayMarket(selection), "1X2");
  assert.equal(displayName(selection), "Internacional");
  assert.equal(displayEvent(selection), "Internacional v Grêmio");
});

test("shows the team together with a handicap line", () => {
  const selection = {
    teamName: "MIBR",
    selectionName: "+1.5",
    marketName: "Handicap",
    eventName: "Leviatan v MIBR"
  };

  assert.equal(displayName(selection), "MIBR +1.5");
  assert.equal(displayMarket(selection), "Handicap");
  assert.equal(displayEvent(selection), "Leviatan v MIBR");
});

test("separates an unlabeled team winner from its market", () => {
  const selection = {
    selectionName: "To Win",
    teamName: "MIBR",
    marketName: "",
    eventName: "Leviatan v MIBR"
  };
  assert.equal(displayName(selection), "MIBR");
  assert.equal(displayMarket(selection), "To Win");
  assert.equal(displayEvent(selection), "Leviatan v MIBR");
});

test("expands abbreviated over and under selections", () => {
  assert.equal(displayName({ selectionName: "O 2.5", marketName: "Total Maps" }), "Mais de 2.5");
  assert.equal(displayName({ selectionName: "U 2.5", marketName: "Total Maps" }), "Menos de 2.5");
});

test("does not present a competition name as the match", () => {
  assert.equal(displayEvent({
    selectionName: "1",
    marketName: "1X2",
    eventName: "Copa do Brasil"
  }), "");
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

test("shows the player as the primary label and the market as context", () => {
  const selection = {
    selectionId: "30",
    selectionName: "Para Marcar",
    subjectName: "Matheus Martins",
    marketName: "Para Marcar",
    eventName: "Botafogo v Athletico-PR"
  };

  assert.equal(displayName(selection), "Matheus Martins");
  assert.equal(
    displayContext(selection),
    "Para Marcar · Botafogo v Athletico-PR"
  );
});

test("keeps a player threshold in the primary label", () => {
  const selection = {
    selectionId: "31",
    selectionName: "2+",
    subjectName: "Matheus Martins",
    marketName: "Chutes no gol",
    eventName: "Botafogo v Athletico-PR"
  };

  assert.equal(displayName(selection), "Matheus Martins — 2+");
  assert.equal(
    displayContext(selection),
    "Chutes no gol · Botafogo v Athletico-PR"
  );
});
