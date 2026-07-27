import { Router } from "express";

const router = Router();

export interface GemTerm {
  id: string;
  term: string;
  slug: string;
  category: "gemstone" | "quality" | "treatment" | "trade" | "grading" | "cut" | "origin";
  definition: string;
  properties?: string;
  related_terms?: string[];
  example?: string;
}

export const GEM_KNOWLEDGE: GemTerm[] = [
  // Gemstones
  { id: "ruby", term: "Ruby", slug: "ruby", category: "gemstone", definition: "A precious gemstone variety of corundum (Al₂O₃) coloured red by chromium. The most valuable rubies come from Myanmar (Pigeon's Blood), Mozambique, and Thailand.", properties: "Hardness: 9 Mohs | Specific gravity: 3.97–4.05 | Refractive index: 1.762–1.770", related_terms: ["sapphire", "corundum", "pigeons-blood"], example: "A fine unheated Burmese ruby can command over $100,000 per carat." },
  { id: "sapphire", term: "Sapphire", slug: "sapphire", category: "gemstone", definition: "A precious gemstone variety of corundum. Blue sapphires get their colour from titanium and iron. Also occurs in yellow, pink, orange, and other colours (fancy sapphires).", properties: "Hardness: 9 Mohs | Specific gravity: 3.95–4.03 | Refractive index: 1.762–1.770", related_terms: ["ruby", "corundum", "padparadscha"], example: "Kashmir sapphires are considered the finest, known for their velvety cornflower blue." },
  { id: "emerald", term: "Emerald", slug: "emerald", category: "gemstone", definition: "A precious green variety of beryl coloured by chromium and/or vanadium. Colombia, Zambia, and Brazil are major sources. Internal characteristics are called a 'jardin'.", properties: "Hardness: 7.5–8 Mohs | Specific gravity: 2.67–2.78 | Refractive index: 1.565–1.602", related_terms: ["beryl", "jardin", "oiling"], example: "Colombian emeralds with strong green saturation and minimal inclusions are the most prized." },
  { id: "diamond", term: "Diamond", slug: "diamond", category: "gemstone", definition: "The hardest natural material, made of pure carbon in a cubic crystal structure. Evaluated using the 4Cs: Cut, Colour, Clarity, and Carat.", properties: "Hardness: 10 Mohs | Specific gravity: 3.51–3.53 | Refractive index: 2.417", related_terms: ["four-cs", "fluorescence", "brilliance"], example: "A D-Flawless round brilliant diamond is the rarest and most valuable grade combination." },
  { id: "alexandrite", term: "Alexandrite", slug: "alexandrite", category: "gemstone", definition: "A rare colour-change variety of chrysoberyl that appears green in daylight and red under incandescent light. Named after Tsar Alexander II of Russia.", properties: "Hardness: 8.5 Mohs | Specific gravity: 3.70–3.78", related_terms: ["chrysoberyl", "colour-change"], example: "Fine alexandrite with a dramatic green-to-red shift from the Ural Mountains of Russia is extremely rare." },
  { id: "tanzanite", term: "Tanzanite", slug: "tanzanite", category: "gemstone", definition: "A blue-violet variety of zoisite found only near Mount Kilimanjaro in Tanzania. Trichroic — shows blue, violet, and burgundy when viewed from different angles.", properties: "Hardness: 6.5–7 Mohs | Specific gravity: 3.35", related_terms: ["zoisite", "trichroism"], example: "Tanzanite with deep violetish-blue colour rivaling fine sapphire is classified as AAA grade." },
  { id: "spinel", term: "Spinel", slug: "spinel", category: "gemstone", definition: "A magnesium aluminium oxide gemstone found in many colours. Historically confused with ruby and sapphire. The Black Prince's Ruby in the British Crown Jewels is actually spinel.", properties: "Hardness: 8 Mohs | Specific gravity: 3.54–3.63 | Refractive index: 1.712–1.762", related_terms: ["ruby", "corundum", "flame-spinel"], example: "Hot pink and red spinels from Myanmar's Mogok Valley are the most desirable." },
  { id: "tourmaline", term: "Tourmaline", slug: "tourmaline", category: "gemstone", definition: "A complex boron silicate mineral group occurring in the widest colour range of any gemstone. Paraíba tourmaline with neon blue/green colour from copper is especially valuable.", properties: "Hardness: 7–7.5 Mohs | Specific gravity: 3.06", related_terms: ["paraiba", "rubellite", "indicolite"], example: "Paraíba tourmalines from Brazil can exceed $50,000 per carat for fine quality." },
  { id: "aquamarine", term: "Aquamarine", slug: "aquamarine", category: "gemstone", definition: "A blue variety of beryl coloured by iron. The finest comes from Brazil. Heating can improve colour by removing greenish tones.", properties: "Hardness: 7.5–8 Mohs | Specific gravity: 2.68–2.74", related_terms: ["beryl", "morganite", "emerald"], example: "Santa Maria aquamarines from Brazil are prized for their intense blue colour." },
  { id: "opal", term: "Opal", slug: "opal", category: "gemstone", definition: "A hydrated amorphous form of silica showing iridescent colour play called 'play-of-colour'. Black opals from Lightning Ridge, Australia are most valuable.", properties: "Hardness: 5.5–6.5 Mohs | Specific gravity: 1.98–2.20", related_terms: ["play-of-colour", "fire-opal", "doublet"], example: "A black opal with broad, vivid red play-of-colour is the rarest and most prized variety." },
  { id: "peridot", term: "Peridot", slug: "peridot", category: "gemstone", definition: "A gem-quality variety of olivine with a distinctive lime-green to yellowish-green colour from iron. Found in Myanmar, Pakistan, and Arizona.", properties: "Hardness: 6.5–7 Mohs | Specific gravity: 3.27–3.37", related_terms: ["olivine", "chrysolite"], example: "Large peridots from the Sapat Gali mines of Pakistan show exceptional clarity and rich colour." },
  { id: "tsavorite", term: "Tsavorite", slug: "tsavorite", category: "gemstone", definition: "A rare green variety of grossular garnet coloured by vanadium and chromium. Found in the Tsavo region of Kenya and Tanzania. Can rival fine emeralds in colour.", properties: "Hardness: 6.5–7.5 Mohs | Specific gravity: 3.57–3.73", related_terms: ["garnet", "grossular", "demantoid"], example: "Fine tsavorite over 3 carats is rare and commands premium prices in the international market." },
  { id: "zircon", term: "Zircon", slug: "zircon", category: "gemstone", definition: "One of the oldest minerals on Earth. Blue zircon (heat-treated) is popular, and colourless zircon has fire exceeding diamond. Not to be confused with cubic zirconia.", properties: "Hardness: 7.5 Mohs | Specific gravity: 3.93–4.73 | Refractive index: 1.925–1.984", related_terms: ["cubic-zirconia", "cambodia-blue"], example: "Fine blue zircons from Cambodia and Myanmar show exceptional brilliance and dispersion." },

  // Quality Terms
  { id: "pigeons-blood", term: "Pigeon's Blood", slug: "pigeons-blood", category: "quality", definition: "The finest quality descriptor for ruby, referring to a pure red colour with a slight blue undertone, named for its resemblance to a pigeon's blood drop. Defined by SSEF and GRS laboratories.", related_terms: ["ruby", "colour-saturation"], example: "Only a small percentage of rubies qualify as 'Pigeon's Blood' by major gemological labs." },
  { id: "cornflower-blue", term: "Cornflower Blue", slug: "cornflower-blue", category: "quality", definition: "A medium-blue hue descriptor for sapphire, associated with fine Kashmir sapphires. Characterized by a velvety, slightly violet-blue tone.", related_terms: ["sapphire", "kashmir", "royal-blue"] },
  { id: "royal-blue", term: "Royal Blue", slug: "royal-blue", category: "quality", definition: "A highly saturated, deep blue colour grade for sapphire, typically from Sri Lanka, Madagascar, or Thailand. Darker than cornflower blue.", related_terms: ["sapphire", "cornflower-blue"] },
  { id: "jardin", term: "Jardin", slug: "jardin", category: "quality", definition: "French for 'garden', referring to the characteristic internal inclusions in emeralds — needle-like crystals, fingerprints, and fractures. A jardin is expected and acceptable in fine emeralds.", related_terms: ["emerald", "inclusions", "clarity"] },

  // Treatments
  { id: "heat-treatment", term: "Heat Treatment", slug: "heat-treatment", category: "treatment", definition: "The most common gem treatment — applying high temperatures to improve colour and/or clarity. Standard for sapphire and ruby. Unheated stones command a premium.", related_terms: ["unheated", "beryllium-diffusion", "ruby", "sapphire"] },
  { id: "unheated", term: "Unheated", slug: "unheated", category: "treatment", definition: "A gemstone that has not been subjected to heat treatment. Unheated rubies and sapphires of fine quality command a significant premium — often 3–5x the price of heated equivalents.", related_terms: ["heat-treatment", "no-heat-certificate"] },
  { id: "oiling", term: "Oiling / Resin Filling", slug: "oiling", category: "treatment", definition: "Filling surface-reaching fractures in emeralds with cedar oil, synthetic resin (e.g. Opticon), or similar substances to improve clarity. Graded as None, Minor, Moderate, or Significant.", related_terms: ["emerald", "jardin", "clarity-enhancement"] },
  { id: "beryllium-diffusion", term: "Beryllium Diffusion", slug: "beryllium-diffusion", category: "treatment", definition: "A treatment where beryllium atoms are diffused into corundum at extreme heat, fundamentally altering the gemstone's colour at a deeper level than surface diffusion. Controversial and must be disclosed.", related_terms: ["heat-treatment", "sapphire", "ruby"] },
  { id: "fracture-filling", term: "Fracture Filling", slug: "fracture-filling", category: "treatment", definition: "Filling cracks in diamonds or coloured stones with glass, resin, or other substances to improve apparent clarity. Glass-filled rubies are significantly less valuable.", related_terms: ["ruby", "diamond", "clarity-enhancement"] },

  // Trade Terms
  { id: "memo", term: "Memo / Consignment", slug: "memo", category: "trade", definition: "An industry practice where a dealer sends gemstones to a potential buyer on trust for a set period. The goods are not sold; they are 'on memo'. Payment is made only upon sale.", example: "Keeping $50,000 in goods on memo is common between trusted partners in the trade." },
  { id: "calibrated", term: "Calibrated", slug: "calibrated", category: "trade", definition: "Gemstones cut to standard millimetre sizes for use in pre-made jewellery settings. Calibrated goods trade at lower per-carat prices than unique large stones.", related_terms: ["parcels", "melee"] },
  { id: "melee", term: "Melee", slug: "melee", category: "trade", definition: "Small diamonds or gemstones, typically under 0.20 carats, sold in parcels for use as accent stones in jewellery. Priced per carat in bulk.", related_terms: ["calibrated", "parcels"] },
  { id: "parcels", term: "Parcels", slug: "parcels", category: "trade", definition: "A lot of multiple gemstones sold together, typically sorted by type, colour, and size. Used for melee, calibrated goods, and rough material.", related_terms: ["melee", "calibrated", "rough"] },
  { id: "rough", term: "Rough", slug: "rough", category: "trade", definition: "Uncut, unpolished gemstone material as it comes from the mine. Rough is bought by cutters who estimate yield and cut quality before purchase.", related_terms: ["parcels", "yield"] },
  { id: "per-carat", term: "Per Carat Price", slug: "per-carat", category: "trade", definition: "The standard pricing unit for gemstones. A 2-carat stone at $500/ct costs $1,000. Note: prices scale non-linearly — a 4-carat stone of equal quality will be more than 2x the cost of a 2-carat.", related_terms: ["carat", "price-jump"] },

  // Grading
  { id: "four-cs", term: "Four Cs", slug: "four-cs", category: "grading", definition: "The universal diamond grading system: Cut, Colour, Clarity, and Carat. Developed by GIA (Gemological Institute of America).", related_terms: ["cut", "colour", "clarity", "carat"] },
  { id: "carat", term: "Carat", slug: "carat", category: "grading", definition: "The unit of weight for gemstones. 1 carat = 0.2 grams = 200 milligrams. One carat is divided into 100 points (50 points = 0.50 ct).", related_terms: ["four-cs", "weight"] },
  { id: "clarity", term: "Clarity", slug: "clarity", category: "grading", definition: "The assessment of a gemstone's internal and external characteristics (inclusions and blemishes). GIA grades diamonds FL, IF, VVS1, VVS2, VS1, VS2, SI1, SI2, I1, I2, I3.", related_terms: ["inclusions", "four-cs", "loupe-clean"] },
  { id: "loupe-clean", term: "Loupe Clean", slug: "loupe-clean", category: "grading", definition: "A gemstone free of inclusions visible under 10× magnification. Equivalent to SI1 or better in diamonds. Common in sapphires, spinels, and tanzanite trade descriptions.", related_terms: ["clarity", "eye-clean"] },
  { id: "eye-clean", term: "Eye Clean", slug: "eye-clean", category: "grading", definition: "A gemstone with no inclusions visible to the naked eye at arm's length. The minimum standard for quality commercial gemstones.", related_terms: ["clarity", "loupe-clean"] },

  // Cut
  { id: "brilliant-cut", term: "Brilliant Cut", slug: "brilliant-cut", category: "cut", definition: "A cutting style with triangular and kite-shaped facets radiating from the centre, maximizing light return and brilliance. The standard round brilliant has 57 or 58 facets.", related_terms: ["cut", "facets", "crown"] },
  { id: "step-cut", term: "Step Cut", slug: "step-cut", category: "cut", definition: "A cutting style with rectangular parallel facets, creating a 'hall of mirrors' effect. Common in emeralds (emerald cut), baguettes, and asscher cuts.", related_terms: ["emerald-cut", "brilliant-cut"] },
  { id: "cabochon", term: "Cabochon", slug: "cabochon", category: "cut", definition: "A gem with a smooth, domed top and flat bottom, without facets. Required for star stones, cat's eye stones, and preferred for opals. Abbreviated 'cab'.", related_terms: ["asterism", "cats-eye", "opal"] },
  { id: "mixed-cut", term: "Mixed Cut", slug: "mixed-cut", category: "cut", definition: "A combination of brilliant-cut crown and step-cut pavilion (or vice versa), commonly used in coloured stones to maximize colour and weight retention.", related_terms: ["brilliant-cut", "step-cut"] },

  // Origin
  { id: "kashmir", term: "Kashmir", slug: "kashmir", category: "origin", definition: "A region in the northern Indian subcontinent producing the world's most legendary sapphires — known for their velvety cornflower blue and exceptional colour saturation. No significant mining since 1887.", related_terms: ["sapphire", "cornflower-blue"], example: "A Kashmir sapphire certification from major labs adds substantial value — sometimes 30–50% premium." },
  { id: "mogok", term: "Mogok", slug: "mogok", category: "origin", definition: "A region in Myanmar (formerly Burma) renowned for producing the finest rubies and spinels in the world. Mogok Valley of Gems has been mined for over 500 years.", related_terms: ["ruby", "spinel", "pigeons-blood"] },
  { id: "paraiba", term: "Paraíba", slug: "paraiba", category: "origin", definition: "A state in northeastern Brazil where neon-blue/green copper-bearing tourmalines were discovered in 1987. The term is also used for similar tourmalines from Mozambique and Nigeria (Para-type).", related_terms: ["tourmaline"], example: "Brazilian Paraíba tourmaline is up to 10x more expensive than material from Africa due to origin premium." },
  { id: "no-heat-certificate", term: "No-Heat Certificate", slug: "no-heat-certificate", category: "grading", definition: "A laboratory report from GIA, GRS, Gübelin, or SSEF confirming a ruby or sapphire shows no evidence of heat treatment. Commands a significant price premium.", related_terms: ["unheated", "heat-treatment"] },
  { id: "color-saturation", term: "Colour Saturation", slug: "color-saturation", category: "grading", definition: "The intensity or vividness of a gemstone's hue. GIA grades saturation from Grayish/Brownish (1) to Vivid (6). Vivid saturation commands the highest premiums in ruby, sapphire, and emerald.", related_terms: ["hue", "tone", "clarity"] },
  { id: "fluorescence", term: "Fluorescence", slug: "fluorescence", category: "grading", definition: "The visible light emitted by a gemstone when exposed to UV radiation. In diamonds, strong blue fluorescence can make the stone appear hazy in daylight (overblue). In rubies, red fluorescence enhances colour.", related_terms: ["ruby", "diamond", "uv"] },
  { id: "pleochroism", term: "Pleochroism", slug: "pleochroism", category: "grading", definition: "The property of showing different colours when viewed from different crystallographic directions. Strongly pleochroic stones include ruby, sapphire, tanzanite, and alexandrite. Cutters must orient the stone for best colour.", related_terms: ["tanzanite", "ruby", "alexandrite"] },
  { id: "specific-gravity", term: "Specific Gravity", slug: "specific-gravity", category: "grading", definition: "The ratio of a gemstone's weight to the weight of an equal volume of water. A key identification tool. Quartz has SG of 2.65; diamond is 3.52; sapphire is ~4.00.", related_terms: ["refractive-index", "hardness"] },
  { id: "refractive-index", term: "Refractive Index (RI)", slug: "refractive-index", category: "grading", definition: "A measure of how much light bends when entering a gemstone. Used for identification. Measured with a refractometer. High RI = more sparkle and brilliance.", related_terms: ["specific-gravity", "dispersion"] },
  { id: "dispersion", term: "Dispersion (Fire)", slug: "dispersion", category: "grading", definition: "The splitting of white light into spectral colours ('fire'). Diamond has high dispersion (0.044), giving it rainbow sparkle. Zircon and demantoid garnet also show strong fire.", related_terms: ["brilliance", "refractive-index", "zircon"] },
];

// GET /gem-knowledge/terms — all terms
router.get("/gem-knowledge/terms", (req, res) => {
  const { category } = req.query as { category?: string };
  let results = GEM_KNOWLEDGE;
  if (category) results = results.filter((t) => t.category === category);
  return res.json(results);
});

// GET /gem-knowledge/search?q=... — search
router.get("/gem-knowledge/search", (req, res) => {
  const { q = "" } = req.query as { q?: string };
  const query = q.toLowerCase().trim();
  if (!query) return res.json(GEM_KNOWLEDGE);
  const results = GEM_KNOWLEDGE.filter(
    (t) =>
      t.term.toLowerCase().includes(query) ||
      t.definition.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query) ||
      t.related_terms?.some((r) => r.includes(query))
  );
  return res.json(results);
});

// GET /gem-knowledge/terms/:slug — single term
router.get("/gem-knowledge/terms/:slug", (req, res) => {
  const term = GEM_KNOWLEDGE.find((t) => t.slug === req.params.slug);
  if (!term) return res.status(404).json({ error: "Term not found" });
  return res.json(term);
});

export default router;
