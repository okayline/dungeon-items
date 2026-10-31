// (Oct 29) THE FOOTER: one line at the bottom of every game's page, written once here, served as GET /footer.js.
//   <script src="https://dungeon-items.ddddungeon.workers.dev/footer.js" data-version="v0.11.0"></script>
// It draws "🄯 ~*~88x31~*~ · § ≡ <version>" (the same name in every game), like the 88x31 BBS footer.
// data-copy="no" leaves out the 🄯 (88x31, which shows buttons other people made).
// The line sits snug at the right, under a game's screen (a small negative top margin, line-height 1).
// (Oct 29) The § and (Oct 31) the ≡ are only marks for now: they open nothing.
// (Oct 31) A game puts <div id="ddfoot"></div> where it wants the footer (inside its own screen area, above this script tag) and the footer
// is drawn into it. Without that div it is drawn right after the script tag, hidden until the page has loaded (the old way, to be deleted).
// (Oct 29) The footer text can always be selected, even on a page that turns selection off for its body (4Dungeon, scoundrel.exe,
// irl-dungeon).
export const FOOTER_JS = `(function () {
  var me = document.currentScript; if (!me) return;
  var d = me.dataset;
  var css = document.createElement("style");
  css.textContent = ".ddfoot{position:relative;align-self:flex-end;margin:-3px 0 0;padding:0 6px 0 0;text-align:right;font-family:inherit;font-size:9px;line-height:1;color:#ccc;letter-spacing:.03em;-webkit-user-select:text;user-select:text}" +
    ".ddfoot .ddacct{font-size:13px;padding:0 .3em;user-select:none}";
  document.head.appendChild(css);
  var spot = document.getElementById("ddfoot");   // (Oct 31) the game's own empty <div id="ddfoot"></div>, placed where it wants the footer; the footer is drawn into it, so it shows up with the game
  var foot = spot || document.createElement("div"); foot.classList.add("ddfoot");
  if (/VT323/i.test(getComputedStyle(spot || me.parentNode).fontFamily)) foot.style.fontSize = "12px";   // VT323 is a small font (about 3/4 the size of a normal one at the same px), so it gets 12px to look like 9px does on the other pages
  if (!spot) {   // (Oct 31) a game that has no spot yet: drawn right after this script tag, as before (hidden until the page has loaded). Delete this once every game has its spot.
    foot.style.visibility = "hidden";
    var reveal = function () { (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { requestAnimationFrame(function () { foot.style.visibility = ""; }); }); };
    if (document.readyState === "complete") reveal(); else window.addEventListener("load", reveal);
  }
  foot.appendChild(document.createTextNode((d.copy === "no" ? "" : "\\u{1f12f} ") + "~*~88x31~*~ \\u00b7 \\u00a7 "));
  var acct = document.createElement("span"); acct.className = "ddacct"; acct.textContent = "\\u2261";   // (Oct 31) only a mark, like the §: it opens nothing
  foot.appendChild(acct);
  if (d.version) foot.appendChild(document.createTextNode(" " + d.version));
  if (!spot) me.parentNode.insertBefore(foot, me.nextSibling);
})();
`;
