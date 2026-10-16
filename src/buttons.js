// 88x31 buttons -> item rows. Input is the list from 88x31's public catalog (GET /api/designs -> { designs: [...] }).
// Offered: original tier, common or uncommon, uncapped, active, and not a mystery to a logged-out viewer. Everything
// else (rare, prototype, ultra, special, capped, archive, hidden, removed) is left out: those are scarce there.
export const IMAGE = (id) => `https://88x31.app/api/img?d=${id}`;
export function fromApi(designs) {
  return designs
    .filter((d) => !d.hidden && d.status === "active" && d.max_editions == null && d.tier === "original" && (d.rarity === "common" || d.rarity === "uncommon"))
    .sort((a, b) => a.id - b.id)
    .map((d) => ({ source: "88x31", source_key: String(d.id), rarity: d.rarity, name: d.name, note: null, type: d.type, image: IMAGE(d.id), extra: {} }));
}
