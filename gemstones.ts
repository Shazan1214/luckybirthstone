export interface GemstoneEntry {
  name: string;
  category: string;
  aliases: string[];
}

export const GEMSTONES: GemstoneEntry[] = [
  // ── DIAMOND ─────────────────────────────────────────────────────────
  { name: "Diamond", category: "Diamond", aliases: ["Heera", "Hira", "Almaz"] },
  { name: "Colored Diamond", category: "Diamond", aliases: ["Fancy Diamond", "Fancy Color Diamond"] },
  { name: "Pink Diamond", category: "Diamond", aliases: ["Fancy Pink Diamond"] },
  { name: "Blue Diamond", category: "Diamond", aliases: ["Fancy Blue Diamond"] },
  { name: "Yellow Diamond", category: "Diamond", aliases: ["Canary Diamond", "Fancy Yellow Diamond"] },
  { name: "Black Diamond", category: "Diamond", aliases: ["Carbonado"] },

  // ── RUBY ────────────────────────────────────────────────────────────
  { name: "Ruby", category: "Ruby", aliases: ["Manik", "Yakoot", "Lat"] },
  { name: "Burma Ruby", category: "Ruby", aliases: ["Burmese Ruby", "Myanmar Ruby", "Pigeon Blood Ruby", "Mogok Ruby"] },
  { name: "Mozambique Ruby", category: "Ruby", aliases: ["African Ruby"] },
  { name: "Pigeon Blood Ruby", category: "Ruby", aliases: ["Kabootar Khoon", "Burma Pigeon Blood"] },
  { name: "Star Ruby", category: "Ruby", aliases: ["Asterism Ruby", "Six-Ray Ruby"] },
  { name: "Ceylon Ruby", category: "Ruby", aliases: ["Sri Lanka Ruby"] },

  // ── SAPPHIRE ────────────────────────────────────────────────────────
  { name: "Blue Sapphire", category: "Sapphire", aliases: ["Neelam", "Nilam", "Indraneel", "Yakoot Azraq", "Royal Blue Sapphire"] },
  { name: "Yellow Sapphire", category: "Sapphire", aliases: ["Pukhraj", "Pushparagam", "Pushkaraj", "Yakoot Asfar", "Golden Sapphire"] },
  { name: "Pink Sapphire", category: "Sapphire", aliases: ["Pink Stone", "Rose Sapphire"] },
  { name: "White Sapphire", category: "Sapphire", aliases: ["Safed Pukhraj", "White Neelam", "Colorless Sapphire"] },
  { name: "Padparadscha Sapphire", category: "Sapphire", aliases: ["Padparadscha", "Lotus Sapphire", "Salmon Sapphire"] },
  { name: "Star Sapphire", category: "Sapphire", aliases: ["Asterism Sapphire", "Six-Ray Sapphire"] },
  { name: "Kashmir Sapphire", category: "Sapphire", aliases: ["Cornflower Blue Sapphire", "Velvety Blue Sapphire"] },
  { name: "Ceylon Sapphire", category: "Sapphire", aliases: ["Sri Lanka Sapphire"] },
  { name: "Montana Sapphire", category: "Sapphire", aliases: ["American Sapphire"] },
  { name: "Orange Sapphire", category: "Sapphire", aliases: ["Mandarin Sapphire"] },
  { name: "Purple Sapphire", category: "Sapphire", aliases: ["Violet Sapphire"] },
  { name: "Teal Sapphire", category: "Sapphire", aliases: ["Australian Sapphire", "Color Change Sapphire"] },
  { name: "Color Change Sapphire", category: "Sapphire", aliases: ["Alexandrite-like Sapphire"] },

  // ── EMERALD ─────────────────────────────────────────────────────────
  { name: "Emerald", category: "Emerald", aliases: ["Panna", "Zamurd", "Zamarrud", "Zumurrud"] },
  { name: "Colombian Emerald", category: "Emerald", aliases: ["Muzo Emerald", "Chivor Emerald", "Coscuez Emerald"] },
  { name: "Zambian Emerald", category: "Emerald", aliases: ["African Emerald", "Kafubu Emerald"] },
  { name: "Panjshir Emerald", category: "Emerald", aliases: ["Afghan Emerald", "Afghanistan Emerald"] },
  { name: "Brazilian Emerald", category: "Emerald", aliases: ["Santa Terezinha Emerald"] },
  { name: "No Oil Emerald", category: "Emerald", aliases: ["Untreated Emerald", "Natural Emerald No Enhancement"] },

  // ── ALEXANDRITE ─────────────────────────────────────────────────────
  { name: "Alexandrite", category: "Alexandrite", aliases: ["Color Change Chrysoberyl", "Alexandrite Chrysoberyl"] },
  { name: "Brazilian Alexandrite", category: "Alexandrite", aliases: [] },
  { name: "Russian Alexandrite", category: "Alexandrite", aliases: ["Ural Alexandrite"] },

  // ── TANZANITE ───────────────────────────────────────────────────────
  { name: "Tanzanite", category: "Tanzanite", aliases: ["Blue Zoisite", "Merelani Tanzanite"] },

  // ── SPINEL ──────────────────────────────────────────────────────────
  { name: "Spinel", category: "Spinel", aliases: ["Laal Yaqoot", "Spinel Ruby"] },
  { name: "Red Spinel", category: "Spinel", aliases: ["Burma Spinel", "Balas Ruby"] },
  { name: "Pink Spinel", category: "Spinel", aliases: [] },
  { name: "Blue Spinel", category: "Spinel", aliases: [] },
  { name: "Cobalt Blue Spinel", category: "Spinel", aliases: ["Cobalt Spinel", "Vietnamese Spinel"] },
  { name: "Black Spinel", category: "Spinel", aliases: [] },

  // ── TOURMALINE ──────────────────────────────────────────────────────
  { name: "Tourmaline", category: "Tourmaline", aliases: ["Turmali"] },
  { name: "Paraiba Tourmaline", category: "Tourmaline", aliases: ["Cuprian Tourmaline", "Neon Blue Tourmaline"] },
  { name: "Rubellite Tourmaline", category: "Tourmaline", aliases: ["Red Tourmaline", "Pink Tourmaline"] },
  { name: "Indicolite Tourmaline", category: "Tourmaline", aliases: ["Blue Tourmaline", "Indigolite"] },
  { name: "Chrome Tourmaline", category: "Tourmaline", aliases: ["Green Tourmaline"] },
  { name: "Watermelon Tourmaline", category: "Tourmaline", aliases: [] },
  { name: "Bi-color Tourmaline", category: "Tourmaline", aliases: ["Multicolor Tourmaline"] },

  // ── GARNET ──────────────────────────────────────────────────────────
  { name: "Garnet", category: "Garnet", aliases: ["Gomed Rough", "Yakoot Kirmizi"] },
  { name: "Hessonite Garnet", category: "Garnet", aliases: ["Gomed", "Gomedh", "Cinnamon Stone", "Hessonite"] },
  { name: "Tsavorite Garnet", category: "Garnet", aliases: ["Tsavorite", "Green Grossular"] },
  { name: "Spessartite Garnet", category: "Garnet", aliases: ["Spessartine", "Mandarin Garnet", "Fanta Garnet"] },
  { name: "Rhodolite Garnet", category: "Garnet", aliases: ["Rhodolite", "Rose Garnet"] },
  { name: "Almandine Garnet", category: "Garnet", aliases: ["Almandite", "Iron Garnet"] },
  { name: "Pyrope Garnet", category: "Garnet", aliases: ["Bohemian Garnet", "Cape Ruby"] },
  { name: "Demantoid Garnet", category: "Garnet", aliases: ["Green Andradite", "Ural Emerald"] },
  { name: "Mali Garnet", category: "Garnet", aliases: ["Grossular-Andradite Hybrid"] },
  { name: "Color Change Garnet", category: "Garnet", aliases: [] },

  // ── CAT'S EYE ───────────────────────────────────────────────────────
  { name: "Cat's Eye Chrysoberyl", category: "Cat's Eye", aliases: ["Lehsunia", "Lahsuniya", "Vaidurya", "Chrysoberyl Cat's Eye"] },
  { name: "Quartz Cat's Eye", category: "Cat's Eye", aliases: ["Tiger Eye Quartz", "Cat's Eye Quartz"] },

  // ── TOPAZ ───────────────────────────────────────────────────────────
  { name: "Topaz", category: "Topaz", aliases: ["Pukraj Topaz"] },
  { name: "Imperial Topaz", category: "Topaz", aliases: ["Golden Topaz", "Orange Topaz", "Precious Topaz"] },
  { name: "Yellow Topaz", category: "Topaz", aliases: ["Golden Yellow Topaz"] },
  { name: "Blue Topaz", category: "Topaz", aliases: ["London Blue Topaz", "Swiss Blue Topaz", "Sky Blue Topaz"] },
  { name: "White Topaz", category: "Topaz", aliases: ["Colorless Topaz", "Silver Topaz"] },
  { name: "Pink Topaz", category: "Topaz", aliases: ["Rose Topaz"] },

  // ── OPAL ────────────────────────────────────────────────────────────
  { name: "Opal", category: "Opal", aliases: ["Dudhiya Patthar"] },
  { name: "White Opal", category: "Opal", aliases: ["Light Opal", "Crystal Opal"] },
  { name: "Black Opal", category: "Opal", aliases: ["Dark Opal", "Lightning Ridge Opal"] },
  { name: "Fire Opal", category: "Opal", aliases: ["Mexican Fire Opal", "Orange Opal"] },
  { name: "Boulder Opal", category: "Opal", aliases: ["Queensland Opal"] },
  { name: "Ethiopian Opal", category: "Opal", aliases: ["Welo Opal", "Hydrophane Opal"] },

  // ── QUARTZ ──────────────────────────────────────────────────────────
  { name: "Clear Quartz", category: "Quartz", aliases: ["Sphatik", "Spatik", "Crystal Quartz", "Rock Crystal"] },
  { name: "Rose Quartz", category: "Quartz", aliases: ["Pink Quartz", "Love Stone"] },
  { name: "Smoky Quartz", category: "Quartz", aliases: ["Cairngorm", "Morion"] },
  { name: "Citrine", category: "Quartz", aliases: ["Lemon Quartz", "Yellow Quartz", "Sunhela"] },
  { name: "Rutilated Quartz", category: "Quartz", aliases: ["Sagenitic Quartz", "Venus Hair Stone"] },
  { name: "Amethyst", category: "Quartz", aliases: ["Jamuniya", "Katela", "Purple Quartz"] },
  { name: "Ametrine", category: "Quartz", aliases: ["Bolivianite", "Trystine"] },
  { name: "Aventurine", category: "Quartz", aliases: ["Green Quartz", "Sunstone Quartz"] },
  { name: "Chalcedony", category: "Quartz", aliases: ["Blue Chalcedony", "Chrysoprase base"] },
  { name: "Agate", category: "Quartz", aliases: ["Aqeeq", "Haqeeq", "Hakik"] },
  { name: "Sulemani Agate", category: "Quartz", aliases: ["Sulemani Hakik", "Sulaimani Aqeeq", "Kala Hakik"] },
  { name: "Yemeni Agate", category: "Quartz", aliases: ["Yemeni Aqeeq", "Arabian Aqeeq", "Yamani Aqeeq"] },
  { name: "Red Agate", category: "Quartz", aliases: ["Red Aqeeq", "Red Hakik", "Lal Aqeeq"] },
  { name: "Black Agate", category: "Quartz", aliases: ["Black Aqeeq", "Black Hakik", "Kala Aqeeq"] },
  { name: "Carnelian", category: "Quartz", aliases: ["Red Chalcedony", "Cornelian"] },
  { name: "Onyx", category: "Quartz", aliases: ["Black Onyx", "Sang-e-Sulemani"] },
  { name: "Jasper", category: "Quartz", aliases: ["Red Jasper", "Fancy Jasper"] },
  { name: "Bloodstone", category: "Quartz", aliases: ["Heliotrope", "Green Jasper with Red Spots"] },
  { name: "Tiger's Eye", category: "Quartz", aliases: ["Tiger Eye", "Hawks Eye", "Hawk's Eye"] },
  { name: "Chrysoprase", category: "Quartz", aliases: ["Australian Jade", "Green Chalcedony"] },

  // ── JADE ────────────────────────────────────────────────────────────
  { name: "Jadeite", category: "Jade", aliases: ["Imperial Jade", "Jade", "Yu"] },
  { name: "Nephrite", category: "Jade", aliases: ["Mutton Fat Jade", "Canadian Jade"] },
  { name: "Burmese Jade", category: "Jade", aliases: ["Myanmar Jade", "Burmese Jadeite"] },

  // ── PEARL ───────────────────────────────────────────────────────────
  { name: "Pearl", category: "Pearl", aliases: ["Moti", "Lulu", "Mukta"] },
  { name: "South Sea Pearl", category: "Pearl", aliases: ["White South Sea Pearl", "Golden South Sea Pearl"] },
  { name: "Tahitian Pearl", category: "Pearl", aliases: ["Black Pearl", "Tahitian Black Pearl"] },
  { name: "Akoya Pearl", category: "Pearl", aliases: ["Japanese Pearl", "Classic White Pearl"] },
  { name: "Freshwater Pearl", category: "Pearl", aliases: ["Chinese Pearl"] },
  { name: "Basra Pearl", category: "Pearl", aliases: ["Gulf Pearl", "Natural Pearl"] },

  // ── CORAL ───────────────────────────────────────────────────────────
  { name: "Red Coral", category: "Coral", aliases: ["Moonga", "Monga", "Marjan", "Praval"] },
  { name: "Italian Coral", category: "Coral", aliases: ["Mediterranean Coral", "Sciacca Coral"] },
  { name: "Japanese Coral", category: "Coral", aliases: ["Satsuma Coral"] },
  { name: "White Coral", category: "Coral", aliases: ["Safed Moonga", "White Moonga"] },

  // ── TURQUOISE ───────────────────────────────────────────────────────
  { name: "Turquoise", category: "Turquoise", aliases: ["Firoza", "Feroza", "Ferozeh", "Pirooz"] },
  { name: "Persian Turquoise", category: "Turquoise", aliases: ["Iranian Firoza", "Nishapur Firoza", "Iranian Turquoise"] },
  { name: "Yemeni Turquoise", category: "Turquoise", aliases: ["Yemeni Firoza", "Arabian Turquoise"] },
  { name: "Sleeping Beauty Turquoise", category: "Turquoise", aliases: ["Arizona Turquoise", "American Turquoise"] },
  { name: "Tibetan Turquoise", category: "Turquoise", aliases: ["Chinese Turquoise"] },

  // ── LAPIS LAZULI ────────────────────────────────────────────────────
  { name: "Lapis Lazuli", category: "Lapis Lazuli", aliases: ["Lajward", "Lajvard", "Lazuli", "Azul"] },
  { name: "Afghan Lapis Lazuli", category: "Lapis Lazuli", aliases: ["Badakhshan Lapis", "Sar-e-Sang Lapis"] },

  // ── PERIDOT ─────────────────────────────────────────────────────────
  { name: "Peridot", category: "Peridot", aliases: ["Zabarjad", "Zabargad", "Olivine", "Chrysolite"] },
  { name: "Kashmiri Peridot", category: "Peridot", aliases: [] },

  // ── ZIRCON ──────────────────────────────────────────────────────────
  { name: "Zircon", category: "Zircon", aliases: ["Jarkan", "Zarkon", "Hyacinth"] },
  { name: "Blue Zircon", category: "Zircon", aliases: ["Cambodian Zircon", "Ratanakiri Zircon"] },
  { name: "Yellow Zircon", category: "Zircon", aliases: ["Jargoon"] },

  // ── MOONSTONE ───────────────────────────────────────────────────────
  { name: "Moonstone", category: "Feldspar", aliases: ["Chandrakant", "Chandrakant Mani", "Chandrmani", "Adularia"] },
  { name: "Rainbow Moonstone", category: "Feldspar", aliases: ["Blue Moonstone", "Labradorite Moonstone"] },

  // ── SUNSTONE ────────────────────────────────────────────────────────
  { name: "Sunstone", category: "Feldspar", aliases: ["Heliolite", "Oregon Sunstone"] },

  // ── LABRADORITE ─────────────────────────────────────────────────────
  { name: "Labradorite", category: "Feldspar", aliases: ["Spectrolite", "Black Moonstone"] },
  { name: "Amazonite", category: "Feldspar", aliases: ["Amazon Stone", "Amazon Jade"] },

  // ── IOLITE ──────────────────────────────────────────────────────────
  { name: "Iolite", category: "Iolite", aliases: ["Neeli", "Nili", "Water Sapphire", "Cordierite", "Dichroite"] },

  // ── AQUAMARINE ──────────────────────────────────────────────────────
  { name: "Aquamarine", category: "Beryl", aliases: ["Sea Water Stone", "Ferozi Patthar", "Santa Maria Aquamarine"] },

  // ── BERYL ───────────────────────────────────────────────────────────
  { name: "Beryl", category: "Beryl", aliases: [] },
  { name: "Morganite", category: "Beryl", aliases: ["Pink Beryl", "Rose Beryl", "Cesian Beryl"] },
  { name: "Heliodor", category: "Beryl", aliases: ["Golden Beryl", "Yellow Beryl"] },
  { name: "Goshenite", category: "Beryl", aliases: ["White Beryl", "Colorless Beryl"] },
  { name: "Red Beryl", category: "Beryl", aliases: ["Bixbite", "Scarlet Emerald"] },

  // ── SPODUMENE ───────────────────────────────────────────────────────
  { name: "Kunzite", category: "Spodumene", aliases: ["Pink Spodumene", "Lilac Stone"] },
  { name: "Hiddenite", category: "Spodumene", aliases: ["Green Spodumene", "Lithia Emerald"] },

  // ── OTHER RARE GEMS ─────────────────────────────────────────────────
  { name: "Tanzanite", category: "Tanzanite", aliases: ["Blue Zoisite"] },
  { name: "Ruby Zoisite", category: "Zoisite", aliases: ["Anyolite"] },
  { name: "Thulite", category: "Zoisite", aliases: ["Pink Zoisite"] },
  { name: "Kyanite", category: "Kyanite", aliases: ["Disthene", "Blue Kyanite"] },
  { name: "Andalusite", category: "Andalusite", aliases: ["Chiastolite", "Cross Stone"] },
  { name: "Apatite", category: "Apatite", aliases: ["Neon Blue Apatite", "Paraiba Apatite"] },
  { name: "Fluorite", category: "Fluorite", aliases: ["Fluorspar", "CaF2"] },
  { name: "Diopside", category: "Diopside", aliases: [] },
  { name: "Chrome Diopside", category: "Diopside", aliases: ["Siberian Emerald"] },
  { name: "Prehnite", category: "Prehnite", aliases: ["Cape Emerald"] },
  { name: "Rhodochrosite", category: "Rhodochrosite", aliases: ["Inca Rose", "Manganese Spar"] },
  { name: "Rhodonite", category: "Rhodonite", aliases: ["Manganese Silicate"] },
  { name: "Malachite", category: "Malachite", aliases: ["Green Copper Stone"] },
  { name: "Azurite", category: "Azurite", aliases: ["Blue Malachite", "Chessylite"] },
  { name: "Chrysocolla", category: "Chrysocolla", aliases: ["Eilat Stone"] },
  { name: "Larimar", category: "Larimar", aliases: ["Blue Pectolite", "Atlantis Stone"] },
  { name: "Sugilite", category: "Sugilite", aliases: ["Royal Lavulite", "Luvulite"] },
  { name: "Charoite", category: "Charoite", aliases: ["Siberian Lilac Stone"] },
  { name: "Danburite", category: "Danburite", aliases: [] },
  { name: "Benitoite", category: "Benitoite", aliases: ["California Blue Sapphire"] },
  { name: "Painite", category: "Painite", aliases: ["Burmese Rare Gem"] },
  { name: "Taaffeite", category: "Taaffeite", aliases: ["Mauve Spinel", "Musgravite"] },
  { name: "Grandidierite", category: "Grandidierite", aliases: ["Rare Blue Green Gem"] },
  { name: "Jeremejevite", category: "Jeremejevite", aliases: ["Namibian Rare Gem"] },
  { name: "Hackmanite", category: "Hackmanite", aliases: ["Tenebrescent Sodalite"] },
  { name: "Phenakite", category: "Phenakite", aliases: ["Phenacite"] },
  { name: "Scapolite", category: "Scapolite", aliases: ["Wernerite", "Cat's Eye Scapolite"] },
  { name: "Sphene", category: "Sphene", aliases: ["Titanite", "Tit Gem"] },
  { name: "Hematite", category: "Hematite", aliases: ["Iron Rose", "Blood Stone Iron"] },
  { name: "Pyrite", category: "Pyrite", aliases: ["Fool's Gold"] },
  { name: "Obsidian", category: "Obsidian", aliases: ["Volcanic Glass"] },
  { name: "Jet", category: "Jet", aliases: ["Black Amber", "Lignite Gem"] },
  { name: "Amber", category: "Amber", aliases: ["Kahruba", "Kahraman", "Baltic Amber"] },
  { name: "Serpentine", category: "Serpentine", aliases: ["New Jade"] },
  { name: "Unakite", category: "Unakite", aliases: [] },
  { name: "Axinite", category: "Axinite", aliases: [] },
  { name: "Zoisite", category: "Zoisite", aliases: [] },
  { name: "Orthoclase", category: "Feldspar", aliases: ["Yellow Moonstone"] },
];

