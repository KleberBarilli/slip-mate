const test = require("node:test");
const assert = require("node:assert/strict");

let messageListener;
let removedListener;
const memory = {};

global.chrome = {
  storage: {
    session: {
      async get(key) {
        return { [key]: memory[key] };
      },
      async set(value) {
        Object.assign(memory, value);
      }
    }
  },
  runtime: {
    onMessage: {
      addListener(listener) {
        messageListener = listener;
      }
    }
  },
  tabs: {
    async sendMessage() {},
    onRemoved: {
      addListener(listener) {
        removedListener = listener;
      }
    }
  }
};

require("../service-worker.js");

function send(request, tabId = 7) {
  return new Promise((resolve, reject) => {
    const keepAlive = messageListener(request, { tab: { id: tabId } }, resolve);
    if (keepAlive !== true) reject(new Error("Message channel was not kept alive"));
  });
}

test("stores, toggles and clears a slip independently per tab", async () => {
  const selection = {
    eventId: "185360040",
    selectionId: "40586567",
    fractionalOdd: "13/5",
    selectionName: "+1.5",
    teamName: "Arsenal"
  };

  let response = await send({ action: "SLIP_MATE_TOGGLE_SELECTION", selection });
  assert.equal(response.ok, true);
  assert.equal(response.state.selections.length, 1);
  assert.equal(response.state.selections[0].teamName, "Arsenal");

  response = await send({ action: "SLIP_MATE_TOGGLE_SELECTION", selection });
  assert.equal(response.state.selections.length, 0);

  await send({ action: "SLIP_MATE_TOGGLE_SELECTION", selection });
  const otherTab = await send({ action: "SLIP_MATE_GET_STATE" }, 8);
  assert.equal(otherTab.state.selections.length, 0);

  response = await send({ action: "SLIP_MATE_SET_MODE", enabled: false });
  assert.equal(response.state.modeOverride, false);

  response = await send({ action: "SLIP_MATE_CLEAR" });
  assert.equal(response.state.selections.length, 0);

  assert.equal(typeof removedListener, "function");
});
