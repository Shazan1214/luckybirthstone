export type ColorGrade   = "D"|"E"|"F"|"G"|"H"|"I"|"J"|"K"|"L"|"M";
export type ClarityGrade = "IF"|"VVS1"|"VVS2"|"VS1"|"VS2"|"SI1"|"SI2"|"I1"|"I2"|"I3";

export const COLORS:    ColorGrade[]   = ["D","E","F","G","H","I","J","K","L","M"];
export const CLARITIES: ClarityGrade[] = ["IF","VVS1","VVS2","VS1","VS2","SI1","SI2","I1","I2","I3"];

export const RAPAPORT_DISCLAIMER =
  "Rapaport Benchmark Price. Estimated Trade Range represents 60–90% of Rap value.";

// ---------------------------------------------------------------------------
// Static Rapaport price table (USD per carat, Round Brilliant, sample data)
// Structure: bracket key → ColorGrade → ClarityGrade → USD/carat
// ---------------------------------------------------------------------------
type RapRow = Record<ClarityGrade, number>;
type RapColor = Record<ColorGrade, RapRow>;

const TABLE_LT050: RapColor = {
  D: { IF:5200, VVS1:4400, VVS2:3600, VS1:2900, VS2:2400, SI1:1900, SI2:1400, I1:900,  I2:650, I3:450 },
  E: { IF:4400, VVS1:3800, VVS2:3200, VS1:2600, VS2:2200, SI1:1700, SI2:1300, I1:850,  I2:620, I3:430 },
  F: { IF:4000, VVS1:3400, VVS2:2900, VS1:2400, VS2:2000, SI1:1600, SI2:1200, I1:800,  I2:580, I3:400 },
  G: { IF:3400, VVS1:2900, VVS2:2500, VS1:2100, VS2:1800, SI1:1400, SI2:1050, I1:720,  I2:520, I3:360 },
  H: { IF:2900, VVS1:2500, VVS2:2100, VS1:1800, VS2:1500, SI1:1200, SI2:900,  I1:640,  I2:460, I3:320 },
  I: { IF:2400, VVS1:2000, VVS2:1700, VS1:1500, VS2:1300, SI1:1000, SI2:780,  I1:560,  I2:400, I3:280 },
  J: { IF:2000, VVS1:1700, VVS2:1400, VS1:1200, VS2:1000, SI1:800,  SI2:620,  I1:460,  I2:330, I3:230 },
  K: { IF:1700, VVS1:1400, VVS2:1200, VS1:1000, VS2:800,  SI1:650,  SI2:500,  I1:380,  I2:270, I3:190 },
  L: { IF:1400, VVS1:1200, VVS2:1000, VS1:860,  VS2:700,  SI1:550,  SI2:430,  I1:320,  I2:230, I3:160 },
  M: { IF:1200, VVS1:1000, VVS2:860,  VS1:720,  VS2:590,  SI1:460,  SI2:360,  I1:270,  I2:200, I3:140 },
};

const TABLE_050_099: RapColor = {
  D: { IF:8400,  VVS1:6800,  VVS2:5800,  VS1:4800, VS2:4200, SI1:3400, SI2:2600, I1:1800, I2:1200, I3:800 },
  E: { IF:6800,  VVS1:5800,  VVS2:5000,  VS1:4200, VS2:3600, SI1:2900, SI2:2200, I1:1500, I2:1000, I3:680 },
  F: { IF:6000,  VVS1:5200,  VVS2:4600,  VS1:3800, VS2:3200, SI1:2600, SI2:2000, I1:1400, I2:940,  I3:630 },
  G: { IF:5000,  VVS1:4400,  VVS2:3800,  VS1:3200, VS2:2800, SI1:2200, SI2:1700, I1:1200, I2:820,  I3:550 },
  H: { IF:4200,  VVS1:3600,  VVS2:3200,  VS1:2700, VS2:2300, SI1:1800, SI2:1400, I1:1000, I2:700,  I3:470 },
  I: { IF:3400,  VVS1:2900,  VVS2:2600,  VS1:2200, VS2:1900, SI1:1500, SI2:1200, I1:860,  I2:590,  I3:400 },
  J: { IF:2800,  VVS1:2400,  VVS2:2100,  VS1:1800, VS2:1500, SI1:1200, SI2:960,  I1:700,  I2:480,  I3:320 },
  K: { IF:2200,  VVS1:1900,  VVS2:1700,  VS1:1400, VS2:1200, SI1:950,  SI2:760,  I1:560,  I2:390,  I3:260 },
  L: { IF:1900,  VVS1:1600,  VVS2:1400,  VS1:1200, VS2:1000, SI1:800,  SI2:640,  I1:470,  I2:330,  I3:220 },
  M: { IF:1600,  VVS1:1350,  VVS2:1150,  VS1:960,  VS2:800,  SI1:640,  SI2:510,  I1:380,  I2:270,  I3:180 },
};

