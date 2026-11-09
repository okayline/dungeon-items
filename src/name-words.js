// The shared player-name words: a name is one adjective then one noun, "Neon Modem". The master list for every game
// (Nov 8, 2026). Games keep their own copy of these two lists in their names code, which says it was copied from here;
// a change here is copied over to each of them by hand. 40 + 40 on purpose (kura: "keep it manageable and small").
// Dawn Baton and irl-dungeon store a name as the words' places in these lists ("adj:3", "noun:7"), so add new words at
// the END and never reorder: moving or swapping a word renames every player who has it.
export const NAME_ADJECTIVES = [
  "Quiet", "Sleepy", "Misty", "Golden", "Silver", "Glowing", "Lucky", "Little", "Mellow", "Sunny",
  "Drowsy", "Faint", "Distant", "Midnight", "Neon", "Pixel", "Static", "Chrome", "Analog", "Turbo",
  "Hyper", "Mega", "Blinking", "Spinning", "Glitchy", "Fuzzy", "Cosmic", "Lunar", "Electric", "Velvet",
  "Bubble", "Plastic", "Candy", "Laser", "Retro", "Wired", "Offline", "Lagging", "Secret", "Shiny",
];
export const NAME_NOUNS = [
  "Modem", "Cursor", "Floppy", "Pager", "Sprite", "Cassette", "Arcade", "Byte", "Beeper", "Satellite",
  "Antenna", "Jukebox", "Robot", "Rocket", "Respawn", "Emoticon", "Cartridge", "Banner", "Marquee", "Joystick",
  "Mixtape", "Webring", "Guestbook", "Keyboard", "Boombox", "Popup", "Inbox", "Desktop", "Bookmark", "Mouse",
  "Icon", "Chip", "Signal", "Radio", "Screen", "Widget", "Cable", "Button", "Gadget", "Console",
];
