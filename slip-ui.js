(function attachSlipMateUI(root) {
  const HOST_ID = "slip-mate-v3-host";
  const t = (key, substitutions, fallback) =>
    root.SlipMateI18n?.getMessage(key, substitutions, fallback) || fallback;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function displayName(selection) {
    return selection.selectionName || selection.marketName || t(
      "selectionFallback",
      String(selection.selectionId),
      `Seleção ${selection.selectionId}`
    );
  }

  function create(callbacks = {}) {
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "closed" });
    let collapsed = false;
    let currentState = { selections: [], visible: false, mappingError: "" };
    let toastTimer;

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          z-index: 2147483646;
          right: 20px;
          bottom: 20px;
          width: min(344px, calc(100vw - 28px));
          color: #17221d;
          font-family: "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
        }
        * { box-sizing: border-box; }
        button { font: inherit; }
        .ticket {
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 14px;
          background: #f5f6ef;
          box-shadow: 0 22px 60px rgba(0,0,0,.38), 0 2px 8px rgba(0,0,0,.24);
        }
        .ticket[hidden] { display: none; }
        .rail {
          height: 5px;
          background: linear-gradient(90deg, #f4d23c 0 18%, #147a5e 18% 100%);
        }
        .header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 14px 12px;
          background: #103d31;
          color: #fff;
        }
        .mark {
          display: grid;
          width: 34px;
          height: 34px;
          place-items: center;
          border: 1px solid rgba(255,255,255,.34);
          border-radius: 9px;
          color: #f4d23c;
          font: 800 13px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
          letter-spacing: -.04em;
        }
        .title { min-width: 0; flex: 1; }
        .title strong { display: block; font-size: 15px; letter-spacing: -.01em; }
        .title span { display: block; margin-top: 2px; color: #b9d2c8; font-size: 11px; }
        .collapse {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border: 0;
          border-radius: 8px;
          background: rgba(255,255,255,.09);
          color: #fff;
          cursor: pointer;
        }
        .collapse:hover { background: rgba(255,255,255,.16); }
        .collapse:focus-visible, .action:focus-visible, .remove:focus-visible {
          outline: 3px solid #f4d23c;
          outline-offset: 2px;
        }
        .body { padding: 0 14px 14px; }
        .ticket.collapsed .body { display: none; }
        .mode {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 0;
          border-bottom: 1px solid #dce2da;
          color: #516159;
          font-size: 11px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .live { display: inline-flex; align-items: center; gap: 7px; color: #12684f; }
        .live::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #20ad7d;
          box-shadow: 0 0 0 4px rgba(32,173,125,.12);
        }
        .items {
          max-height: 260px;
          margin: 0;
          padding: 0;
          overflow: auto;
          list-style: none;
        }
        .item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          gap: 10px;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px dashed #cbd4cc;
        }
        .item-copy { min-width: 0; }
        .item-name {
          overflow: hidden;
          color: #17221d;
          font-size: 13px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .item-context {
          overflow: hidden;
          margin-top: 3px;
          color: #718078;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .odd {
          color: #103d31;
          font: 800 13px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
        }
        .remove {
          width: 26px;
          height: 26px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #738078;
          cursor: pointer;
        }
        .remove:hover { background: #e5e9e2; color: #9d2f36; }
        .empty {
          padding: 22px 6px 20px;
          color: #617068;
          font-size: 12px;
          line-height: 1.5;
          text-align: center;
        }
        .summary {
          display: flex;
          align-items: end;
          justify-content: space-between;
          padding: 13px 0 12px;
        }
        .summary span { color: #65736c; font-size: 11px; }
        .summary strong {
          color: #103d31;
          font: 850 24px/.9 ui-monospace, SFMono-Regular, Consolas, monospace;
          letter-spacing: -.06em;
        }
        .actions { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
        .action {
          min-height: 42px;
          border: 0;
          border-radius: 9px;
          padding: 0 14px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
        }
        .copy { background: #103d31; color: #fff; }
        .copy:hover { background: #185844; }
        .clear { background: #e5e9e2; color: #46534c; }
        .clear:hover { background: #d9ded7; }
        .action:disabled { cursor: not-allowed; opacity: .42; }
        .error {
          margin: 10px 0 0;
          border-left: 3px solid #c7454d;
          padding: 7px 9px;
          background: #f5dfe0;
          color: #782a30;
          font-size: 10px;
          line-height: 1.4;
        }
        .error:empty { display: none; }
        .toast {
          position: absolute;
          right: 10px;
          bottom: calc(100% + 8px);
          max-width: 290px;
          border-radius: 8px;
          padding: 9px 11px;
          background: #17221d;
          color: #fff;
          box-shadow: 0 10px 25px rgba(0,0,0,.25);
          font-size: 11px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(4px);
          transition: opacity 140ms ease, transform 140ms ease;
        }
        .toast.show { opacity: 1; transform: translateY(0); }
        @media (max-width: 620px) {
          :host { right: 14px; bottom: 14px; }
          .items { max-height: 180px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .toast { transition: none; }
        }
      </style>
      <section class="ticket" hidden aria-label="${escapeHtml(t("extensionName", undefined, "Slip Mate"))}">
        <div class="rail"></div>
        <header class="header">
          <div class="mark" aria-hidden="true">SM</div>
          <div class="title">
            <strong>Slip Mate</strong>
            <span>${escapeHtml(t("panelSubtitle", undefined, "Seu bilhete sem login"))}</span>
          </div>
          <button class="collapse" type="button" aria-label="${escapeHtml(t("collapseSlipMate", undefined, "Recolher Slip Mate"))}" aria-expanded="true">−</button>
        </header>
        <div class="body">
          <div class="mode"><span>${escapeHtml(t("noLoginSlip", undefined, "Bilhete sem login"))}</span><span class="live">${escapeHtml(t("active", undefined, "Ativo"))}</span></div>
          <ul class="items"></ul>
          <div class="summary"><span>${escapeHtml(t("approxCombinedOdd", undefined, "Odd combinada aprox."))}</span><strong class="total">—</strong></div>
          <div class="actions">
            <button class="action copy" type="button">${escapeHtml(t("copyBet365Link", undefined, "Copiar link Bet365"))}</button>
            <button class="action clear" type="button">${escapeHtml(t("clear", undefined, "Limpar"))}</button>
          </div>
          <p class="error" role="status"></p>
        </div>
      </section>
      <div class="toast" role="status" aria-live="polite"></div>
    `;

    const ticket = shadow.querySelector(".ticket");
    const items = shadow.querySelector(".items");
    const total = shadow.querySelector(".total");
    const copyButton = shadow.querySelector(".copy");
    const clearButton = shadow.querySelector(".clear");
    const collapseButton = shadow.querySelector(".collapse");
    const error = shadow.querySelector(".error");
    const toast = shadow.querySelector(".toast");

    function render() {
      const selections = currentState.selections || [];
      ticket.hidden = !currentState.visible;
      ticket.classList.toggle("collapsed", collapsed);
      collapseButton.textContent = collapsed ? "+" : "−";
      collapseButton.setAttribute("aria-expanded", String(!collapsed));
      collapseButton.setAttribute(
        "aria-label",
        collapsed
          ? t("expandSlipMate", undefined, "Expandir Slip Mate")
          : t("collapseSlipMate", undefined, "Recolher Slip Mate")
      );

      items.innerHTML = selections.length
        ? selections.map((selection) => {
            const key = `${selection.eventId}:${selection.selectionId}`;
            const context = selection.eventName || selection.marketName || t(
              "genericBet365Market",
              undefined,
              "Mercado Bet365"
            );
            const decimal = Number(selection.decimalOdd) > 1
              ? Number(selection.decimalOdd).toFixed(2)
              : root.SlipMateURL.fractionalToDecimal(selection.fractionalOdd)?.toFixed(2) || "—";
            return `
              <li class="item">
                <div class="item-copy">
                  <div class="item-name">${escapeHtml(displayName(selection))}</div>
                  <div class="item-context">${escapeHtml(context)}</div>
                </div>
                <span class="odd">${escapeHtml(decimal)}</span>
                <button class="remove" type="button" data-remove-key="${escapeHtml(key)}" aria-label="${escapeHtml(t("removeSelection", displayName(selection), `Remover ${displayName(selection)}`))}">×</button>
              </li>`;
          }).join("")
        : `<li class="empty">${escapeHtml(t("emptyInstructionPrimary", undefined, "Clique em uma odd da Bet365."))}<br>${escapeHtml(t("emptyInstructionSecondary", undefined, "Ela entra aqui sem abrir o login."))}</li>`;

      const combined = root.SlipMateURL.getCombinedDecimal(selections);
      total.textContent = combined ? combined.toFixed(2) : "—";
      copyButton.disabled = selections.length === 0;
      clearButton.disabled = selections.length === 0;
      error.textContent = currentState.mappingError || "";
    }

    collapseButton.addEventListener("click", () => {
      collapsed = !collapsed;
      render();
    });
    copyButton.addEventListener("click", () => callbacks.onCopy?.());
    clearButton.addEventListener("click", () => callbacks.onClear?.());
    items.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-key]");
      if (button) callbacks.onRemove?.(button.dataset.removeKey);
    });

    function showToast(message) {
      clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add("show");
      toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
    }

    (document.body || document.documentElement).appendChild(host);

    return {
      update(nextState) {
        currentState = { ...currentState, ...nextState };
        render();
      },
      showToast,
      destroy() {
        clearTimeout(toastTimer);
        host.remove();
      }
    };
  }

  root.SlipMateUI = { create };
})(globalThis);
