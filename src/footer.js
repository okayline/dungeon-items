// (Oct 29) THE FOOTER: one line at the bottom of every game's page, written once here, served as GET /footer.js.
//   <script src="https://dungeon-items.ddddungeon.workers.dev/footer.js" data-version="v0.11.0"></script>
// It draws "✦ ~*~88x31~*~ cLuB, <year> · ≡ <version>" (the same name in every game) right after its own script tag, like the 88x31 BBS footer. The ≡ pops up the
// shared carry window (save codes, passkeys, carry) from the game's OWN /api/carry?embed=1 (logins are per game, so it
// has to be the game's address), just above the ≡, over the page. ≡ again, a click anywhere else or Esc closes it.
// data-copy="no" leaves out the ✦ (88x31, which shows buttons other people made).
// The line sits snug under a game's screen (a small negative top margin, line-height 1); a centered page keeps a 4px gap.
// data-align="center" centers the line (88x31, Dawn Baton, Aura Farm); without it, it sits at the right, under a game's screen.
// data-carry overrides the window's address (a game whose route is somewhere else). (Oct 29) A data-carry that starts with
// "#" (88x31's "#codes", 4Dungeon's "#user") pops up nothing: the ≡ goes to that place on the game's own page, for a game
// whose login is its own screen (4Dungeon keeps its token in the page; 88x31 has its own routes), so the window can't do it.
export const FOOTER_JS = `(function () {
  var me = document.currentScript; if (!me) return;
  var d = me.dataset, carry = d.carry || "/api/carry?embed=1";
  var css = document.createElement("style");
  css.textContent = ".ddfoot{position:relative;align-self:flex-end;margin:-3px 0 0;padding:0 1.2em;text-align:right;font:10px/1 ui-monospace,Menlo,Consolas,monospace;color:#ccc;letter-spacing:.03em}" +
    ".ddfoot .ddacct{cursor:pointer;font-size:14px;padding:0 .3em;user-select:none}" +
    ".ddfoot iframe{position:absolute;right:0;bottom:100%;margin-bottom:4px;width:440px;height:240px;max-height:120vh;border:1px solid #8f8f8a;background:#07090a;z-index:1000;transform:scale(.55);transform-origin:bottom right}";
  document.head.appendChild(css);
  var foot = document.createElement("div"); foot.className = "ddfoot";
  if (d.align === "center") { foot.style.textAlign = "center"; foot.style.alignSelf = "center"; foot.style.marginTop = "4px"; }   // data-align="center": for a page whose content is centered
  foot.appendChild(document.createTextNode((d.copy === "no" ? "" : "\\u2726 ") + "~*~88x31~*~ cLuB, " + new Date().getFullYear() + " \\u00b7 "));
  var acct = document.createElement("span"); acct.className = "ddacct"; acct.title = "Save codes and passkeys"; acct.textContent = "\\u2261";
  foot.appendChild(acct);
  if (d.version) foot.appendChild(document.createTextNode(" " + d.version));
  if (carry.charAt(0) === "#") {
    acct.addEventListener("click", function () { if (location.hash === carry) window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL: location.href, newURL: location.href })); else location.hash = carry; });
    me.parentNode.insertBefore(foot, me.nextSibling);
    return;
  }
  var win = document.createElement("iframe"); win.title = "Save codes, passkeys and carry"; win.hidden = true;
  win.onload = function () { try { var b = win.contentDocument && win.contentDocument.body; if (b && b.scrollHeight) win.style.height = Math.ceil(b.scrollHeight) + "px"; } catch (e) {} };
  foot.appendChild(win);
  me.parentNode.insertBefore(foot, me.nextSibling);
  function show(on) { if (win.hidden === !on) return; win.hidden = !on; win.src = on ? carry : "about:blank"; }
  acct.addEventListener("click", function (e) { e.stopPropagation(); show(win.hidden); });
  document.addEventListener("click", function () { show(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !win.hidden) { e.preventDefault(); e.stopImmediatePropagation(); show(false); } }, true);
})();
`;
