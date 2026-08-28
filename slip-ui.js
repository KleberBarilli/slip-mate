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

  function eventSides(selection) {
    return String(selection.eventName || "")
      .split(/\s+(?:v|vs\.?|x|@|-|–|—)\s+/i)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function isResultMarket(selection) {
    return /resultado|match result|full[- ]time result|moneyline|vencedor|winner|1x2/i
      .test(String(selection.marketName || ""));
  }

  function readableSelectionName(value) {
    const label = String(value || "").trim();
    const over = label.match(/^(?:o|over)\s+(.+)$/i);
    if (over) return `${t("overSelection", undefined, "Mais de")} ${over[1]}`;
    const under = label.match(/^(?:u|under)\s+(.+)$/i);
    if (under) return `${t("underSelection", undefined, "Menos de")} ${under[1]}`;
    return label;
  }

  function displayName(selection) {
    const subjectName = String(selection.subjectName || "").trim();
    const teamName = String(selection.teamName || "").trim();
    const selectionName = readableSelectionName(selection.selectionName);
    const marketName = String(selection.marketName || "").trim();
    const handicap = String(selection.handicap || "").trim();

    if (teamName) {
      const detailParts = [];
      if (
        selectionName &&
        selectionName !== teamName &&
        selectionName !== marketName &&
        !/^(?:to win|winner|moneyline|match betting|vencedor(?: da partida)?|resultado(?: da partida)?)$/i
          .test(selectionName)
      ) {
        detailParts.push(selectionName);
      }
      if (
        handicap &&
        !teamName.includes(handicap) &&
        !detailParts.some((value) => value.includes(handicap))
      ) {
        detailParts.push(handicap);
      }
      return detailParts.length ? `${teamName} ${detailParts.join(" ")}` : teamName;
    }

    if (subjectName) {
      const detailParts = [];
      if (
        selectionName &&
        selectionName !== subjectName &&
        selectionName !== marketName
      ) {
        detailParts.push(selectionName);
      }
      if (
        handicap &&
        !subjectName.includes(handicap) &&
        !detailParts.some((value) => value.includes(handicap))
      ) {
        detailParts.push(handicap);
      }
      return detailParts.length
        ? `${subjectName} — ${detailParts.join(" ")}`
        : subjectName;
    }

    const baseName = selectionName || marketName || t(
      "selectionFallback",
      String(selection.selectionId),
      `Seleção ${selection.selectionId}`
    );
    const sides = eventSides(selection);

    if (sides.length === 2 && isResultMarket(selection)) {
      if (baseName === "1") return sides[0];
      if (baseName.toLocaleUpperCase() === "X") {
        return t("drawSelection", undefined, "Empate");
      }
      if (baseName === "2") return sides[1];
    }

    return handicap && !String(baseName).includes(handicap)
      ? `${baseName} ${handicap}`
      : baseName;
  }

  function displayMarket(selection) {
    const selectionName = String(selection.selectionName || "").trim();
    const subjectName = String(selection.subjectName || "").trim();
    const teamName = String(selection.teamName || "").trim();
    const marketName = String(selection.marketName || "").trim();
    if (marketName && marketName !== (subjectName || teamName || selectionName)) {
      return marketName;
    }
    if (
      teamName &&
      /^(?:to win|winner|moneyline|match betting|vencedor(?: da partida)?|resultado(?: da partida)?)$/i
        .test(selectionName)
    ) {
      return selectionName;
    }
    return t("genericBet365Market", undefined, "Mercado Bet365");
  }

  function displayEvent(selection) {
    const eventName = String(selection.eventName || "").trim();
    if (!eventName || eventName === selection.selectionName || eventName === selection.marketName) {
      return "";
    }
    if (isResultMarket(selection) && eventSides(selection).length !== 2) return "";
    return eventName;
  }

  function displayContext(selection) {
    const values = [displayMarket(selection), displayEvent(selection)]
      .filter(Boolean)
      .filter((value, index, items) => items.indexOf(value) === index);
    return values.join(" · ") || t("genericBet365Market", undefined, "Mercado Bet365");
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
          width: min(390px, calc(100vw - 28px));
          color: #252b28;
          font-family: "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
        }
        * { box-sizing: border-box; }
        button { font: inherit; }
        .ticket {
          overflow: hidden;
          border: 1px solid rgba(16, 38, 31, .22);
          border-radius: 5px;
          background: #f3f4f1;
          box-shadow: 0 22px 60px rgba(0,0,0,.34), 0 2px 8px rgba(0,0,0,.2);
        }
        .ticket[hidden] { display: none; }
        .rail {
          height: 4px;
          background: linear-gradient(90deg, #f3d72f 0 15%, #00a86b 15% 100%);
        }
        .header {
          display: flex;
          align-items: center;
          gap: 11px;
          min-height: 58px;
          padding: 10px 13px;
          background: #103f33;
          color: #fff;
        }
        .mark {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border: 1px solid rgba(255,255,255,.4);
          border-radius: 3px;
          color: #f3d72f;
          font: 850 12px/1 "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
          letter-spacing: -.04em;
        }
        .title { min-width: 0; flex: 1; }
        .title strong { display: block; font-size: 15px; font-weight: 800; letter-spacing: -.015em; }
        .title span { display: block; margin-top: 1px; color: #bcd4cb; font-size: 10px; }
        .collapse {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border: 0;
          border-radius: 3px;
          background: rgba(255,255,255,.09);
          color: #fff;
          cursor: pointer;
          font-size: 17px;
        }
        .collapse:hover { background: rgba(255,255,255,.16); }
        .collapse:focus-visible, .action:focus-visible, .remove:focus-visible {
          outline: 3px solid #f4d23c;
          outline-offset: 2px;
        }
        .body { padding: 0; }
        .ticket.collapsed .body { display: none; }
        .mode {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 38px;
          padding: 0 13px;
          border-bottom: 1px solid #d8ddd8;
          background: #f8f8f6;
          color: #53615a;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .live { display: inline-flex; align-items: center; gap: 7px; color: #087553; }
        .live::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10ad79;
          box-shadow: 0 0 0 3px rgba(16,173,121,.12);
        }
        .items {
          max-height: 326px;
          margin: 0;
          padding: 0;
          overflow: auto;
          list-style: none;
          scrollbar-color: #aeb8b2 transparent;
          scrollbar-width: thin;
        }
        .item {
          position: relative;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr);
          gap: 7px;
          min-height: 94px;
          border-bottom: 1px solid #d8ddd8;
          padding: 11px 14px 11px 8px;
          background: #fff;
        }
        .item::after {
          position: absolute;
          bottom: -1px;
          left: 39px;
          width: 46px;
          height: 2px;
          background: #0c8b62;
          content: "";
        }
        .item-copy { min-width: 0; }
        .item-main {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          justify-content: space-between;
        }
        .item-name {
          display: -webkit-box;
          overflow: hidden;
          color: #087553;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.22;
          letter-spacing: -.012em;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        .item-market {
          display: -webkit-box;
          overflow: hidden;
          margin-top: 3px;
          color: #343a37;
          font-size: 12px;
          font-weight: 750;
          line-height: 1.25;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        .item-event {
          overflow: hidden;
          margin-top: 3px;
          color: #59625e;
          font-size: 11px;
          font-weight: 450;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .odd {
          flex: none;
          min-width: 44px;
          color: #343836;
          font-size: 15px;
          font-variant-numeric: tabular-nums;
          font-weight: 800;
          line-height: 1.2;
          text-align: right;
        }
        .remove {
          width: 24px;
          height: 24px;
          margin-top: -3px;
          border: 0;
          border-radius: 2px;
          background: transparent;
          color: #69726e;
          cursor: pointer;
          font-size: 22px;
          font-weight: 300;
          line-height: 1;
        }
        .remove:hover { background: #eceeeb; color: #a52e36; }
        .empty {
          padding: 26px 14px;
          color: #617068;
          font-size: 12px;
          line-height: 1.5;
          text-align: center;
          background: #fff;
        }
        .summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 52px;
          border-bottom: 1px solid #d8ddd8;
          padding: 8px 14px;
          background: #fff;
        }
        .summary span { color: #59635e; font-size: 11px; }
        .summary strong {
          color: #153d32;
          font-size: 23px;
          font-variant-numeric: tabular-nums;
          font-weight: 850;
          letter-spacing: -.035em;
          line-height: 1;
        }
        .actions {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          min-height: 52px;
          background: #202422;
        }
        .action {
          min-height: 52px;
          border: 0;
          border-radius: 0;
          padding: 0 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
        }
        .copy { background: #12e491; color: #123c30; }
        .copy:hover { background: #36eda6; }
        .clear { background: #202422; color: #f2f4f1; }
        .clear:hover { background: #303532; }
        .action:disabled { cursor: not-allowed; opacity: .42; }
        .error {
          margin: 0;
          border-left: 3px solid #c7454d;
          padding: 8px 11px;
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
          :host { right: 8px; bottom: 8px; width: calc(100vw - 16px); }
          .items { max-height: 230px; }
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
            <button class="action clear" type="button">${escapeHtml(t("clear", undefined, "Limpar"))}</button>
            <button class="action copy" type="button">${escapeHtml(t("copyBet365Link", undefined, "Copiar link Bet365"))}</button>
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
            const name = displayName(selection);
            const market = displayMarket(selection);
            const fixture = displayEvent(selection);
            const decimal = Number(selection.decimalOdd) > 1
              ? Number(selection.decimalOdd).toFixed(2)
              : root.SlipMateURL.fractionalToDecimal(selection.fractionalOdd)?.toFixed(2) || "—";
            return `
              <li class="item">
                <button class="remove" type="button" data-remove-key="${escapeHtml(key)}" aria-label="${escapeHtml(t("removeSelection", name, `Remover ${name}`))}">×</button>
                <div class="item-copy">
                  <div class="item-main">
                    <div class="item-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
                    <span class="odd">${escapeHtml(decimal)}</span>
                  </div>
                  <div class="item-market" title="${escapeHtml(market)}">${escapeHtml(market)}</div>
                  ${fixture ? `<div class="item-event" title="${escapeHtml(fixture)}">${escapeHtml(fixture)}</div>` : ""}
                </div>
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

  const api = { create, displayContext, displayEvent, displayMarket, displayName };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SlipMateUI = api;
})(globalThis);
