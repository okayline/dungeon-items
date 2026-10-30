# dungeon-items Changelog

Newest first. Times are Hawaii time (HST).

---

## Oct 29, 2026
**Thu Oct 29, 2026 · 9:50 PM HST**
- The footer stays hidden (still holding its spot) until the page and its fonts have loaded, so it no longer shows alone in the middle of the screen before a game draws. Removed: drawing the footer the moment its script runs.
- The footer text can be selected on every game, including pages that turn selection off for the whole body (4Dungeon, scoundrel.exe, irl-dungeon). The ≡ still can't be. Removed: nothing.

**Thu Oct 29, 2026 · 3:12 to 3:47 PM HST**

- The footer every game shows (`/footer.js`) now reads `🄯 ~*~88x31~*~ · § ≡ v0.20.0`. Removed: the © (now the copyleft sign 🄯), the word "cLuB" and the year. Added: a § next to the ≡ that is only a mark and opens nothing.
- The ≡ is no longer blue and is 13px, and the footer text is 9px. Removed: the blue, and the old 10px text and 13px/14px ≡ sizes.
- The footer is set in the page's own font, and a page set in VT323 (the ASCII games) gets a 12px footer so it does not look tiny. Removed: the fixed monospace font.
- The footer text sits 6px in from the right edge of a game's screen. Removed: the 1.2em of padding on each side.
- A ledger popup on the § was added at 3:46 PM and removed at 3:47 PM (the § stays). Removed: the popup, its styles and its test.
