# dungeon-items Changelog

Newest first. Times are Hawaii time (HST).

---

## Series Gamma in the deal pool
**Thu Nov 5, 2026 · 10:35 AM HST** (no new version: this repo has none; no migration)
- Added: `dealPool(source, { series: [...] })` deals the named series in full, rares too (kura: the GPUs of 88x31's Series Gamma, all rares, shown in UN/TAP), and an item's own quote (`extra.flavor`) comes with it as `flavor`. Every other rare stays a mystery. Removed: nothing.

## Read-Only moved onto 1-power 88x31 buttons only
**Thu Nov 5, 2026 · 2:54 AM HST** (no new version: this repo has none; a data change in `items-db`, no migration)
- Added: Read-Only on Bodacious, Blue Screen, Dot Matrix and IRC (1-power buttons); Broadband on Access Denied; Lag Spike on Best Viewed 800x600 and Webring Hub; Always Online on Disk Full. kura: Read-Only's power on a Webring or Divider could never be used to ping (then: "take read only off the counter button").
- Removed: Read-Only from Access Denied, Webring Hub (webrings), Best Viewed 800x600 (divider) and Disk Full (counter); Broadband from Bodacious; Lag Spike from Blue Screen and Dot Matrix; Always Online from IRC. Each effect keeps the same number of buttons; Read-Only is now only on 1-power buttons.

## Prodigal Proxy on six 88x31 commons
**Thu Nov 5, 2026 · 2:44 AM HST** (no new version: this repo has none; a data change in `items-db`, no migration)
- Added: UN/TAP's new printed effect Prodigal Proxy (`proxy`) on six commons: Ctrl+Alt+Del, Mix Tape, HTML 4 Life, Lava Lamp, Hello World and 1337. Commons and uncommons now carry 11 effects, 4 to 7 buttons each.
- Removed: those six buttons' old effects (Backup from Ctrl+Alt+Del and Mix Tape, Read-Only from HTML 4 Life and Lava Lamp, Virus from Hello World and 1337), leaving Backup, Read-Only and Virus on 6 buttons each.

## Printed effects in the deal pool
**Tue Nov 3, 2026 · 11:20 PM HST** (no new version: this repo has none)
- Added: a button can have one printed effect, the same for every copy of it, and the private deal pool hands it to games (UN/TAP uses it). 88x31's 48 commons and 22 uncommons have theirs.
- Removed: nothing.

## Uncommons in UN/TAP's deal pool
**Tue Nov 3, 2026 · 8:50 AM HST** (no new version: this repo has none)
- Changed: a game can ask the private deal pool for 88x31's uncommons in full (UN/TAP does). The public pages still hide them, and rarer buttons stay hidden everywhere.
- Removed: nothing.

## A deal pool for games
**Tue Nov 3, 2026 · 8:15 AM HST** (no new version: this repo has none)
- Added: a private call games can deal buttons from (for UN/TAP). Buttons that are hidden in public stay hidden in it: no name or picture.
- Removed: nothing.

## Space back after the date on the stories page
**Mon Nov 2, 2026 · 9:33 PM HST** (no new version: this repo has none)
- Fixed: the space between "·" and the server name after each chapter's date ("2026-10-31 · CLASSIC"). The 9:29 PM change dropped it by mistake. kura's screenshot showed "·CLASSIC".
- Removed: nothing.

## Stories show the played day
**Mon Nov 2, 2026 · 9:29 PM HST** (no new version: this repo has none)
- Changed: each chapter's date on the stories page is now its `day`, the Hawaii day the session was played (the same day its link opens). kura: "yeah can we show the played day please !"
- Removed: showing the date the chapter was saved (`created_at` in the visitor's own time zone) there. The one-week cutoff for which chapters show at first still goes by the save date.

## Stories RSS feed
**Mon Nov 2, 2026 · 6:42 AM HST** (no new version: this repo has none)
- Added: `GET /stories/feed.xml`, the 20 newest chapters as an RSS 2.0 feed (title, full text, date, and a link to each chapter's own page `/story/<id>`), built by `storiesFeed` in `src/stories.js`. The stories page's head has an `rel="alternate"` link to it, so feed readers find it from `https://stories.88x31.app`. One test. kura: "can we do the RSS feeds please ??"
- Removed: nothing.

## Stories from the Safe Room
**Mon Nov 2, 2026 · 4:22 AM HST** (no new version: this repo has none)
- The series is now "Stories from the Safe Room" (page title, header, test, STORY-VIDEOS.md), and the line under the header now starts "tales from the past week on". Removed: the name "Tales from the Safe Room" and "stories from the past week". kura: "can we rename this to \"Stories from the Safe Room\" please".

## Footer back to 9px
**Sat Oct 31, 2026 · 11:54 PM HST** (no new version: this repo has none)
- The shared footer text is back to 9px (VT323 pages 12px), the size it was before tonight; the ≡ stays plain text. Removed: the 10px size (13px on VT323 pages) from the last change.

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