const TABLE_100_149: RapColor = {
  D: { IF:12800, VVS1:10400, VVS2:8800, VS1:7200, VS2:6400, SI1:5200, SI2:4000, I1:2800, I2:1900, I3:1200 },
  E: { IF:10000, VVS1:8800,  VVS2:7600, VS1:6400, VS2:5600, SI1:4400, SI2:3400, I1:2400, I2:1600, I3:1000 },
  F: { IF:8800,  VVS1:7600,  VVS2:6800, VS1:5600, VS2:4800, SI1:3800, SI2:3000, I1:2100, I2:1400, I3:900  },
  G: { IF:7200,  VVS1:6400,  VVS2:5600, VS1:4800, VS2:4200, SI1:3400, SI2:2600, I1:1800, I2:1200, I3:780  },
  H: { IF:6000,  VVS1:5200,  VVS2:4600, VS1:4000, VS2:3400, SI1:2800, SI2:2200, I1:1500, I2:1000, I3:660  },
  I: { IF:4800,  VVS1:4200,  VVS2:3800, VS1:3200, VS2:2800, SI1:2200, SI2:1800, I1:1300, I2:880,  I3:580  },
  J: { IF:3800,  VVS1:3400,  VVS2:3000, VS1:2600, VS2:2200, SI1:1800, SI2:1500, I1:1050, I2:710,  I3:470  },
  K: { IF:3000,  VVS1:2600,  VVS2:2200, VS1:1900, VS2:1600, SI1:1350, SI2:1100, I1:800,  I2:540,  I3:360  },
  L: { IF:2500,  VVS1:2100,  VVS2:1800, VS1:1600, VS2:1350, SI1:1100, SI2:900,  I1:660,  I2:450,  I3:300  },
  M: { IF:2100,  VVS1:1800,  VVS2:1550, VS1:1350, VS2:1150, SI1:900,  SI2:720,  I1:540,  I2:370,  I3:250  },
};

const TABLE_150_199: RapColor = {
  D: { IF:16800, VVS1:13500, VVS2:11400, VS1:9400,  VS2:8200, SI1:6700, SI2:5200, I1:3600, I2:2400, I3:1560 },
  E: { IF:13000, VVS1:11500, VVS2:10000, VS1:8400,  VS2:7200, SI1:5800, SI2:4400, I1:3100, I2:2100, I3:1350 },
  F: { IF:11400, VVS1:10000, VVS2:9000,  VS1:7400,  VS2:6200, SI1:5000, SI2:3900, I1:2700, I2:1800, I3:1170 },
  G: { IF:9400,  VVS1:8400,  VVS2:7400,  VS1:6200,  VS2:5400, SI1:4400, SI2:3400, I1:2300, I2:1560, I3:1020 },
  H: { IF:7800,  VVS1:6800,  VVS2:6000,  VS1:5200,  VS2:4400, SI1:3600, SI2:2900, I1:1960, I2:1320, I3:860  },
  I: { IF:6200,  VVS1:5400,  VVS2:5000,  VS1:4200,  VS2:3600, SI1:2900, SI2:2300, I1:1680, I2:1130, I3:740  },
  J: { IF:5000,  VVS1:4400,  VVS2:3900,  VS1:3400,  VS2:2900, SI1:2300, SI2:1960, I1:1360, I2:920,  I3:600  },
  K: { IF:3900,  VVS1:3400,  VVS2:2900,  VS1:2500,  VS2:2100, SI1:1760, SI2:1440, I1:1040, I2:700,  I3:460  },
  L: { IF:3250,  VVS1:2750,  VVS2:2350,  VS1:2100,  VS2:1760, SI1:1440, SI2:1170, I1:860,  I2:580,  I3:390  },
  M: { IF:2750,  VVS1:2350,  VVS2:2000,  VS1:1760,  VS2:1500, SI1:1170, SI2:940,  I1:700,  I2:480,  I3:320  },
};