export const STONE_TYPES: string[] = [
  ...new Set(GEMSTONES.map((g) => g.name)),
];

export const STONE_FAMILIES: string[] = [
  ...new Set(GEMSTONES.map((g) => g.category)),
].sort();

export const ALIAS_MAP: Record<string, string> = {};
for (const gem of GEMSTONES) {
  for (const alias of gem.aliases) {
    ALIAS_MAP[alias.toLowerCase()] = gem.name;
  }
}

export function resolveGemByQuery(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return STONE_TYPES;
  const results = new Set<string>();
  for (const gem of GEMSTONES) {
    if (gem.name.toLowerCase().includes(q)) {
      results.add(gem.name);
    } else if (gem.category.toLowerCase().includes(q)) {
      results.add(gem.name);
    } else if (gem.aliases.some((a) => a.toLowerCase().includes(q))) {
      results.add(gem.name);
    }
  }
  return [...results];
}

export function getAliasesForName(name: string): string[] {
  return GEMSTONES.find((g) => g.name === name)?.aliases ?? [];
}

export function getCategoryForName(name: string): string {
  return GEMSTONES.find((g) => g.name === name)?.category ?? "Other";
}

export function searchMatchesGem(gem: { stone_type: string }, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (gem.stone_type.toLowerCase().includes(q)) return true;
  const entry = GEMSTONES.find((g) => g.name === gem.stone_type);
  if (!entry) return false;
  if (entry.category.toLowerCase().includes(q)) return true;
  return entry.aliases.some((a) => a.toLowerCase().includes(q));
}
