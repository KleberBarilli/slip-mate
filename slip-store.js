(function attachSlipStore(root) {
  function send(action, payload = {}) {
    return chrome.runtime.sendMessage({ action, ...payload }).then((response) => {
      if (!response?.ok) {
        throw new Error(
          response?.error || root.SlipMateI18n?.getMessage(
            "updateStateFailed",
            undefined,
            "Não foi possível atualizar o Slip Mate."
          ) || "Não foi possível atualizar o Slip Mate."
        );
      }
      return response.state;
    });
  }

  root.SlipMateStore = {
    getState(tabId) {
      return send("SLIP_MATE_GET_STATE", Number.isInteger(tabId) ? { tabId } : {});
    },
    toggle(selection) {
      return send("SLIP_MATE_TOGGLE_SELECTION", { selection });
    },
    remove(key, tabId) {
      return send("SLIP_MATE_REMOVE_SELECTION", {
        key,
        ...(Number.isInteger(tabId) ? { tabId } : {})
      });
    },
    clear(tabId) {
      return send("SLIP_MATE_CLEAR", Number.isInteger(tabId) ? { tabId } : {});
    },
    setMode(enabled, tabId) {
      return send("SLIP_MATE_SET_MODE", {
        enabled,
        ...(Number.isInteger(tabId) ? { tabId } : {})
      });
    },
    setContext(authState) {
      return send("SLIP_MATE_SET_CONTEXT", { authState });
    },
    setMappingError(message) {
      return send("SLIP_MATE_MAPPING_ERROR", { message });
    }
  };
})(globalThis);
