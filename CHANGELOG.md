# dungeon-items Changelog

Newest first. Times are Hawaii time (HST).

---

## Footer ≡ as plain text, slightly bigger footer
**Sat Oct 31, 2026 · 11:50 PM HST** (no new version: this repo has none)
- The ≡ in the shared footer is now plain text like the rest of the line, and the footer text is a little bigger: 9px → 10px (VT323 pages 12px → 13px). Removed: the ≡'s own span with its larger 13px size, extra padding and unselectable style.

## Stories tab icon
**Sat Oct 31, 2026 · 10:50 PM HST** (no new version: this repo has none)
- Added: a tab icon on the stories page (stories.88x31.app): "88 x 31" in the page's link red inside a bold ASCII `+--+` border, on the header's dark colour, the same style as the games. It is written into the page itself, so there are no new files.
- Removed: nothing (the page had no icon).

## Working notes tidy
**Sat Oct 31, 2026 · 1:35 PM HST** (no new version: the game itself is unchanged)
- Behind the scenes only: nothing in the shared core changes. The repo's working notes (`CLAUDE.md`) now hold only notes for this repo. Removed: the shared working-rules block that was copied into that file.

## Ledger names hidden
**Sat Oct 31, 2026 · 11:42 AM HST** (no new version: the game itself is unchanged)
- A checkpoint's player name is no longer sent by the ledger API or shown on the `/ledger` page: every scoundrel.exe run now reads "A Scoundrel". Removed: the `name` field in `/api/registry/ledger` entries and the name in the run sentence. Names already stored stay in the database (the ledger is append-only) and games can still send one; nothing reads it.

## Oct 31, 2026
**Sat Oct 31, 2026 · 5:11 AM HST**
- A game can put `<div id="ddfoot"></div>` where it wants the footer, and `/footer.js` draws the footer into it, so it shows up with the game instead of alone mid-screen. Games without that div still get the footer right after the script tag, hidden until the page has loaded. Removed: nothing yet; the wait-for-load fallback goes once every game has its div.

**Sat Oct 31, 2026 · 5:16 AM HST**
- The footer looks exactly the same (`🄯 ~*~88x31~*~ · § ≡ v0.20.0`), but the ≡ is now only a mark like the §: it no longer opens the save codes and passkeys popup. The accounts themselves are untouched and still work behind the scenes. Removed: the popup window, its click and Esc handling, the pointer cursor on the ≡, `data-carry` (including the `#` links for 88x31 and 4Dungeon), and the test for `data-carry`.

## Oct 29, 2026
**Thu Oct 29, 2026 · 9:47 PM HST**
- The footer is always at the right. Removed: `data-align="center"` (no game used it), its code and its test.

**Thu Oct 29, 2026 · 9:50 PM HST**
- The footer stays hidden (still holding its spot) until the page and its fonts have loaded, so it no longer shows alone in the middle of the screen before a game draws. Removed: drawing the footer the moment its script runs.
- The footer text can be selected on every game, including pages that turn selection off for the whole body (4Dungeon, scoundrel.exe, irl-dungeon). The ≡ still can't be. Removed: nothing.

**Thu Oct 29, 2026 · 3:12 to 3:47 PM HST**

- The footer every game shows (`/footer.js`) now reads `🄯 ~*~88x31~*~ · § ≡ v0.20.0`. Removed: the © (now the copyleft sign 🄯), the word "cLuB" and the year. Added: a § next to the ≡ that is only a mark and opens nothing.
- The ≡ is no longer blue and is 13px, and the footer text is 9px. Removed: the blue, and the old 10px text and 13px/14px ≡ sizes.
- The footer is set in the page's own font, and a page set in VT323 (the ASCII games) gets a 12px footer so it does not look tiny. Removed: the fixed monospace font.
- The footer text sits 6px in from the right edge of a game's screen. Removed: the 1.2em of padding on each side.
- A ledger popup on the § was added at 3:46 PM and removed at 3:47 PM (the § stays). Removed: the popup, its styles and its test.
