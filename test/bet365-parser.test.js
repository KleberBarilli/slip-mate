const test = require("node:test");
const assert = require("node:assert/strict");

require("../url-builder.js");
const {
  detectAuthState,
  normalizeSelection,
  parseLegacyBetstring
} = require("../bet365-parser.js");

test("parses the legacy V2 ordering", () => {
  const betstring = [
    "ns=pt=N#o=13/5#f=185360040#fp=40586567#TP=BS185360040-40586567#",
    "pt=N#o=4/5#f=184907548#fp=101274719#TP=BS184907548-101274719#"
  ].join("||");

  assert.deepEqual(
    parseLegacyBetstring(betstring).map(({ eventId, selectionId, fractionalOdd }) => ({
      eventId,
      selectionId,
      fractionalOdd
    })),
    [
      { eventId: "185360040", selectionId: "40586567", fractionalOdd: "13/5" },
      { eventId: "184907548", selectionId: "101274719", fractionalOdd: "4/5" }
    ]
  );
});

test("parses the current normal-bet ordering around TP topics", () => {
  const betstring =
    "ns=pt=N#f=185360040#fp=40586567#c=1#o=13/5#av=1#TP=BS185360040-40586567#||" +
    "pt=N#f=184907548#fp=101274719#c=1#o=4/5#av=1#TP=BS184907548-101274719#";

  const selections = parseLegacyBetstring(betstring);
  assert.equal(selections.length, 2);
  assert.equal(selections[1].fractionalOdd, "4/5");
});

test("keeps every leg when Bet365 omits the topic on same-player lines", () => {
  const betstring =
    "bt=99&ns=pt=N#o=1/16#pv=1/16#f=199940808#fp=1974904555#so=#c=1" +
    "#sa=6a9041a0-83B60A9F#ln=0.5#mt=13#|TP=BS199940808-1974904555#||" +
    "pt=N#o=1/3#pv=1/3#f=199940808#fp=1974904561#so=#c=1" +
    "#sa=6a9041a0-B800DF93#ln=1.5#mt=13#||";

  assert.deepEqual(
    parseLegacyBetstring(betstring).map(({ eventId, selectionId, fractionalOdd }) => ({
      eventId,
      selectionId,
      fractionalOdd
    })),
    [
      { eventId: "199940808", selectionId: "1974904555", fractionalOdd: "1/16" },
      { eventId: "199940808", selectionId: "1974904561", fractionalOdd: "1/3" }
    ]
  );
});

test("normalizes only safe page selections", () => {
  assert.equal(
    normalizeSelection({ eventId: "12", selectionId: "34", fractionalOdd: "6/5" })
      .selectionId,
    "34"
  );
  assert.equal(
    normalizeSelection({ eventId: "12", selectionId: "bad", fractionalOdd: "6/5" }),
    null
  );
  assert.equal(
    normalizeSelection({
      eventId: "12",
      selectionId: "34",
      fractionalOdd: "6/5",
      subjectName: "Matheus Martins"
    }).subjectName,
    "Matheus Martins"
  );
});

test("treats visible login controls as logged out even with a stale betstring", () => {
  assert.equal(
    detectAuthState({
      betstring: "ns=pt=N#o=1/1#f=10#fp=20#TP=BS10-20#",
      buttonTexts: ["Join", "Log In"]
    }),
    "logged-out"
  );
});

test("uses the betstring only when the page has no logged-out controls", () => {
  assert.equal(
    detectAuthState({ betstring: "ns=old-slip", buttonTexts: ["All Sports"] }),
    "logged-in"
  );
  assert.equal(
    detectAuthState({ betstring: "", buttonTexts: ["All Sports"] }),
    "unknown"
  );
});
