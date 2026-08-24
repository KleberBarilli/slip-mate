const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildBet365Url,
  fractionalToDecimal,
  getCombinedDecimal
} = require("../url-builder.js");

test("builds the existing Brazil deep-link format", () => {
  assert.equal(
    buildBet365Url([
      {
        eventId: "185360040",
        selectionId: "40586567",
        fractionalOdd: "13/5"
      }
    ]),
    "https://www.bet365.bet.br/dl/sportsbookredirect?bet=1&bs=%7C185360040-40586567~13/5"
  );
});

test("builds a multiple without double encoding separators", () => {
  assert.equal(
    buildBet365Url([
      { eventId: "185360040", selectionId: "40586567", fractionalOdd: "13/5" },
      { eventId: "184907548", selectionId: "101274719", fractionalOdd: "4/5" }
    ]),
    "https://www.bet365.bet.br/dl/sportsbookredirect?bet=1&bs=%7C185360040-40586567~13/5%7C184907548-101274719~4/5"
  );
});

test("converts and combines fractional odds", () => {
  assert.equal(fractionalToDecimal("13/5"), 3.6);
  assert.equal(getCombinedDecimal([
    { fractionalOdd: "13/5" },
    { fractionalOdd: "4/5" }
  ]), 6.48);
});

test("rejects incomplete selections", () => {
  assert.throws(
    () => buildBet365Url([{ eventId: "1", selectionId: "2", fractionalOdd: "" }]),
    /identificadores/
  );
});
