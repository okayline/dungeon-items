// (Oct 29) THE FOOTER: one line at the bottom of every game's page, written once here, served as GET /footer.js.
//   <script src="https://dungeon-items.ddddungeon.workers.dev/footer.js" data-name="scoundrel.exe" data-version="v0.10.0" defer></script>
// It draws "© <name>, <year> · ≡ <version>" right after its own script tag, like the 88x31 BBS footer. The ≡ pops up the
// shared carry window (save codes, passkeys, carry) from the game's OWN /api/carry?embed=1 (logins are per game, so it
// has to be the game's address), just above the ≡, over the page. ≡ again, a click anywhere else or Esc closes it.
// data-carry overrides the window's address (a game whose route is somewhere else).
export const FOOTER_JS = `(function () {
  var me = document.currentScript; if (!me) return;
  var d = me.dataset, name = d.name || document.title, carry = d.carry || "/api/carry?embed=1";
  var css = document.createElement("style");
  css.textContent = ".ddfoot{position:relative;align-self:flex-end;margin:4px 0 0;padding:0 1ch;text-align:right;font:12px ui-monospace,Menlo,Consolas,monospace;color:#ccc;letter-spacing:.03em}" +
    ".ddfoot .ddacct{cursor:pointer;color:#8cf;font-size:16px;padding:0 .3em;user-select:none}" +
    ".ddfoot iframe{position:absolute;right:0;bottom:100%;margin-bottom:4px;width:440px;height:240px;max-height:120vh;border:1px solid #8f8f8a;background:#07090a;z-index:1000;transform:scale(.55);transform-origin:bottom right}";
  document.head.appendChild(css);
  var foot = document.createElement("div"); foot.className = "ddfoot";
  foot.appendChild(document.createTextNode("\\u00a9 " + name + ", " + new Date().getFullYear() + " \\u00b7 "));
  var acct = document.createElement("span"); acct.className = "ddacct"; acct.title = "Save codes and passkeys"; acct.textContent = "\\u2261";
  foot.appendChild(acct);
  if (d.version) foot.appendChild(document.createTextNode(" " + d.version));
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
