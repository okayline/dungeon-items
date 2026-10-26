// The shared mark vocabulary: every mark value a game writes, and the words the ledger page shows for it. Games add
// their new values here (a new deed is a new line, no migration); a value missing here still shows, as "got a mark: ...".
// Words are placeholders until the owner rewrites them. After 4Dungeon's own (rules.js DEED_WORDS, PHASE_WORDS, OCC_WORDS,
// MOON_WORDS, MORE_WORDS) and irl-dungeon's. The ledger page runs this same code (public-ledger.js WORDS_SCRIPT), so
// keep it plain: no imports, nothing but these names.
export const PHASE = { new: "a new moon", wax_cres: "a waxing crescent moon", first_q: "a first quarter moon", wax_gib: "a waxing gibbous moon",
  full: "a full moon", wan_gib: "a waning gibbous moon", last_q: "a last quarter moon", wan_cres: "a waning crescent moon" };
export const OCC = { thirteenth_moon: "under the Thirteenth Moon", eclipse_solar: "during a solar eclipse", eclipse_lunar: "during a lunar eclipse",
  blue_moon: "under a blue moon", supermoon: "under a supermoon", solstice: "on a solstice", equinox: "on an equinox", mirror_day: "on a mirror day" };
export const DEED = { found_wall: "was found in a wall", from_demon: "came from a demon", given_member: "was a gift from a friend", from_stranger: "was left by a stranger",
  made_compiler: "was made by COMPILER", copied_cache: "was copied by CACHE", kit: "was brought along", moon_gift: "was a gift from the Moon",
  found_inside: "was found inside something", carried_up: "was carried up a level", first_copy: "is the very first one ever made", hundredth_copy: "is the hundredth one made",
  in_locker: "was in a hidden locker", in_archive: "was in the Archive", deep_stone: "was deep in the stone",   // 4Dungeon v1.33
  beat_demon: "saw a demon fall", talked_down: "saw a demon talked down", fled_fight: "escaped a fight", through_door: "went through a locked door",
  found_outside: "was found outside, in the real world",                                                  // irl-dungeon v0.22
  pulled_pack: "was pulled from a pack", free_pack: "came in a Free Pack", welcome_gift: "was a welcome gift", daily_pick: "was a daily pick",   // 88x31 v0.46
  passed_on: "was passed on by another player", set_reward: "was a reward for a finished set", from_webmaster: "came from the webmaster",
  first_print: "is a First Print, made before foils", traded: "was traded", gifted: "was given as a gift", guestbook_gift: "was left in a guestbook",
  filled_request: "filled a request", fused: "survived a fusion",
  survived_clutch: "was carried through a CLUTCH run",                                                     // TILT.EXE v0.19
  cleared_deck: "was carried through a cleared deck",           // scoundrel.exe v0.9
  toppled_farm: "was there when a farm fell",                   // aura-farm v0.108
  won_daily: "was carried to first place in a Daily",           // NANO PITCH v0.13
  kept_beat: "kept the beat through a whole run",               // moba-beat v0.11
  rode_with_baton: "rode along with the baton",                 // Dawn Baton v0.27
  first_in_wing: "was first through a wing",                    // irl-dungeon v0.23
  kept_one_of_one: "was there when a 1-of-1 was kept",          // 88x31 v0.47
  filled_sheet: "was carried through a full sheet",             // SCATTER.EXE v0.2.0
  wrote_crowd: "was there when the crowd got its answers",       // TriviaMoba v0.19
};
// an 88x31 finish (foil_holo, pattern_etched, effect_crt_vhs): its name from the id, except the effects that are written oddly
export const EFFECT = { dialup: "Dial-Up", crt: "CRT", vhs: "VHS", crt_vhs: "CRT+VHS" };
const title = (id) => EFFECT[id] || id.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const an = (w) => (/^[AEIOU]/.test(w) ? "an " : "a ") + w;
export function finishWords(v) {
  const m = v.match(/^(foil|pattern|effect)_([a-z0-9_]+)$/);
  return m ? "has " + an(title(m[2])) + " " + m[1] : null;
}
export const MOON = { answered: "answered the Moon", blessed: "was blessed by the Moon" };
export function markWords(r) {
  if (r.kind === "night") return PHASE[r.value] ? "was found under " + PHASE[r.value] : OCC[r.value] ? "was found " + OCC[r.value] : null;
  if (r.kind === "moon") return MOON[r.value] || null;
  if (/^on_(b[0-9]|[0-9]+)f$/.test(r.value)) return "was picked up on " + r.value.slice(3).toUpperCase();   // the level (4Dungeon v1.33)
  if (/^dawn_band_[0-9]+$/.test(r.value)) return "was born at dawn, band " + r.value.slice(10);   // Dawn Baton v0.27
  if (/^dawn_sky_[a-z0-9_]+$/.test(r.value)) return "was born under a " + r.value.slice(9).replace(/_/g, " ") + " dawn sky";
  return DEED[r.value] || finishWords(r.value);
}

// the page's copy of the above, as script text
export const WORDS_SCRIPT = [["PHASE", PHASE], ["OCC", OCC], ["DEED", DEED], ["EFFECT", EFFECT], ["MOON", MOON]]
  .map(([k, v]) => "const " + k + " = " + JSON.stringify(v) + ";").join("\n")
  + "\nconst title = " + title + ";\nconst an = " + an + ";\n" + finishWords + "\n" + markWords;
