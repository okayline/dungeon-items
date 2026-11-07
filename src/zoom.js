// (Nov 5) THE BIG VIEW: hold a card or button (rest the mouse on it) to see it big and turn it over, written once here and served as
// GET /zoom.js, so every game behaves the same (kura: "it would be nice to change it to "90 degrees" once, and have it change
// everywhere"; "each game can have it's own "window" or "frame" for the button"). It started in UN/TAP (Nov 3), was copied to Rob's
// Game (Nov 4, with the GPUs in 3D, Nov 5) and to 88x31 (v0.49); this is the club's version, the newest.
//   <script src="https://dungeon-items.ddddungeon.workers.dev/zoom.js"></script>   (before the game's own script)
//   DDZoom.setup({
//     find(target)  the zoomable element at or above an event's target, or null
//     open(el)      what to show for it: { face, w, h, width?, cls?, gpu? }: face, the front (the game's own frame, filling the box);
//                   w and h, the box in --u (88 x 31 for a bare button, 108 x 150 for a card); width, its CSS width (default
//                   min(86vw, 440px)); cls, classes for the .zoom wrapper (the game styles its edge and back with them);
//                   gpu, a GPU to show in 3D: { key, image, frames, art, spin } (its GPU_3D name, its still 88 x 31 picture, its
//                   fans' 24 frames or none, the element in face where its picture is, whether the fans turn). Pictures from
//                   another site need to allow it (Access-Control-Allow-Origin), since the sides are painted from their pixels.
//                   relief, a button that may have been 3D printed: { image, art, id } or { image, art, source, key } (its picture,
//                   the picture's element in face, and its item id, or its source and key at home, e.g. "88x31" and the design id):
//                   if /api/reliefs has its height map, it stands up from the face in layers at the print's heights and tilts too
//                   tilt, true: it tilts up and down too, like a GPU, even when it's flat (88x31's buttons, kura, Nov 6)
//     holdOff(el)   true where a long press means something else there (picking a button up): a finger doesn't open it
//     hoverOff(el)  true while the mouse mustn't open it (a fight playing)
//   })
//   DDZoom.busy()   true while a hold is on or the big view is open (a game's own gestures wait); DDZoom.mouse(): it's open from a
//   mouse (not a finger); DDZoom.close()
// The look is plain CSS with no weight (:where), so a game's own rules for .zoom, .zbox, .zface, .zedge and .zback win.
export function zoomClient() {
  if (window.DDZoom) return;
  // press and hold still for HOLD_MS with a finger (or rest the mouse without moving for HOVER_MS) to open it; letting go (or moving
  // off) closes it. It turns with the finger or mouse, and past a quarter turn shows its back. A hold doesn't also click: the click
  // after it is swallowed. With it open, the mouse can go sideways until it has turned a half turn (TURN_OFF), and up or down HOVER_PAD
  // px past the element; a GPU in 3D tilts up and down too, up to TILT_MAX, and up and down count like sideways (kura, 88x31 v0.49.5)
  const HOLD_MS = 450, HOVER_MS = 1000, HOVER_PAD = 16, TURN_OFF = 180;
  const ZEDGE = 8;   // layers that make its edge (its thickness, .zedge)
  const FINGER_DEG_PX = 0.75;   // degrees per pixel a finger moves: 240px turns it to its back
  const TILT_MAX = 90;   // a GPU tilts up to edge-on (kura, 88x31 v0.49.6; Rob's Game had 80)
  const MOUSE_HALF = 112;   // a half turn for every MOUSE_HALF px of mouse (Rob's Game's hand card on a computer; kura, 88x31 v0.49.4)
  const css = document.createElement("style");
  css.textContent = [
    ":where(.zoom){position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:rgba(20,26,48,.45);pointer-events:none}",
    ":where(.zoom .zbox){position:relative;filter:drop-shadow(0 8px 24px rgba(0,0,0,.45));perspective:calc(600 * var(--u))}",
    ":where(.zflip){position:absolute;inset:0;transform-style:preserve-3d;--zd:calc(1 * var(--u))}",
    ":where(.zflip > .zface, .zflip > .zback){position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}",
    ":where(.zflip > .zface){transform:translateZ(calc(var(--zd) / 2));display:flex;align-items:center;justify-content:center}",
    ":where(.zedge){position:absolute;inset:0;background:#000048;transform:translateZ(calc((var(--k) - .5) * var(--zd)))}",
    ":where(.zback){transform:rotateY(180deg) translateZ(calc(var(--zd) / 2));background:repeating-linear-gradient(45deg,#000080 0 8px,#000060 8px 16px)}",
    ":where(.gpu3d){position:absolute;left:0;top:0;width:calc(88 * var(--u));height:calc(31 * var(--u));transform-style:preserve-3d;pointer-events:none}",
    ":where(.gpu3d .f){position:absolute;left:0;top:0;transform-origin:0 0;image-rendering:pixelated}",
  ].join("\n");
  document.head.appendChild(css);
  const mk = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  let opts = null, bigCard = null, bigFlip = null, bigBy = null, held = false, bigTilt = false;   // bigBy: the element a mouse opened it from
  // the 3D printed buttons' height maps (dungeon-items /api/reliefs, from where this script came), fetched once when a game sets up
  const HOME = (() => { try { return new URL(document.currentScript.src).origin; } catch { return ""; } })();
  let reliefs = null;
  const getReliefs = () => (reliefs = reliefs || fetch(HOME + "/api/reliefs").then((r) => (r.ok ? r.json() : [])).catch(() => []));
  function showBig(el) {
    const v = opts && opts.open(el);
    if (!v) return;
    hideBig();
    const box = mk("div", "zbox");
    box.style.width = v.width || "min(86vw, 440px)";
    box.style.setProperty("--u", `calc(${box.style.width} / ${v.w})`);
    box.style.height = `calc(${v.h} * var(--u))`;
    bigFlip = mk("div", "zflip");
    const face = mk("div", "zface");
    face.append(v.face);
    bigFlip.append(face, mk("div", "zback"));
    for (let k = 0; k < ZEDGE; k++) { const e = mk("div", "zedge"); e.style.setProperty("--k", (k + 0.5) / ZEDGE); bigFlip.append(e); }
    box.append(bigFlip); bigCard = mk("div", "zoom" + (v.cls ? " " + v.cls : "")); bigCard.append(box); document.body.append(bigCard);
    const shape = v.gpu && GPU_3D[v.gpu.key];
    bigTilt = !!shape || !!v.tilt;
    if (shape) gpu3d(v.gpu, shape, v);
    else if (v.relief) {
      const mine = bigCard, rel = v.relief;
      getReliefs().then((list) => {
        const e = list.find((r) => (rel.id != null ? r.id === rel.id : r.source === rel.source && r.key === String(rel.key)));
        if (e && bigCard === mine) { bigTilt = true; relief3d(rel, e, v); }
      });
    }
  }
  function hideBig() { if (bigCard) bigCard.remove(); bigCard = null; bigFlip = null; bigBy = null; bigTilt = false; }
  const turnBig = (deg, tilt = 0) => {
    if (!bigFlip) return;
    tilt = bigTilt ? Math.max(-TILT_MAX, Math.min(TILT_MAX, tilt)) : 0;
    bigFlip.style.transform = `rotateX(${tilt}deg) rotateY(${deg}deg)`;
  };
  const find = (t) => (opts && t && t.nodeType === 1 ? opts.find(t) : null);
  const holdOff = (n) => !!(opts.holdOff && opts.holdOff(n)), hoverOff = (n) => !!(opts.hoverOff && opts.hoverOff(n));

  // a finger: hold still on it; moving the finger turns it; letting go anywhere ends it
  addEventListener("click", (e) => { if (held) { held = false; e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener("contextmenu", (e) => { if (find(e.target)) e.preventDefault(); });   // a long press opens no menu
  let holdTimer = null, hx = 0, hy = 0;
  const endHold = () => { clearTimeout(holdTimer); holdTimer = null; if (bigCard && held) { hideBig(); setTimeout(() => (held = false), 400); } };
  addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    const n = find(e.target);
    if (!n || holdOff(n)) return;
    hx = e.clientX; hy = e.clientY; held = false; clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { holdTimer = null; if (n.isConnected) { held = true; showBig(n); } }, HOLD_MS);
  });
  // a page that scrolls would take the sliding finger as a scroll, so while it's open the finger turns it instead
  document.addEventListener("touchmove", (e) => { if (held && bigCard) e.preventDefault(); }, { passive: false });
  addEventListener("pointerup", endHold); addEventListener("pointercancel", endHold);

  // a mouse: every move over an element starts its wait again, so it opens only once the mouse stops; once open it stays (and
  // turns) until it has turned TURN_OFF or gone too far up or down. Resting still on another element meanwhile opens that one.
  let hover = null, x0 = 0, y0 = 0;
  const deg = (e) => (e.clientX - x0) / MOUSE_HALF * 180;
  const tilt = (e) => -(e.clientY - y0) / MOUSE_HALF * 180;
  addEventListener("pointermove", (e) => {
    if (holdTimer && Math.hypot(e.clientX - hx, e.clientY - hy) > 8) { clearTimeout(holdTimer); holdTimer = null; }
    if (held && bigCard && e.pointerType !== "mouse") { turnBig((e.clientX - hx) * FINGER_DEG_PX, -(e.clientY - hy) * FINGER_DEG_PX); return; }
    if (e.pointerType !== "mouse") return;
    const n = e.buttons ? null : find(e.target);   // no waiting while a mouse button is pressed (carrying something)
    if (bigBy) {
      const r = bigBy.getBoundingClientRect(), y = e.clientY;
      const inside = bigTilt ? Math.abs(tilt(e)) < TURN_OFF : y >= r.top - HOVER_PAD && y <= r.bottom + HOVER_PAD;
      if (bigBy.isConnected && Math.abs(deg(e)) < TURN_OFF && inside) turnBig(deg(e), tilt(e));
      else hideBig();
    }
    clearTimeout(hover);
    if (!n || n === bigBy || hoverOff(n)) return;
    const sx = e.clientX, sy = e.clientY;
    hover = setTimeout(() => { if (n.isConnected && !hoverOff(n)) { showBig(n); if (bigCard) { bigBy = n; x0 = sx; y0 = sy; } } }, HOVER_MS);
  });
  // clicking the element closes it (a click often takes it off the page, so its leaving never comes)
  addEventListener("click", (e) => { clearTimeout(hover); if (bigBy && bigBy.contains(e.target)) hideBig(); }, true);

  // pictures, kept once loaded; crossOrigin so a picture from another site that allows it can be read for the sides
  const SPIN_FRAMES = 24, SPIN_MS = 20, pics = new Map();
  const img = (src) => { let im = pics.get(src); if (!im) { im = new Image(); im.crossOrigin = "anonymous"; im.src = src; pics.set(src, im); } return im; };
  let gpuSpin = null;   // the 3D fronts' fans: the frames every SPIN_MS (four times slower with reduced motion), as in Rob's Game

  // A GPU's big card shows it in 3D, with the real card's sides (kura, Nov 5: "give them a depth when you turn the card ... adding the
  // depth/sides to the flat GPU"). Each GPU's shape is its settings here, keyed by its picture's name:
  //   groups  parts that stand the same height off the card: d, how far in art pixels; boxes, each part's place on the picture
  //           { x, y, w, h } and which of its sides are drawn (sides: t top, b bottom, l left, r right; the hidden ones are left out);
  //           z: [z0, z1], a part that only stands from z0 to z1 up from the card (the bracket's legs), else all of 0 to d
  //   marks   on a box's side: top, bottom, left, right: [[a0, a1, b0, b1, paint, paint2?], ...]: from a0 to a1 along the side (x on
  //           the top and bottom, y on the left and right, in the picture's pixels) and b0 to b1 up from the card (0 on the card, d-1 at
  //           the front). paint: a colour (with paint2, a checkerboard), or "dp" / "hdmi": a port on the bracket, three wide (b0 to b0 + 2),
  //           shaded: its lining dark on the b0 side and lighter on the other, a dark lip at a0 and a lit one at a1, the plug's tongue
  //           down the middle; the HDMI's two corners on the lit side are the bracket's metal, its taper (kura, Nov 5, on the 5080);
  //           "hdmi-back": an HDMI turned over, its taper on the side nearest the card (the B580's, kura).
  //           Anything not marked is the picture's own edge colour, shaded as metal.
  // The front of each box is the picture itself (its fans spin there once it has resolved), and the flat picture under it is painted
  // black, so face on the big card looks as it did. Height: the real card's thickness at the picture's scale (its length in pixels).
  // The bracket (kura, Nov 5: "make all of them accurate to IRL"): every card's top tab sits the same distance above the bottom of the
  // fingers, since they all plug into the same slot and screw to the same rail: about 109 mm, measured on kura's photos (RTX 4090 112,
  // PNY RTX 5090 108.5, Arc B580 107, GTX 1080 Ti about 111: level with its 111 mm top), and the bracket's 120.02 mm (PCIe CEM) ends about
  // 11 mm past the fingers. At each picture's scale from the card's real height: the 137 mm RTX 5090, 5080 and 4090 y 6, legs 2 px past
  // the fingers; the 112 mm RTX 5070 y 1, 3 px; the 111 mm GTX 1080 Ti y 0 (its photo), 2 px; the 115 mm Arc B580 y 2, 3 px (its photos).
  // AMD's cards, never sold: y 4 (kura's choice, on AMD's render), legs 4 px (a black sample's photo: 12.5% of its height)
  // Built the way the mockups kura saw on her phone were (Nov 5): each face is a small canvas of its own pixels, nothing clipped
  // (the first version clipped a whole copy of the picture on each face and showed only black there).
  const PORTS = [[7, 10, 4, 6, "dp"], [12, 15, 4, 6, "dp"], [17, 20, 4, 6, "dp"], [22, 26, 4, 6, "hdmi"]];   // three DisplayPorts, then the HDMI, nearest the fingers (kura's photo, Nov 5), on a bracket from y 6
  // a shroud in slices that follow the picture's outline, so its corners round off as the real card's do (kura, Nov 5: "round the
  // corners of all the cards that have rounded corners irl"): slices, [x, y, w, h] each, all with box's sides and marks; each slice's
  // last column, at the far end, stands from 1 to d - 1, so the far end rounds off seen from the top and bottom too (end false: not, for a
  // card with its own end cap). The corners are rounder than the pictures' (kura: "all round more please"), so the whole shroud's place
  // is painted black on the flat picture (clear), not just the slices'; and a slice's top and bottom take the colour of the picture's
  // outermost pixel in that column (out: the shroud's top and bottom rows), its frame, not what's inside it (kura, Nov 5: the 5090's
  // far corners showed a dark row)
  const ROUND = (d, slices, box, end = true) => {
    const x0 = Math.min(...slices.map((s) => s[0])), y0 = Math.min(...slices.map((s) => s[1]));
    const x1 = Math.max(...slices.map((s) => s[0] + s[2])), y1 = Math.max(...slices.map((s) => s[1] + s[3]));
    const span = (s) => s && [s[0], s[0] + s[2] - 1];   // the columns a neighbouring slice covers: there a slice's top or bottom is hidden
    return slices.flatMap(([x, y, w, h], i) => (end ? [{ ...box, x, y, w: w - 1, h }, { ...box, x: x + w - 1, y, w: 1, h, z: [1, d - 1] }] : [{ ...box, x, y, w, h }])
      .map((b, k) => ({ ...b, out: [y0, y1], inT: span(slices[i - 1]), inB: span(slices[i + 1]), ...(i || k ? {} : { clear: [x0, y0, x1 - x0, y1 - y0] }) })));
  };
  // the RX 9070's top, from AMD's slide (kura, Nov 5): along x in the picture, z up from the card (11 deep, 0 on the card): the back row
  // dark; the mesh panel's frame from x 11 to 81, z 1 to 9; its mesh inside it; the dark band by the bracket (to x 34) with "RADEON" lit in it; the
  // socket's recess (x 59-71) and its pins
  const RX9070_TOP = [[9, 82, 0, 0, "#1e1e20"], [11, 81, 1, 9, "#2a2a2e"], [13, 80, 2, 8, "#141416", "#2c2c30"], [9, 34, 8, 10, "#161618"], [13, 34, 2, 7, "#141416", "#2c2c30"],
    ...[19, 21, 23, 25, 27, 29].map((a) => [a, a, 9, 9, "#eeeef2"]), [59, 71, 1, 8, "#0a0a0b"], [60, 70, 2, 7, "#1a1a1c", "#48484e"]];
  const RX9070_BOTTOM = [[9, 55, 1, 2, "#1c2026"], [57, 77, 3, 8, "#0a0a0b", "#26262a"]];   // the board along the bottom past the fingers, then the vent (a sample's photo)
  // the GTX 1080 Ti's top and bottom (11 deep, 0 on the card), x 11 to 77: backplate, board edge, black wall, then the bevel: silver,
  // dark by the fan's housing (x 53-72); colours given per side, since the bottom is in shadow
  const GTX1080_SIDE = (back, board, wall, bevel0, bevel, fan) => [[11, 77, 0, 0, back], [11, 77, 1, 1, board], [11, 77, 2, 7, wall],
    [11, 52, 8, 8, bevel0], [11, 52, 9, 10, bevel], [53, 72, 8, 10, fan], [73, 77, 8, 8, bevel0], [73, 77, 9, 10, bevel]];
  // its lit "GEFORCE GTX", 2 x 3 px letters 1 px apart from x 38, on z 4-6 (the letters' tops toward the card, as on the real one)
  const GTX1080_LOGO = (() => {
    const G = { G: ["11", "1.", "11"], E: ["11", "1.", "11"], F: ["11", "1.", "1."], O: ["11", "11", "11"], R: ["11", "11", "1."],
      C: ["11", "1.", "11"], T: ["11", ".1", ".1"], X: ["1.", ".1", "1."] };
    let x = 38; const out = [];
    for (const ch of "GEFORCE GTX") {
      if (ch === " ") { x += 2; continue; }
      G[ch].forEach((row, j) => [...row].forEach((p, i) => p === "1" && out.push([x + i, x + i, 4 + j, 4 + j, "#7ee04a"])));
      x += 3;
    }
    return out;
  })();
  const GPU_3D = {
    // RTX 5090 Founders Edition: 304 x 137 x 40 mm, two slots, so 10 px; all-metal cover; the black middle section has two vents on
    // top and one under, and on top the lit white GeForce RTX logo and the recessed, angled 12V-2x6 socket; bracket: three
    // DisplayPorts and the HDMI, placed as on the 5080 (silver, as in the picture; the real one is black); the gold fingers 1 px off
    // the card (a real board is 1.6 mm; 1 px is about 4 mm, the least that shows)
    "rtx-5090": { groups: [
      { d: 10, boxes: [
        ...ROUND(10, [[13, 1, 70, 1], [12, 2, 73, 1], [11, 3, 74, 1], [10, 4, 76, 18], [11, 22, 75, 1], [12, 23, 73, 1], [13, 24, 72, 1], [14, 25, 69, 1]], { sides: "tbr",
          top: [[35, 59, 1, 8, "#18181a"], [36, 37, 2, 7, "#040405"], [58, 59, 2, 7, "#040405"], [39, 50, 3, 6, "#464850"], [39, 50, 4, 5, "#f4f6ff"],
                [46, 46, 4, 5, "#5a5c64"], [52, 56, 2, 7, "#0a0a0b"], [53, 55, 3, 6, "#1e1e20", "#303032"]],
          bottom: [[37, 58, 1, 8, "#131315"], [43, 52, 3, 6, "#040405"]] }),
        { x: 14, y: 0, w: 21, h: 1, sides: "tlr" }, { x: 60, y: 0, w: 22, h: 1, sides: "tlr" },   // the frame's top bars (the middle is 1 px lower)
        { x: 60, y: 26, w: 22, h: 1, sides: "blr" },                                             // the right frame's bottom bar
        { x: 6, y: 6, w: 2, h: 22, sides: "tblr", left: PORTS },                                 // the bracket, as wide as the two slots,
        ...[[1, 3], [4, 6], [7, 9]].map((z) => ({ x: 6, y: 28, w: 2, h: 5, sides: "blr", z })),   // and its three legs (kura, Nov 5: "RTX 5090 is three prong")
        { x: 3, y: 6, w: 3, h: 2, sides: "tbl", top: [[4, 4, 2, 2, "#040405"], [4, 4, 7, 7, "#040405"]] },   // its screw tab, a notch per slot
      ] },
      { d: 1, boxes: [   // the fingers, split at the picture's gaps (x 19, 22) and the key notch (x 42)
        { x: 17, y: 27, w: 2, h: 2, sides: "tblr" }, { x: 20, y: 27, w: 2, h: 4, sides: "tblr" },
        { x: 23, y: 27, w: 19, h: 4, sides: "tblr" }, { x: 43, y: 27, w: 3, h: 2, sides: "tblr" },
      ] },
    ] },
    // RTX 5080 Founders Edition: the 5090's size and design (304 x 137 mm, two slots, so 10 px). Top, from kura's photos (Nov 5): the
    // black middle section has one long vent along the fan side and the 12V-2x6 socket's recess at its far end, and the lit GeForce RTX
    // logo is on the metal just past it, toward the far end. Underneath: two small vents (LanOC). The far end is solid metal with two
    // screws for a support bracket. Bracket: the ports from kura's photo. Its picture sits 1 px further right than the 5090's
    "rtx-5080": { groups: [
      { d: 10, boxes: [
        ...ROUND(10, [[15, 1, 69, 1], [14, 2, 71, 1], [13, 3, 73, 1], [12, 4, 75, 1], [11, 5, 76, 17], [12, 22, 75, 1], [13, 23, 73, 1], [14, 24, 71, 1], [15, 25, 69, 1]], { sides: "tbr",
          top: [[37, 60, 1, 8, "#18181a"], [38, 54, 6, 7, "#040405"], [55, 59, 1, 8, "#0a0a0b"], [56, 58, 2, 7, "#1e1e20", "#303032"]],
          bottom: [[37, 59, 1, 8, "#131315"], [42, 46, 3, 6, "#040405"], [51, 55, 3, 6, "#040405"]],
          right: [[7, 8, 4, 5, "#3a3a3e"], [18, 19, 4, 5, "#3a3a3e"]] }),
        { x: 61, y: 0, w: 22, h: 1, sides: "tlr",      // the right frame's top bar (the rest of the top is 1 px lower), with the logo
          top: [[62, 77, 3, 6, "#55575c"], [63, 76, 4, 5, "#f4f6ff"], [70, 70, 4, 5, "#8a8c94"]] },
        { x: 63, y: 26, w: 20, h: 1, sides: "blr" },   // the right frame's bottom bar
        { x: 6, y: 6, w: 2, h: 22, sides: "tblr", left: PORTS },
        { x: 6, y: 28, w: 2, h: 5, sides: "blr", z: [1, 4] }, { x: 6, y: 28, w: 2, h: 5, sides: "blr", z: [6, 9] },
        { x: 2, y: 6, w: 4, h: 2, sides: "tbl", top: [[4, 4, 2, 2, "#040405"], [4, 4, 7, 7, "#040405"]] },
      ] },
      { d: 1, boxes: [   // the fingers, split at the picture's gaps (x 20, 23) and the key notch (x 42)
        { x: 18, y: 28, w: 2, h: 1, sides: "tblr" }, { x: 21, y: 28, w: 2, h: 3, sides: "tblr" },
        { x: 24, y: 28, w: 18, h: 3, sides: "tblr" }, { x: 43, y: 28, w: 2, h: 1, sides: "tblr" },
      ] },
    ] },
    // RTX 5070 Founders Edition: 242 x 112 mm, two slots (40 mm); its picture is as long as the others' (78 px), so the real card's
    // thickness at its scale is 13 px. Top, from kura's photos (Nov 5): the black middle section has two long vents side by side and
    // the 12V-2x6 socket's recess at its far end, and "GeForce RTX" is etched (not lit) on the metal over the far fan. Underneath: two
    // small vents (LanOC). The far end: threaded holes for a support bracket. Bracket (LanOC): three DisplayPorts above the HDMI, near
    // the board's side, and four large vent holes beside them (their place on the bracket isn't in the photos: put on the fan side)
    "rtx-5070": { groups: [
      { d: 13, boxes: [
        ...ROUND(13, [[12, 1, 70, 1], [11, 2, 72, 1], [10, 3, 74, 1], [9, 4, 76, 1], [8, 5, 78, 17], [9, 22, 76, 1], [10, 23, 74, 1], [11, 24, 72, 1], [12, 25, 70, 1]], { sides: "tbr",
          top: [[35, 58, 1, 11, "#18181a"], [36, 52, 6, 6, "#040405"], [36, 52, 8, 8, "#040405"], [53, 57, 2, 10, "#0a0a0b"], [54, 56, 3, 9, "#1e1e20", "#303032"]],
          bottom: [[35, 58, 1, 11, "#131315"], [40, 44, 4, 8, "#040405"], [49, 53, 4, 8, "#040405"]],
          right: [[8, 9, 6, 7, "#141416"], [18, 19, 6, 7, "#141416"]] }),
        { x: 59, y: 0, w: 22, h: 1, sides: "tlr",      // the right frame's top bar (the rest of the top is 1 px lower), with the etched logo
          top: [[66, 79, 6, 7, "#6e6e74"], [73, 73, 6, 7, "#a4a4aa"]] },
        { x: 60, y: 26, w: 21, h: 1, sides: "blr" },   // the right frame's bottom bar
        { x: 4, y: 1, w: 2, h: 27, sides: "tblr",
          left: [[4, 8, 2, 4, "dp"], [10, 14, 2, 4, "dp"], [16, 20, 2, 4, "dp"], [22, 26, 2, 4, "hdmi"],
                 [4, 8, 8, 10, "#0e0e10"], [10, 14, 8, 10, "#0e0e10"], [16, 20, 8, 10, "#0e0e10"], [22, 26, 8, 10, "#0e0e10"]] },
        { x: 4, y: 28, w: 2, h: 5, sides: "blr", z: [2, 5] },
        { x: 4, y: 28, w: 2, h: 5, sides: "blr", z: [8, 11] },
        { x: 1, y: 1, w: 3, h: 2, sides: "tbl", top: [[2, 2, 3, 3, "#040405"], [2, 2, 9, 9, "#040405"]] },
      ] },
      { d: 1, boxes: [   // the fingers, split at the picture's gaps (x 16, 20) and the key notch (x 39-40)
        { x: 14, y: 28, w: 2, h: 1, sides: "tblr" }, { x: 17, y: 28, w: 3, h: 2, sides: "tblr" },
        { x: 21, y: 28, w: 18, h: 2, sides: "tblr" }, { x: 41, y: 28, w: 3, h: 1, sides: "tblr" },
      ] },
    ] },
    // RTX 4090 Founders Edition: 304 mm long, three slots (61 mm), so 15 px at its picture's scale (73 px). Top, from kura's photos
    // (Nov 5): the black middle is open heatsink fins all the way across, with the 12VHPWR socket set into them about 60% along,
    // pointing straight up (not angled); the backlit GeForce RTX logo is on the metal over the far fan. Underneath: the angled
    // sections' fins show too (LanOC). The far end: a magnetic plate over the support-bracket screws. Bracket, from kura's photos: four
    // tall finned vents in a row, on a plate with three screws at each end, across the fan side; the three DisplayPorts and the HDMI
    // in a row on the back edge under them; plain metal on the last quarter, by the fingers. The picture is the card's back: its
    // backplate by the bracket and the far fan
    "rtx-4090": { groups: [
      { d: 15, boxes: [
        ...ROUND(15, [[14, 1, 67, 1], [13, 2, 69, 1], [12, 3, 71, 1], [11, 4, 73, 18], [12, 22, 72, 1], [13, 23, 70, 1], [14, 24, 69, 1], [15, 25, 66, 1]], { sides: "tbr",
          top: [[34, 58, 1, 13, "#141416"], ...Array.from({ length: 13 }, (_, i) => [34 + 2 * i, 34 + 2 * i, 1, 13, "#2a2a2e"]),
                [48, 51, 4, 10, "#0a0a0b"], [49, 50, 5, 9, "#1e1e20", "#303032"]],
          bottom: [[35, 58, 1, 13, "#121214"], ...Array.from({ length: 12 }, (_, i) => [36 + 2 * i, 36 + 2 * i, 1, 13, "#26262a"])],
          right: [[5, 21, 2, 2, "#4e4e54"], [5, 21, 12, 12, "#4e4e54"], [5, 5, 2, 12, "#4e4e54"], [21, 21, 2, 12, "#4e4e54"]] }),
        { x: 16, y: 0, w: 18, h: 1, sides: "tlr" },    // the frame's top bars (the middle is 1 px lower), the right one with the logo
        { x: 59, y: 0, w: 21, h: 1, sides: "tlr", top: [[64, 77, 6, 9, "#464850"], [64, 77, 7, 8, "#f4f6ff"], [72, 72, 7, 8, "#5a5c64"]] },
        { x: 61, y: 26, w: 19, h: 2, sides: "blr" },   // the right frame's bottom bar, 2 px lower
        { x: 7, y: 6, w: 3, h: 22, sides: "tblr",
          left: [[8, 26, 2, 12, "#8e8e94"],                                                          // the vents' plate
                 ...[[9, 12], [13, 16], [17, 20], [21, 25]].flatMap(([a, b]) => [[a, b, 3, 11, "#0c0c0e"],   // the four vents, finned
                   ...Array.from({ length: b - a + 1 }, (_, i) => i % 2 ? [a + i, a + i, 4, 10, "#26262a"] : null).filter(Boolean)]),
                 ...[8, 26].flatMap((a) => [[a, a, 3, 3, "#5a5a60"], [a, a, 7, 7, "#5a5a60"], [a, a, 11, 11, "#5a5a60"]]),   // its six screws
                 [9, 12, 0, 2, "dp"], [13, 16, 0, 2, "dp"], [17, 21, 0, 2, "dp"], [22, 25, 0, 2, "hdmi"]] },
        { x: 7, y: 28, w: 3, h: 5, sides: "blr", z: [1, 4] },
        { x: 7, y: 28, w: 3, h: 5, sides: "blr", z: [6, 9] },
        { x: 7, y: 28, w: 3, h: 5, sides: "blr", z: [11, 14] },
        { x: 4, y: 6, w: 3, h: 2, sides: "tbl", top: [[5, 5, 2, 2, "#040405"], [5, 5, 7, 7, "#040405"], [5, 5, 12, 12, "#040405"]] },   // a notch per slot
      ] },
      { d: 1, boxes: [   // the fingers, split at the picture's gaps (x 20, 23) and the key notch (x 42)
        { x: 18, y: 28, w: 2, h: 1, sides: "tblr" }, { x: 21, y: 28, w: 2, h: 3, sides: "tblr" },
        { x: 24, y: 28, w: 18, h: 3, sides: "tblr" }, { x: 43, y: 28, w: 3, h: 2, sides: "tblr" },
      ] },
    ] },
    // GTX 1080 Ti Founders Edition: 10.5 in (267 mm) long, two slots (40 mm), so 11 px at its picture's scale (70 px). Top and bottom
    // (GTX1080_SIDE, from kura's TechPowerUp photos, Nov 5): every pixel painted, none taken from the picture's edge (kura: "sharper",
    // "it looks too fuzzy"): from the card up, the backplate, the board's edge, the black side wall, then a thin silver bevel along the
    // face (dark where the fan's housing meets it). Top: the two gold SLI fingers by the bracket, the lit "GEFORCE GTX" (GTX1080_LOGO)
    // about halfway along, ending before the fan, and the 6-pin and 8-pin at the far end. Bottom: three screws on the bevel. The far
    // end: a small heatsink, where some air leaves (LanOC). Bracket: triangle vents
    // across most of it, and the ports in one column on its back edge: from the tab, DisplayPort, HDMI, DisplayPort, DisplayPort
    "gtx-1080-ti": { groups: [
      { d: 11, boxes: [
        ...ROUND(11, [[15, 0, 63, 1], [14, 1, 64, 1], [13, 2, 65, 1], [12, 3, 66, 1], [11, 4, 67, 18], [12, 22, 66, 1], [13, 23, 65, 1], [14, 24, 64, 1], [15, 25, 63, 1]], { sides: "tbr",
          top: [...GTX1080_SIDE("#2a2a2e", "#1c2016", "#141416", "#7c7c82", "#c4c4ca", "#2c2c30"),
                [14, 17, 1, 1, "#c9a24a"], [19, 22, 1, 1, "#c9a24a"], ...GTX1080_LOGO,
                [71, 73, 0, 3, "#2c2c30"], [71, 73, 1, 2, "#050506", "#3a3a3e"], [74, 77, 0, 3, "#2c2c30"], [74, 77, 1, 2, "#050506", "#3a3a3e"]],
          bottom: [...GTX1080_SIDE("#1e1e22", "#141810", "#0e0e10", "#5e5e64", "#9c9ca2", "#1a1a1e"),
                   [28, 28, 9, 9, "#3a3a3e"], [45, 45, 9, 9, "#3a3a3e"], [76, 76, 9, 9, "#3a3a3e"]] }, false),
        { x: 78, y: 3, w: 3, h: 21, sides: "tbr",      // the far end's faceted cap, with its little heatsink
          top: [[78, 80, 0, 0, "#2a2a2e"], [78, 80, 1, 7, "#8e8e94"], [78, 80, 8, 10, "#c4c4ca"]],
          bottom: [[78, 80, 0, 0, "#1e1e22"], [78, 80, 1, 7, "#6a6a70"], [78, 80, 8, 10, "#9c9ca2"]],
          right: [[5, 21, 2, 8, "#141416"], ...Array.from({ length: 8 }, (_, i) => [6 + 2 * i, 6 + 2 * i, 3, 7, "#2a2a2e"])] },
        { x: 9, y: 0, w: 1, h: 28, sides: "tblr",
          left: [[3, 28, 4, 10, "#141416", "#8c8c92"],
                 [5, 9, 1, 3, "dp"], [11, 14, 1, 3, "hdmi"], [16, 20, 1, 3, "dp"], [22, 26, 1, 3, "dp"]] },
        { x: 9, y: 28, w: 1, h: 4, sides: "blr", z: [2, 5] },
        { x: 9, y: 28, w: 1, h: 4, sides: "blr", z: [7, 10] },
        { x: 6, y: 0, w: 3, h: 2, sides: "tbl", top: [[7, 7, 2, 2, "#040405"], [7, 7, 8, 8, "#040405"]] },
      ] },
      { d: 1, boxes: [   // the fingers, split at the picture's gaps (x 25, 44)
        { x: 22, y: 28, w: 3, h: 2, sides: "tblr" }, { x: 26, y: 28, w: 18, h: 2, sides: "tblr" }, { x: 45, y: 28, w: 3, h: 1, sides: "tblr" },
      ] },
    ] },
    // Arc B580 Limited Edition (Intel's own): 272 x 111 x 39 mm, two slots, so 11 px at its picture's scale (76 px). Top, from kura's
    // photos (Nov 5): a black frame strip on the back half with the white-lit "intel ARC" about a quarter along, open fins on the fan
    // half, and the 8-pin socket set into the fins where the short board ends. The bottom isn't in the photos: fins and the frame strip,
    // like the top. The far end: four screw holes for a support bracket (TechPowerUp). Bracket, from kura's photo: shiny, rows of long
    // slots and round holes across the fan side, the ports along its back edge (DisplayPort, the primary DisplayPort, DisplayPort,
    // HDMI), etched logos by the fingers, and below them its two legs with a notch beside each (kura asked for that end, Nov 5)
    "arc-b580": { groups: [
      { d: 11, boxes: [
        ...ROUND(11, [[13, 0, 68, 1], [12, 1, 71, 1], [11, 2, 73, 1], [10, 3, 75, 1], [9, 4, 76, 18], [10, 22, 75, 1], [11, 23, 73, 1], [12, 24, 72, 1], [13, 25, 69, 1]], { sides: "tbr",
          top: [[9, 84, 0, 3, "#1a1a1c"], [22, 31, 1, 2, "#eef0fa"], [27, 27, 1, 2, "#2a2a2e"],
                [11, 82, 4, 9, "#0e0e10"], ...Array.from({ length: 36 }, (_, i) => [12 + 2 * i, 12 + 2 * i, 4, 9, "#28282c"]),
                [41, 46, 4, 9, "#0a0a0b"], [42, 45, 5, 8, "#1e1e20", "#303032"]],
          bottom: [[9, 84, 0, 3, "#1a1a1c"], [11, 82, 4, 9, "#0e0e10"], ...Array.from({ length: 36 }, (_, i) => [12 + 2 * i, 12 + 2 * i, 4, 9, "#26262a"])],
          right: [[8, 8, 3, 3, "#0a0a0b"], [8, 8, 7, 7, "#0a0a0b"], [18, 18, 3, 3, "#0a0a0b"], [18, 18, 7, 7, "#0a0a0b"]] }),
        { x: 62, y: 26, w: 19, h: 1, sides: "blr",     // the shroud's lower lip under the far fan
          bottom: [[62, 80, 0, 3, "#1a1a1c"], [62, 80, 4, 9, "#0e0e10"], ...Array.from({ length: 9 }, (_, i) => [63 + 2 * i, 63 + 2 * i, 4, 9, "#26262a"])] },
        { x: 6, y: 2, w: 2, h: 26, sides: "tblr",
          left: [...[[4, 4], [6, 8], [10, 10], [12, 15], [17, 17], [19, 22], [24, 24]].flatMap(([a, b]) => [9, 7, 5].map((z) => [a, b, z, z, "#141416"])),   // three rows of vents, in columns, each starting with a hole just below the tab (kura marked them), a row of metal along the fan side
                 [4, 7, 1, 3, "dp"], [9, 13, 1, 3, "dp"], [15, 19, 1, 3, "dp"], [21, 24, 1, 3, "hdmi-back"],   // the ports, a row of metal under them
                 ...[[26, 3], [26, 6], [26, 9], [27, 4], [27, 8]].map(([a, z]) => [a, a, z, z + 1, "#77777d"])] },   // the etched logos by the fingers
        { x: 6, y: 28, w: 2, h: 5, sides: "blr", z: [7, 10] },   // the bracket's two legs below it, one per slot, with a notch beside each
        { x: 6, y: 28, w: 2, h: 5, sides: "tblr", z: [2, 5] },
        { x: 3, y: 2, w: 3, h: 2, sides: "tbl", top: [[4, 4, 2, 2, "#040405"], [4, 4, 8, 8, "#040405"]] },
      ] },
      { d: 1, boxes: [   // the fingers, split at the picture's gaps (x 18, 21) and the key notch (x 40)
        { x: 16, y: 28, w: 2, h: 1, sides: "tblr" }, { x: 19, y: 28, w: 2, h: 2, sides: "tblr" },
        { x: 22, y: 28, w: 18, h: 2, sides: "tblr" }, { x: 41, y: 28, w: 3, h: 1, sides: "tblr" },
      ] },
    ] },
    // RX 9070 XT, AMD's own design (kura's choice, Nov 5): AMD showed it only as an "artistic render, not available for purchase",
    // and a few black samples turned up in China; it was never sold (PC Gamer). Top, from kura's photos of the render: a fine mesh
    // grille the whole length, the 16-pin socket in a recess about three quarters along, and a dark band on the fan side with the
    // white-lit "RADEON" by the bracket. The picture's red stripe at the top right stays, as a red band along that front edge (the
    // render's red is its lighting). Bracket, from kura's photo of a Gigabyte 9070 XT (the render doesn't show one): rows of vent
    // holes across the fan side, three DisplayPorts and the HDMI along the back edge. Bottom, from kura's photo of a black sample: the board
    // along it past the fingers, then a long vent at the far end. Not in any source: its thickness (12 px, about 2.5 slots, from the render)
    "rx-9070-xt": { groups: [
      { d: 12, boxes: [
        ...ROUND(12, [[14, 1, 66, 1], [12, 2, 70, 1], [11, 3, 73, 1], [11, 4, 74, 1], [10, 5, 75, 17], [11, 22, 74, 1], [11, 23, 73, 1], [12, 24, 72, 1], [14, 25, 68, 1]], { sides: "tbr",
          top: [[12, 83, 1, 8, "#1c1c1e", "#38383c"], [10, 84, 9, 11, "#1e1e20"], ...[13, 16, 19, 22, 25, 28].map((a) => [a, a + 1, 10, 10, "#eeeef2"])],
          bottom: [[10, 56, 1, 2, "#1c2026"], [58, 79, 3, 9, "#0a0a0b", "#26262a"]] }),   // the board past the fingers, then the vent (kura's photo of a black sample)
        { x: 35, y: 0, w: 24, h: 1, sides: "tlr", top: [[35, 58, 1, 8, "#1c1c1e", "#38383c"], [35, 58, 9, 11, "#1e1e20"]] },   // the top's raised middle and far parts
        { x: 64, y: 0, w: 15, h: 1, sides: "tlr", top: [[64, 80, 1, 8, "#1c1c1e", "#38383c"], [64, 80, 9, 11, "#a8161c"], [66, 73, 3, 8, "#0a0a0b"], [67, 72, 4, 7, "#1e1e20", "#303032"]] },
        { x: 7, y: 4, w: 1, h: 24, sides: "tblr",                // the bracket, starting where the shroud's top corner slope ends (kura)
          left: [...[[5, 7], [9, 11], [13, 15], [17, 19], [21, 23], [25, 26]].flatMap(([a, b]) => [[a, b, 6, 7, "#141416"], [a, b, 9, 10, "#141416"]]),
                 [5, 9, 1, 3, "dp"], [11, 15, 1, 3, "dp"], [17, 21, 1, 3, "dp"], [23, 26, 1, 3, "hdmi-back"]] },
        { x: 7, y: 28, w: 1, h: 7, sides: "blr", z: [1, 4] }, { x: 7, y: 28, w: 1, h: 7, sides: "blr", z: [7, 10] },
        { x: 5, y: 4, w: 2, h: 2, sides: "tbl", z: [0, 11] },   // its screw tab, at its new top
      ] },
      { d: 1, boxes: [   // the fingers, split at the picture's gap (x 22) and the key notch (x 42)
        { x: 20, y: 28, w: 2, h: 3, sides: "tblr" }, { x: 23, y: 28, w: 19, h: 3, sides: "tblr" }, { x: 43, y: 28, w: 2, h: 2, sides: "tblr" },
      ] },
    ] },
    // RX 9070, AMD's own design, like the RX 9070 XT (kura, Nov 5): AMD showed it only as an artistic render, never sold (PC Gamer,
    // Tom's Hardware); the 9070 sample that turned up in China has two fans, but the picture has the render's three. Front: kura's photo of
    // the render face on (RADEON at the top left, silver rings and wedges). Top, from AMD's "RX 9070 Series" slide (kura's photo; the
    // shorter, thinner of its two cards): a mesh panel in a frame almost the whole length, the 16-pin socket in a recess in it about 67 to
    // 84% along, and a dark band under it by the bracket, to about a third along, with the lit "RADEON". Thickness from the same slide:
    // 15% of its length, so 11 px at the picture's 74 (the XT there is 17%). The picture's red stripe (x 62-77) stays as a red band on
    // the top's front edge (the render is black). Bottom, from kura's photo of a black sample (an XT): the shroud's edge, the board along
    // it past the fingers, then a long vent at the far end. Bracket, ports and legs as on the XT. Not in any source: the far end. Its corners are rounded: the shroud is slices that follow the picture's outline
    "rx-9070": { groups: [
      { d: 11, boxes: [
        ...ROUND(11, [[14, 1, 65, 1], [12, 2, 69, 1], [11, 3, 71, 1], [10, 4, 73, 1], [10, 5, 74, 1], [9, 6, 75, 15], [10, 21, 74, 1], [10, 22, 73, 1], [11, 23, 71, 1], [12, 24, 69, 1], [14, 25, 67, 1]],
          { sides: "tbr", top: RX9070_TOP, bottom: RX9070_BOTTOM }),
        { x: 32, y: 0, w: 28, h: 1, sides: "tlr", top: RX9070_TOP },   // the top's raised middle and far parts
        { x: 62, y: 0, w: 16, h: 1, sides: "tlr", top: [...RX9070_TOP, [62, 77, 10, 10, "#a8161c"]] },
        { x: 6, y: 4, w: 1, h: 24, sides: "tblr",                // the bracket, as on the XT
          left: [...[[5, 7], [9, 11], [13, 15], [17, 19], [21, 23], [25, 26]].flatMap(([a, b]) => [[a, b, 5, 6, "#141416"], [a, b, 8, 9, "#141416"]]),
                 [5, 9, 1, 3, "dp"], [11, 15, 1, 3, "dp"], [17, 21, 1, 3, "dp"], [23, 26, 1, 3, "hdmi-back"]] },
        { x: 6, y: 28, w: 1, h: 6, sides: "blr", z: [2, 5] }, { x: 6, y: 28, w: 1, h: 6, sides: "blr", z: [7, 10] },
        { x: 4, y: 4, w: 2, h: 2, sides: "tbl", z: [0, 10] },   // its screw tab
      ] },
      { d: 1, boxes: [   // the fingers, split at the picture's gaps (x 18, 21) and the key notch (x 40)
        { x: 16, y: 28, w: 2, h: 1, sides: "tblr" }, { x: 19, y: 28, w: 2, h: 2, sides: "tblr" },
        { x: 22, y: 28, w: 18, h: 2, sides: "tblr" }, { x: 41, y: 28, w: 3, h: 1, sides: "tblr" },
      ] },
    ] },
  };
  // a port's shading (the 5080 mockup's, kura, Nov 5): i is how far along it from a0, z how far up from b0; null: the bracket's metal
  const portPaint = ([a0, a1, b0, , kind], along, z) => {
    const q = z - b0, mid = q === 1, hdmi = kind === "hdmi" || kind === "hdmi-back";
    if (hdmi && q === (kind === "hdmi" ? 2 : 0) && (along === a0 || along === a1)) return null;
    if (along === a0) return mid ? [6, 6, 7] : [18, 18, 20];
    if (along === a1) return mid ? [30, 30, 33] : [62, 62, 68];
    if (!mid) return q === 0 ? [24, 24, 27] : [46, 46, 51];
    return hdmi ? [12, 12, 14] : [34, 34, 38];
  };
  // a GPU in 3D on its face (Rob's Game's gpu3d()): pic { key, image, frames, art, spin }: image, its still 88 x 31 picture; frames, its
  // fans' 24 frames side by side (or none); art, the element on the face where the flat picture goes; spin, its fans turn
  function gpu3d(pic, shape, view) {
    const im = img(pic.image);
    if (!im.complete || !im.naturalWidth) { im.addEventListener("load", () => { if (pic.art.isConnected) gpu3d(pic, shape, view); }, { once: true }); return; }
    const cv0 = mk("canvas"); cv0.width = 88; cv0.height = 31; const ctx0 = cv0.getContext("2d"); ctx0.drawImage(im, 0, 0, 88, 31, 0, 0, 88, 31);
    const px = ctx0.getImageData(0, 0, 88, 31).data;
    const P = (x, y) => { x = Math.max(0, Math.min(87, x)); y = Math.max(0, Math.min(30, y)); const i = (y * 88 + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    const lum = (k) => .3 * k[0] + .59 * k[1] + .11 * k[2];
    const best = (pts) => pts.reduce((a, b) => (lum(b) > lum(a) ? b : a));
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const u = (n) => `calc(${n} * var(--u))`;
    // the flat picture, with the standing parts painted black so none of it peeks out
    ctx0.fillStyle = "#000"; ctx0.globalCompositeOperation = "source-atop";   // only on the picture: where it's see-through (round corners, gaps) it stays see-through
    for (const g of shape.groups) for (const b of g.boxes) ctx0.fillRect(...(b.clear ?? [b.x, b.y, b.w, b.h]));
    ctx0.globalCompositeOperation = "source-over";
    cv0.style.cssText = "display:block;width:calc(88 * var(--u));height:calc(31 * var(--u));image-rendering:pixelated";
    pic.art.replaceChildren(cv0);
    const fronts = [];   // the fronts that spin
    const groups = shape.groups.map(({ d, boxes }) => {
      const g = mk("div", "gpu3d");
      const facet = (cv, w, h, t) => {
        const f = mk("div", "f"); f.style.width = u(w); f.style.height = u(h); f.style.transform = t;
        cv.style.width = cv.style.height = "100%"; cv.style.display = "block"; cv.style.imageRendering = "pixelated"; f.append(cv); g.append(f);
      };
      const tex = (w, h, fill) => {
        const cv = mk("canvas"); cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d"), id = ctx.createImageData(w, h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = fill(i, j); if (k) id.data.set([k[0], k[1], k[2], 255], (j * w + i) * 4); }
        ctx.putImageData(id, 0, 0); return cv;
      };
      const paint = (marks, base, k, along, z) => {
        let m = null;
        for (const q of marks ?? []) if (along >= q[0] && along <= q[1] && z >= q[2] && z <= q[3]) m = q;
        if (m && (m[4] === "dp" || m[4] === "hdmi" || m[4] === "hdmi-back")) { const p = portPaint(m, along, z); if (p) return p; m = null; }
        if (m) return hex(m[5] && (along + z) % 2 ? m[5] : m[4]);
        const lit = z === 0 || z === d - 1 ? 1.08 : z === 1 || z === d - 2 ? .96 : .86;
        return base.map((q) => Math.min(255, Math.round(q * k * lit)));
      };
      const edge = (k, alt) => (lum(k) >= 20 ? k : best(alt));
      const r = (a, n) => Array.from({ length: n }, (_, i) => a + i);
      for (const b of boxes) {
        const { x, y, w, h } = b, s = b.sides ?? "tblr", [z0, z1] = b.z ?? [0, d], t = z1 - z0, zb = u(z0 - d);
        const outer = (xx, from, to) => { for (let yy = from; yy !== to; yy += Math.sign(to - from)) if (lum(P(xx, yy)) >= 20) return P(xx, yy); return null; };
        const open = (rg, xx) => !rg || xx < rg[0] || xx > rg[1];
        const topC = (xx) => (b.out && open(b.inT, xx) && outer(xx, b.out[0] - 1, y + 1)) || edge(P(xx, y), r(y, 4).map((yy) => P(xx, yy)));
        const botC = (xx) => (b.out && open(b.inB, xx) && outer(xx, b.out[1], y + h - 2)) || edge(P(xx, y + h - 1), r(y + h - 4, 4).map((yy) => P(xx, yy)));
        const leftC = (yy) => edge(P(x, yy), r(x, 4).map((xx) => P(xx, yy))), rightC = (yy) => edge(P(x + w - 1, yy), r(x + w - 4, 4).map((xx) => P(xx, yy)));
        if (s.includes("t")) facet(tex(w, t, (i, j) => b.out && !open(b.inT, x + i) ? null : paint(b.top, topC(x + i), .95, x + i, z0 + j)), w, t, `translate3d(${u(x)}, ${u(y)}, ${zb}) rotateX(90deg)`);
        if (s.includes("b")) facet(tex(w, t, (i, j) => b.out && !open(b.inB, x + i) ? null : paint(b.bottom, botC(x + i), .62, x + i, z0 + j)), w, t, `translate3d(${u(x)}, ${u(y + h)}, ${zb}) rotateX(90deg)`);
        if (s.includes("l")) facet(tex(t, h, (i, j) => paint(b.left, leftC(y + j), .78, y + j, z0 + i)), t, h, `translate3d(${u(x)}, ${u(y)}, ${zb}) rotateY(-90deg)`);
        if (s.includes("r")) facet(tex(t, h, (i, j) => paint(b.right, rightC(y + j), .78, y + j, z0 + i)), t, h, `translate3d(${u(x + w)}, ${u(y)}, ${zb}) rotateY(-90deg)`);
      }
      for (const b of boxes) {   // the fronts last: the picture's own pixels there (a part that stops short of the front: its metal)
        const z1 = (b.z ?? [0, d])[1];
        const cv = z1 === d ? mk("canvas") : tex(b.w, b.h, (i, j) => paint(null, P(b.x + i, b.y + j), .9, 0, 1));
        if (z1 === d) { cv.width = b.w; cv.height = b.h; cv.getContext("2d").drawImage(im, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); if (pic.spin) fronts.push({ cv, b }); }
        facet(cv, b.w, b.h, `translate3d(${u(b.x)}, ${u(b.y)}, ${u(z1 - d)})`);
      }
      bigFlip.append(g);
      return { g, d };
    });
    // where it sits: on the flat picture's place on the face. Built with its front on the face, then scaled toward your eye (the
    // perspective point, the middle of the big view) until its back is on the face: face on it covers the flat picture exactly, and it
    // stands d px off it
    const zbox = bigFlip.parentElement, uPx = zbox.clientWidth / view.w, zr = zbox.getBoundingClientRect(), ar = cv0.getBoundingClientRect();
    const left = (ar.left - zr.left) / uPx, top = (ar.top - zr.top) / uPx;
    const P0 = 600, z0 = .5;   // the .zbox perspective and the face's translateZ (.zflip --zd / 2), in --u
    for (const { g, d } of groups) {
      const sc = (P0 - z0) / (P0 - z0 + d);
      g.style.left = u(left); g.style.top = u(top);
      g.style.transformOrigin = `${u(view.w / 2 - left)} ${u(view.h / 2 - top)} ${u(P0 - z0)}`;
      g.style.transform = `translateZ(${u(z0 + .01)}) scale3d(${sc}, ${sc}, ${sc})`;
    }
    if (!fronts.length || !pic.frames) return;
    const frames = img(pic.frames);
    let tick = 0;
    clearInterval(gpuSpin);
    gpuSpin = setInterval(() => {
      if (!fronts[0]?.cv.isConnected) { clearInterval(gpuSpin); gpuSpin = null; return; }
      if (!frames.complete || !frames.naturalWidth) return;
      tick = (tick + 1) % SPIN_FRAMES;
      for (const { cv, b } of fronts) { const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, b.w, b.h); ctx.drawImage(frames, tick * 88 + b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); }
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? SPIN_MS * 4 : SPIN_MS);
  }
  // a 3D printed button (88x31's reliefs, kura, Nov 5: "Under Construction, Synthwave and Island Life would turn in 3D on every site,
  // just like the GPUs"): its picture in thin layers every SLICE art pixels up from the face, each layer only the pixels that stand
  // at least that tall (1 art pixel = 1 mm, as printed), the parts below a pixel's top a little darker so the steps show. Built with
  // canvases that are only drawn on, never read, so the picture may come from any site.
  const SLICE = 0.2;
  function relief3d(rel, e, view) {
    const im = new Image();
    im.onload = () => {
      if (!rel.art.isConnected || !bigFlip) return;
      const top = [...e.map].map((d) => e.floor + Number(d) * e.step), most = Math.max(...top);
      const mask = (keep) => { const c = mk("canvas"); c.width = 88; c.height = 31; const x = c.getContext("2d"), id = x.createImageData(88, 31);
        for (let i = 0; i < 2728; i++) if (keep(top[i])) id.data[i * 4 + 3] = 255; x.putImageData(id, 0, 0); return c; };
      // where the picture is on the face, inside its border: in --u, from the box's top left
      const pic = /^(IMG|CANVAS)$/.test(rel.art.tagName) ? rel.art : rel.art.querySelector("img, canvas") || rel.art;
      const zbox = bigFlip.parentElement, uPx = zbox.clientWidth / view.w, zr = zbox.getBoundingClientRect(), pr = pic.getBoundingClientRect(), cs = getComputedStyle(pic);
      const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
      const left = (pr.left + bl - zr.left) / uPx, topU = (pr.top + bt - zr.top) / uPx;
      const w = (pr.width - bl - (parseFloat(cs.borderRightWidth) || 0)) / uPx, h = (pr.height - bt - (parseFloat(cs.borderBottomWidth) || 0)) / uPx, px = w / 88;
      const P0 = 600, z0 = .5;   // the .zbox perspective and the face's translateZ, in --u
      for (let a = SLICE; a <= most + 1e-6; a += SLICE) {
        const c = mk("canvas"); c.width = 88; c.height = 31; const x = c.getContext("2d");
        x.drawImage(im, 0, 0, 88, 31);
        x.globalCompositeOperation = "destination-in"; x.drawImage(mask((t) => t >= a - 1e-6), 0, 0);
        x.globalCompositeOperation = "source-atop"; x.globalAlpha = .45; x.drawImage(mask((t) => t - a >= SLICE - 1e-6), 0, 0);
        const z = a * px, sc = (P0 - z0 - z) / (P0 - z0);   // scaled toward your eye, so face on it lies exactly over the picture
        c.className = "relief3d";
        c.style.cssText = `position:absolute;left:calc(${left} * var(--u));top:calc(${topU} * var(--u));width:calc(${w} * var(--u));height:calc(${h} * var(--u));image-rendering:pixelated;pointer-events:none;`
          + `transform-origin:calc(${view.w / 2 - left} * var(--u)) calc(${view.h / 2 - topU} * var(--u));transform:translateZ(calc(${z0 + z} * var(--u))) scale(${sc})`;
        bigFlip.append(c);
      }
    };
    im.src = rel.image;
  }
  window.DDZoom = { setup(o) { opts = o; getReliefs(); }, busy: () => held || !!bigCard, mouse: () => !!bigBy, close: hideBig };
}
// the script a page loads: the function above, run once. Cloudflare's build (esbuild, keeping function names) puts __name(...) calls
// inside it, and __name only exists in the Worker, so the page gets a stand-in that does nothing (Nov 5: without it /zoom.js stopped at
// "__name is not defined" on every page, and no big view opened anywhere)
export const ZOOM_JS = "(function () { var __name = function (f) { return f; };\n(" + zoomClient.toString() + ")();\n})();\n";