const TABLE_200_299: RapColor = {
  D: { IF:22000, VVS1:17600, VVS2:15000, VS1:12200, VS2:10700, SI1:8700, SI2:6700, I1:4700, I2:3100, I3:2000 },
  E: { IF:17000, VVS1:15000, VVS2:13000, VS1:11000, VS2:9400,  SI1:7500, SI2:5800, I1:4000, I2:2700, I3:1740 },
  F: { IF:15000, VVS1:13000, VVS2:11700, VS1:9700,  VS2:8100,  SI1:6500, SI2:5000, I1:3500, I2:2400, I3:1530 },
  G: { IF:12200, VVS1:11000, VVS2:9700,  VS1:8100,  VS2:7100,  SI1:5800, SI2:4400, I1:3000, I2:2000, I3:1300 },
  H: { IF:10200, VVS1:8900,  VVS2:7800,  VS1:6800,  VS2:5800,  SI1:4700, SI2:3700, I1:2500, I2:1700, I3:1100 },
  I: { IF:8100,  VVS1:7100,  VVS2:6400,  VS1:5500,  VS2:4700,  SI1:3700, SI2:3000, I1:2100, I2:1430, I3:930  },
  J: { IF:6500,  VVS1:5800,  VVS2:5100,  VS1:4400,  VS2:3700,  SI1:3000, SI2:2500, I1:1770, I2:1200, I3:780  },
  K: { IF:5100,  VVS1:4400,  VVS2:3800,  VS1:3200,  VS2:2700,  SI1:2300, SI2:1870, I1:1350, I2:920,  I3:600  },
  L: { IF:4200,  VVS1:3600,  VVS2:3100,  VS1:2700,  VS2:2300,  SI1:1870, SI2:1520, I1:1120, I2:760,  I3:500  },
  M: { IF:3600,  VVS1:3100,  VVS2:2700,  VS1:2300,  VS2:1940,  SI1:1520, SI2:1230, I1:920,  I2:620,  I3:410  },
};

const TABLE_300_399: RapColor = {
  D: { IF:29000, VVS1:23000, VVS2:19600, VS1:16000, VS2:14000, SI1:11400, SI2:8700, I1:6100, I2:4100, I3:2600 },
  E: { IF:22400, VVS1:19600, VVS2:17100, VS1:14400, VS2:12300, SI1:9800,  SI2:7500, I1:5300, I2:3500, I3:2300 },
  F: { IF:19600, VVS1:17100, VVS2:15300, VS1:12700, VS2:10600, SI1:8500,  SI2:6600, I1:4600, I2:3100, I3:2000 },
  G: { IF:16000, VVS1:14400, VVS2:12700, VS1:10600, VS2:9300,  SI1:7500,  SI2:5800, I1:4000, I2:2700, I3:1740 },
  H: { IF:13300, VVS1:11700, VVS2:10200, VS1:8900,  VS2:7500,  SI1:6100,  SI2:4800, I1:3300, I2:2200, I3:1440 },
  I: { IF:10600, VVS1:9300,  VVS2:8400,  VS1:7200,  VS2:6100,  SI1:4900,  SI2:3900, I1:2800, I2:1870, I3:1220 },
  J: { IF:8500,  VVS1:7600,  VVS2:6700,  VS1:5700,  VS2:4900,  SI1:3900,  SI2:3200, I1:2300, I2:1540, I3:1000 },
  K: { IF:6700,  VVS1:5800,  VVS2:4900,  VS1:4200,  VS2:3600,  SI1:2990,  SI2:2440, I1:1760, I2:1180, I3:770  },
  L: { IF:5500,  VVS1:4700,  VVS2:4000,  VS1:3500,  VS2:3000,  SI1:2440,  SI2:1980, I1:1460, I2:980,  I3:640  },
  M: { IF:4700,  VVS1:4000,  VVS2:3500,  VS1:3000,  VS2:2540,  SI1:1980,  SI2:1600, I1:1200, I2:800,  I3:530  },
};

