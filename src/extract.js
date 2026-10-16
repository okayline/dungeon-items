// Pull the item lists out of 4Dungeon's rules.js text. The lists are plain JavaScript, so each is cut out by its
// braces and evaluated alone (the three uncommon items with a "use" are functions; they are not run, only noticed).
const grab = (src, name) => {
  const start = src.indexOf("const " + name + " = {");
  if (start < 0) throw new Error("rules.js has no " + name);
  let i = src.indexOf("{", start), depth = 0, q = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === "\\") j++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error("unbalanced " + name);
};
const evalObj = (text) => new Function("heal", "calm", "return (" + text + ")")(() => {}, () => {});

export function extract(src) {
  const catalog = evalObj(grab(src, "CATALOG")), align = evalObj(grab(src, "ITEM_ALIGN")),
    nature = evalObj(grab(src, "ITEM_NATURE")), both = evalObj(grab(src, "BOTH_NAME"));
  const out = [];
  for (const rarity of ["COMMON", "UNCOMMON", "RARE", "MYTHIC", "MOON"]) {
    catalog[rarity].forEach(([name, note, use, useText], n) => {
      if (!align[name] || !nature[name]) throw new Error("no alignment or nature for " + name);
      const extra = {};
      if (use) { extra.has_use = true; extra.use_text = useText; }
      if (both[name]) extra.both_name = both[name];
      out.push({ source: "4dungeon", source_key: rarity + ":" + n, rarity: rarity.toLowerCase(), name, note, alignment: align[name], nature: nature[name], extra });
    });
  }
  return out;
}
