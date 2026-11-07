# dungeon-items Changelog

Newest first. Times are Hawaii time (HST).

---

## A flat card can tilt in the big view
**Fri Nov 6, 2026 · 7:20 PM HST** (no new version: this repo has none; no migration)
- Added: a game can ask the shared big view to let any card tilt up and down (`tilt: true`), not only the graphics cards and 3D printed buttons; 88x31 asks for it on every button (kura: "could we add the up/down view action to all the buttons please"). Other games are unchanged. Removed: nothing.

## Every button its own subtype
**Fri Nov 6, 2026 · 6:40 PM HST** (no new version: this repo has none; a data change in `items-db`, no migration)
- Added: each 88x31 button's subtype (the word after the dash on its card, like "Construction — Zone") is kept here next to its flavour line, the same one UN/TAP already shows, and for the GPUs their chip generation, as in Rob's Game (`seed/subtype.sql`), and 88x31 can read every button's card lines privately to print them under its big view. Removed: nothing.

## Every button its own flavour line
**Thu Nov 5, 2026 · 10:25 PM HST** (no new version: this repo has none; a data change in `items-db`, no migration)
- Added: each of 88x31's 107 typed buttons has its own flavour line, all different: real lines from 1990s personal web pages, 54 from before and 62 found today, each with where it was found (`seed/flavor.json`), and 9 kept spare. Games that show a button's quote (UN/TAP) show its own line, the same every time (kura: "i'd like unique lines for all the cards if possible !"). Found buttons are left as they are. Removed: nothing here (UN/TAP stops picking a random line for those buttons).

## 3D printed buttons stand up in the big view
**Thu Nov 5, 2026 · 10:00 PM HST** (no new version: this repo has none; no migration)
- Added: a public list of the 3D printed buttons' height maps, and the shared big view uses it: a printed button (Under Construction, Synthwave, Island Life) stands up from its card at its print's heights and tilts, in every game that loads the shared view (kura: "yep could we do that please!"). Removed: the height map in the private deal pool (the public list replaces it).

## Fixed: the shared big view
**Thu Nov 5, 2026 · 9:55 PM HST** (no new version: this repo has none; no migration)
- Fixed: the shared big view didn't open on any site (kura: "it doesnt pop up on any site now haha"). The way the Worker is built added a bit to the script that only works inside the Worker, so the script stopped on every page. Removed: that stop.

## The big view, shared
**Thu Nov 5, 2026 · 9:35 PM HST** (no new version: this repo has none; no migration)
- Added: one shared script every game can load for its big view: hold a card or button (or rest the mouse on it) to see it big and turn it over, with the graphics cards in 3D. Each game gives it its own frame. A change made here changes every game that loads it (kura: "it would be nice to change it to "90 degrees" once, and have it change everywhere"). Removed: nothing here.

## 3D printed buttons
**Thu Nov 5, 2026 · 8:20 PM HST** (no new version: this repo has none; migration `010_reliefs.sql`)
- Added: a table of height maps for buttons that have been 3D printed, read from the files they were printed from, and the private deal pool hands a button's map to games with it (kura: "i was thinking of getting these buttons 3d printed", and a 3D version on the big card). The first three: Under Construction, Synthwave and Island Life (the last two printed a little deeper, kura: "could we get a little more depth on synthwave and island life please", and Island Life's palm trees standing out in front: "like the foreground"). Removed: nothing.

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