const TABLE_400_PLUS: RapColor = {
  D: { IF:38000, VVS1:30000, VVS2:25600, VS1:21000, VS2:18300, SI1:14900, SI2:11400, I1:8000, I2:5300, I3:3400 },
  E: { IF:29300, VVS1:25600, VVS2:22400, VS1:18800, VS2:16100, SI1:12800, SI2:9800,  I1:6900, I2:4600, I3:3000 },
  F: { IF:25600, VVS1:22400, VVS2:20000, VS1:16600, VS2:13900, SI1:11100, SI2:8600,  I1:6100, I2:4100, I3:2600 },
  G: { IF:21000, VVS1:18800, VVS2:16600, VS1:13900, VS2:12100, SI1:9800,  SI2:7500,  I1:5200, I2:3500, I3:2270 },
  H: { IF:17400, VVS1:15300, VVS2:13300, VS1:11600, VS2:9800,  SI1:8000,  SI2:6300,  I1:4400, I2:2950, I3:1880 },
  I: { IF:13900, VVS1:12100, VVS2:11000, VS1:9400,  VS2:8000,  SI1:6400,  SI2:5100,  I1:3600, I2:2440, I3:1590 },
  J: { IF:11100, VVS1:9900,  VVS2:8700,  VS1:7500,  VS2:6400,  SI1:5100,  SI2:4200,  I1:3000, I2:2010, I3:1310 },
  K: { IF:8700,  VVS1:7500,  VVS2:6400,  VS1:5500,  VS2:4700,  SI1:3910,  SI2:3190,  I1:2300, I2:1550, I3:1010 },
  L: { IF:7200,  VVS1:6100,  VVS2:5300,  VS1:4600,  VS2:3900,  SI1:3190,  SI2:2590,  I1:1910, I2:1280, I3:840  },
  M: { IF:6100,  VVS1:5300,  VVS2:4600,  VS1:3900,  VS2:3310,  SI1:2590,  SI2:2100,  I1:1560, I2:1050, I3:690  },
};

// ---------------------------------------------------------------------------
// Bracket selector
// ---------------------------------------------------------------------------
function selectTable(carat: number): RapColor {
  if (carat < 0.50) return TABLE_LT050;
  if (carat < 1.00) return TABLE_050_099;
  if (carat < 1.50) return TABLE_100_149;
  if (carat < 2.00) return TABLE_150_199;
  if (carat < 3.00) return TABLE_200_299;
  if (carat < 4.00) return TABLE_300_399;
  return TABLE_400_PLUS;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface RapaportResult {
  rap_price_per_carat:  number;
  total_rap_value:      number;
  estimated_price_min:  number;
  estimated_price_max:  number;
  pricing_confidence:   "low" | "medium" | "high";
  pricing_disclaimer:   string;
  /** normalised grade actually used for the lookup */
  color_used:    ColorGrade;
  clarity_used:  ClarityGrade;
}

export function lookupRapaport(
  carat: number,
  color: string,
  clarity: string,
): RapaportResult | null {
  const colorUp   = color.trim().toUpperCase()   as ColorGrade;
  const clarityUp = clarity.trim().toUpperCase() as ClarityGrade;

  const knownColor   = COLORS.includes(colorUp);
  const knownClarity = CLARITIES.includes(clarityUp);

  if (!knownColor || !knownClarity) return null;

  const table = selectTable(carat);
  const rapPerCarat = table[colorUp][clarityUp];
  const totalRap    = Math.round(rapPerCarat * carat * 100) / 100;

  // Trade range: 60 % – 90 % of Rap
  const min = Math.round(totalRap * 0.60 * 100) / 100;
  const max = Math.round(totalRap * 0.90 * 100) / 100;

  return {
    rap_price_per_carat: rapPerCarat,
    total_rap_value:     totalRap,
    estimated_price_min: min,
    estimated_price_max: max,
    pricing_confidence:  "high",
    pricing_disclaimer:  RAPAPORT_DISCLAIMER,
    color_used:          colorUp,
    clarity_used:        clarityUp,
  };
}
