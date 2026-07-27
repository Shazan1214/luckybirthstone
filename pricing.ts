export type PricingConfidence = "low" | "medium" | "high";

export const PRICING_DISCLAIMER =
  "Indicative price only. Actual value may vary.";

// ---------------------------------------------------------------------------
// Base price per carat (USD) by stone type — case-insensitive lookup
// ---------------------------------------------------------------------------
const STONE_BASE_PRICES: Record<string, number> = {
  "paraiba tourmaline": 5000,
  alexandrite:          3500,
  diamond:              3000,
  ruby:                 2000,
  emerald:              1500,
  sapphire:             1200,
  jadeite:              1000,
  jade:                  900,
  spinel:                500,
  tanzanite:             800,
  tourmaline:            600,
  aquamarine:            300,
  opal:                  400,
  garnet:                200,
  topaz:                 100,
  peridot:                80,
  pearl:                 150,
  amethyst:               50,
  citrine:                40,
  zircon:                120,
  moonstone:             150,
  chrysoberyl:           400,
};

// ---------------------------------------------------------------------------
// Origin multipliers — case-insensitive substring match, first match wins
// ---------------------------------------------------------------------------
const ORIGIN_MULTIPLIERS: [string, number][] = [
  ["kashmir",       2.0],
  ["burma",         1.5],
  ["myanmar",       1.5],
  ["colombia",      1.4],
  ["ceylon",        1.25],
  ["sri lanka",     1.25],
  ["brazil",        0.9],
  ["mozambique",    0.85],
  ["madagascar",    0.85],
  ["africa",        0.85],
  ["zambia",        0.88],
  ["tanzania",      0.88],
  ["afghanistan",   1.1],
  ["russia",        1.1],
];

// ---------------------------------------------------------------------------
// Treatment multipliers — case-insensitive substring match, first match wins
// ---------------------------------------------------------------------------
const TREATMENT_MULTIPLIERS: [string, number][] = [
  ["no treatment",      1.3],
  ["unheated",          1.3],
  ["untreated",         1.3],
  ["none",              1.3],
  ["minor heat",        1.1],
  ["minor",             1.05],
  ["beryllium",         0.7],
  ["irradiated",        0.65],
  ["fracture fill",     0.6],
  ["fracture filled",   0.6],
  ["oiling",            0.75],
  ["oiled",             0.75],
  ["oil",               0.75],
  ["clarity enhanced",  0.7],
  ["heat",              0.85],
  ["heated",            0.85],
];

// ---------------------------------------------------------------------------
// Carat weight multiplier — larger stones command a per-carat premium
// ---------------------------------------------------------------------------
function caratMultiplier(carat: number): number {
  if (carat < 0.5)  return 0.8;
  if (carat < 1.0)  return 1.0;
  if (carat < 2.0)  return 1.2;
  if (carat < 5.0)  return 1.5;
  if (carat < 10.0) return 2.0;
  return 3.0;
}

// ---------------------------------------------------------------------------
// Confidence spreads around the estimated midpoint
// ---------------------------------------------------------------------------
const SPREAD: Record<PricingConfidence, { lo: number; hi: number }> = {
  high:   { lo: 0.85, hi: 1.15 },
  medium: { lo: 0.75, hi: 1.30 },
  low:    { lo: 0.60, hi: 1.60 },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface PricingResult {
  estimated_price_min: number;
  estimated_price_max: number;
  pricing_confidence: PricingConfidence;
  pricing_disclaimer: string;
}

export function estimatePrice(
  stone_type: string,
  carat: number,
  origin: string,
  treatment: string
): PricingResult {
  const stoneKey = stone_type.toLowerCase().trim();
  const originKey = origin.toLowerCase().trim();
  const treatmentKey = treatment.toLowerCase().trim();

  // Resolve base price
  const basePricePerCarat = STONE_BASE_PRICES[stoneKey] ?? null;
  const knownStone = basePricePerCarat !== null;
  const effectiveBase = basePricePerCarat ?? 200; // default for unknown stones

  // Resolve origin multiplier
  let originMult = 1.0;
  let knownOrigin = false;
  for (const [keyword, mult] of ORIGIN_MULTIPLIERS) {
    if (originKey.includes(keyword)) {
      originMult = mult;
      knownOrigin = true;
      break;
    }
  }

  // Resolve treatment multiplier
  let treatmentMult = 1.0;
  let knownTreatment = false;
  for (const [keyword, mult] of TREATMENT_MULTIPLIERS) {
    if (treatmentKey.includes(keyword)) {
      treatmentMult = mult;
      knownTreatment = true;
      break;
    }
  }

  // Carat size premium
  const caratMult = caratMultiplier(carat);

  // Midpoint estimate
  const midpoint = effectiveBase * caratMult * originMult * treatmentMult * carat;

  // Determine confidence
  const knownCount = (knownStone ? 1 : 0) + (knownOrigin ? 1 : 0) + (knownTreatment ? 1 : 0);
  let confidence: PricingConfidence;
  if (knownStone && knownOrigin && knownTreatment) {
    confidence = "high";
  } else if (knownCount >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  const spread = SPREAD[confidence];

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    estimated_price_min:  round(midpoint * spread.lo),
    estimated_price_max:  round(midpoint * spread.hi),
    pricing_confidence:   confidence,
    pricing_disclaimer:   PRICING_DISCLAIMER,
  };
}
