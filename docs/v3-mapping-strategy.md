# V3 mapping strategy

Investigation date: 2026-08-24.

## Decision

V3 uses Bet365's current React selection state instead of parsing the raw
WebSocket feed for the MVP.

The current `ReactGridLib.BaseParticipant` receives a `stem` object when it
renders a clickable odd. The Bet365 click delegate builds a normal bet from:

- `stem.data.ID` — participant/selection ID;
- `stem.data.OD` — native fractional odd;
- the first `FI` found while walking through `stem.parent` — fixture/event ID.

Those are the same three values required by the existing
`sportsbookredirect` URL.

## Runtime mapping

`bet365-hook.js` runs in the page's MAIN world at `document_start`.

When Slip Mate Mode is active, it:

1. listens for `pointerdown`, mouse and click events in the capture phase;
2. walks the clicked DOM node's React fiber toward `BaseParticipant`;
3. reads the `stem` prop and normalizes `FI + ID + OD`;
4. blocks the event before Bet365 can open the logged-out login dialog;
5. sends only the normalized selection to the isolated content script.

If a visible odds target cannot be mapped, the event is blocked and the UI
shows an unsupported-market message. It does not fall through to Bet365.

## Why not WebSocket parsing in V3.0

The current sports publisher uses Bet365's framed `zap-protocol-v2`. Frames can
be compressed or encoded before their market records reach the page model.
Bet365 already turns that stream into the `stem` model needed by its own click
delegate, so reading that normalized model removes an unnecessary protocol and
decompression dependency.

A feed parser remains a possible fallback if Bet365 removes React fiber state
from participant elements.

## Confirmed current behavior

- The public Brazil sports page renders markets while logged out.
- Normal selection clicks open the login dialog.
- Visible odds do not expose useful IDs in HTML attributes.
- The current Bet365 participant delegate uses `ID`, `OD` and ancestor `FI` to
  build `TP=BS<FI>-<ID>` normal bets.

## Compatibility boundary

The private React fiber property is intentionally isolated in
`bet365-hook.js`. The rest of the extension consumes a stable normalized
selection object and does not depend on Bet365 internals.

Current MVP scope remains pre-match normal selections. Bet Builder, enhanced
boost combinations and fast-moving live markets should be treated as separate
compatibility work.
