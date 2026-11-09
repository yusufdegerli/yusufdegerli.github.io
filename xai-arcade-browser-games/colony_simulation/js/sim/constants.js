/** @file Core simulation constants, material tables, and building catalog. */

export const TILE = 32;
export const WORLD_W = 96;
export const WORLD_H = 64;
export const CHUNK = 16;
export const TICK_DT = 0.1;
export const CYCLE_TICKS = 600;

export const MAT = {
  VACUUM: 0,
  ROCK: 1,
  HARDROCK: 2,
  DIRT: 3,
  ORE: 4,
  ICE: 5,
  COAL: 6,
  ORGANIC: 7,
  SAND: 8,
  METAL: 9,
  FLOOR: 10,
  WALL: 11,
  INSULATION: 12,
  LADDER: 13,
  MESH: 14,
};

export const MAT_COUNT = 15;

export const GAS = { O2: 0, CO2: 1, H2: 2, STEAM: 3 };
export const GAS_COUNT = 4;

export const LIQ = { WATER: 0, POLLUTED: 1, MAGMA: 2 };
export const LIQ_COUNT = 3;

export const DES = { NONE: 0, DIG: 1, BUILD: 2, DECON: 3 };

export const MAX_LIQ = 1000;
export const MAX_GAS = 1800;
export const ROOM_TEMP = 295;
export const SPACE_TEMP = 40;
export const CORE_TEMP = 520;

export const MATERIALS = [
  { id: 0, name: "Vacuum", solid: false, permeable: true, diggable: false, hardness: 0, mass: 0, heatCap: 0, cond: 0, color: [8, 10, 16], resource: null },
  { id: 1, name: "Asteroid Rock", solid: true, permeable: false, diggable: true, hardness: 1.0, mass: 1840, heatCap: 0.84, cond: 2.0, color: [176, 102, 78], resource: null, melt: 1680, meltTo: "magma" },
  { id: 2, name: "Igneous Bedrock", solid: true, permeable: false, diggable: true, hardness: 2.4, mass: 2000, heatCap: 0.8, cond: 2.4, color: [72, 68, 88], resource: null },
  { id: 3, name: "Regolith", solid: true, permeable: false, diggable: true, hardness: 0.55, mass: 1400, heatCap: 0.9, cond: 1.4, color: [148, 98, 64], resource: "dirt", yield: 80 },
  { id: 4, name: "Copper Ore", solid: true, permeable: false, diggable: true, hardness: 1.35, mass: 1840, heatCap: 0.39, cond: 4.5, color: [184, 92, 48], resource: "metal", yield: 50 },
  { id: 5, name: "Ice", solid: true, permeable: false, diggable: true, hardness: 0.7, mass: 920, heatCap: 2.05, cond: 2.18, color: [130, 210, 220], resource: "ice", yield: 100, melt: 273.15, meltTo: "water" },
  { id: 6, name: "Coal", solid: true, permeable: false, diggable: true, hardness: 0.85, mass: 1100, heatCap: 0.71, cond: 1.0, color: [42, 36, 34], resource: "coal", yield: 80 },
  { id: 7, name: "Biolume Slime", solid: true, permeable: false, diggable: true, hardness: 0.4, mass: 700, heatCap: 1.3, cond: 0.55, color: [48, 168, 132], resource: "algae", yield: 60 },
  { id: 8, name: "Sand", solid: true, permeable: false, diggable: true, hardness: 0.3, mass: 1600, heatCap: 0.83, cond: 0.4, color: [196, 168, 112], resource: "dirt", yield: 40 },
  { id: 9, name: "Refined Metal", solid: true, permeable: false, diggable: false, hardness: 3, mass: 2000, heatCap: 0.39, cond: 22, color: [168, 150, 140] },
  { id: 10, name: "Tile", solid: true, permeable: false, diggable: false, hardness: 1.2, mass: 400, heatCap: 0.84, cond: 1.1, color: [92, 108, 118], built: true },
  { id: 11, name: "Wall", solid: true, permeable: false, diggable: false, hardness: 1.4, mass: 400, heatCap: 0.84, cond: 0.7, color: [118, 96, 82], built: true },
  { id: 12, name: "Insulation", solid: true, permeable: false, diggable: false, hardness: 1.1, mass: 300, heatCap: 1.2, cond: 0.02, color: [86, 74, 108], built: true },
  { id: 13, name: "Ladder", solid: false, permeable: true, diggable: false, hardness: 0, mass: 80, heatCap: 0.4, cond: 8, color: [196, 132, 64], built: true, climb: true },
  { id: 14, name: "Airflow Tile", solid: true, permeable: true, diggable: false, hardness: 1, mass: 200, heatCap: 0.4, cond: 10, color: [90, 130, 140], built: true },
];

export const GASES = [
  { id: 0, name: "Oxygen", density: 1.43, heatCap: 1.01, cond: 0.026, color: [80, 190, 255], breathable: true },
  { id: 1, name: "Carbon Dioxide", density: 1.84, heatCap: 0.85, cond: 0.016, color: [70, 70, 88] },
  { id: 2, name: "Hydrogen", density: 0.09, heatCap: 14.3, cond: 0.18, color: [255, 170, 70] },
  { id: 3, name: "Steam", density: 0.6, heatCap: 2.08, cond: 0.018, color: [230, 236, 244] },
];

export const LIQUIDS = [
  { id: 0, name: "Water", density: 1.0, heatCap: 4.18, cond: 0.6, color: [56, 140, 220], freeze: 273.15, boil: 373.15 },
  { id: 1, name: "Polluted Water", density: 1.05, heatCap: 4.1, cond: 0.58, color: [92, 130, 70], freeze: 268, boil: 392 },
  { id: 2, name: "Magma", density: 2.5, heatCap: 1.0, cond: 1.0, color: [255, 96, 32], freeze: 1400, boil: 3000 },
];

export const BUILDINGS = {
  wall: { id: "wall", name: "Habitat Wall", cat: "base", w: 1, h: 1, cost: { metal: 25 }, mat: MAT.WALL, desc: "Seals atmosphere. Blocks gas and liquid." },
  floor: { id: "floor", name: "Floor Tile", cat: "base", w: 1, h: 1, cost: { metal: 20 }, mat: MAT.FLOOR, desc: "Walkable sealed floor." },
  insulation: { id: "insulation", name: "Insulated Tile", cat: "base", w: 1, h: 1, cost: { metal: 40, dirt: 20 }, mat: MAT.INSULATION, desc: "Almost no heat transfer." },
  ladder: { id: "ladder", name: "Ladder", cat: "base", w: 1, h: 1, cost: { metal: 15 }, mat: MAT.LADDER, desc: "Climb between floors." },
  mesh: { id: "mesh", name: "Airflow Tile", cat: "base", w: 1, h: 1, cost: { metal: 25 }, mat: MAT.MESH, desc: "Standable grate that lets fluids through." },
  door: { id: "door", name: "Pneumatic Door", cat: "base", w: 1, h: 2, cost: { metal: 80 }, power: 0, desc: "Opens for dupes, seals rooms." },

  wire: { id: "wire", name: "Conductive Wire", cat: "power", w: 1, h: 1, cost: { metal: 8 }, layer: "wire", desc: "Connects generators, batteries, and machines." },
  generator: { id: "generator", name: "Manual Generator", cat: "power", w: 2, h: 2, cost: { metal: 120 }, produceW: 400, operated: true, desc: "A dupe runs the wheel to make power." },
  coalgen: { id: "coalgen", name: "Coal Generator", cat: "power", w: 2, h: 2, cost: { metal: 180 }, produceW: 600, consume: { coal: 0.08 }, heat: 18, exhaust: "co2", desc: "Burns coal. Hot, and it belches CO₂." },
  battery: { id: "battery", name: "Smart Battery", cat: "power", w: 1, h: 2, cost: { metal: 100 }, storageJ: 12000, desc: "Stores surplus joules for night and idle hours." },

  oxygen: { id: "oxygen", name: "Algae Diffuser", cat: "oxygen", w: 1, h: 2, cost: { metal: 80 }, power: 120, consume: { algae: 0.035 }, emit: { o2: 18 }, desc: "Turns algae into breathable oxygen." },
  electrolyzer: { id: "electrolyzer", name: "Electrolyzer", cat: "oxygen", w: 2, h: 2, cost: { metal: 160 }, power: 120, consumeLiq: 80, emit: { o2: 22, h2: 6 }, desc: "Splits water into O₂ and H₂." },
  gaspump: { id: "gaspump", name: "Gas Pump", cat: "oxygen", w: 2, h: 2, cost: { metal: 80 }, power: 120, layerNeed: "vent", desc: "Pulls gas into the ventilation layer." },
  gaspipe: { id: "gaspipe", name: "Gas Pipe", cat: "oxygen", w: 1, h: 1, cost: { metal: 6 }, layer: "vent", desc: "Moves gas packets between pumps and vents." },
  gasvent: { id: "gasvent", name: "Gas Vent", cat: "oxygen", w: 1, h: 1, cost: { metal: 30 }, layerNeed: "vent", desc: "Dumps pipe gas into the room." },

  liqpump: { id: "liqpump", name: "Liquid Pump", cat: "plumb", w: 2, h: 2, cost: { metal: 80 }, power: 120, layerNeed: "pipe", desc: "Lifts liquid into plumbing." },
  pipe: { id: "pipe", name: "Liquid Pipe", cat: "plumb", w: 1, h: 1, cost: { metal: 6 }, layer: "pipe", desc: "Carries water and other liquids." },
  liqvent: { id: "liqvent", name: "Liquid Vent", cat: "plumb", w: 1, h: 1, cost: { metal: 30 }, layerNeed: "pipe", desc: "Pours pipe liquid onto the tile." },

  cot: { id: "cot", name: "Cot", cat: "life", w: 2, h: 1, cost: { metal: 40 }, comfort: 1, desc: "A dupe sleeps here each cycle." },
  table: { id: "table", name: "Mess Table", cat: "life", w: 1, h: 1, cost: { metal: 30 }, desc: "Eat here for a morale bump." },
  outhouse: { id: "outhouse", name: "Outhouse", cat: "life", w: 1, h: 2, cost: { metal: 40, dirt: 20 }, desc: "Required. Periodically produces polluted water." },
  storage: { id: "storage", name: "Storage Bin", cat: "life", w: 1, h: 1, cost: { metal: 40 }, desc: "Drops and stores dug resources." },
  heater: { id: "heater", name: "Space Heater", cat: "life", w: 1, h: 1, cost: { metal: 70 }, power: 120, heat: 36, desc: "Pumps heat into the tile." },
  cooler: { id: "cooler", name: "Wheezewort Cooler", cat: "life", w: 1, h: 2, cost: { metal: 90 }, power: 240, heat: -40, desc: "Pulls heat out of the room." },

  farm: { id: "farm", name: "Farm Plot", cat: "food", w: 1, h: 1, cost: { dirt: 40 }, growTicks: 280, food: 1200, desc: "Grows night-cap mushrooms. Harvest for kcal." },
  research: { id: "research", name: "Research Station", cat: "food", w: 2, h: 2, cost: { metal: 100 }, power: 60, operated: true, desc: "A dupe researches here to unlock efficiency." },

  autowire: { id: "autowire", name: "Automation Wire", cat: "auto", w: 1, h: 1, cost: { metal: 5 }, layer: "automationWire", desc: "Carries green/red logic. Connects sensors, gates, and machine ports." },
  thermosensor: { id: "thermosensor", name: "Thermo Sensor", cat: "auto", w: 1, h: 1, cost: { metal: 25 }, desc: "Green when this tile is hotter than the set threshold. Red otherwise." },
  notgate: { id: "notgate", name: "NOT Gate", cat: "auto", w: 1, h: 2, cost: { metal: 20 }, desc: "Inverts the signal. Bottom is in, top is out. One tick of delay." },
};

export const BUILD_CATS = [
  { id: "base", name: "Structure", items: ["wall", "floor", "insulation", "ladder", "mesh", "door"] },
  { id: "power", name: "Power", items: ["wire", "generator", "coalgen", "battery"] },
  { id: "oxygen", name: "Oxygen", items: ["oxygen", "electrolyzer", "gaspump", "gaspipe", "gasvent"] },
  { id: "plumb", name: "Plumbing", items: ["liqpump", "pipe", "liqvent"] },
  { id: "life", name: "Living", items: ["cot", "table", "outhouse", "storage", "heater", "cooler"] },
  { id: "food", name: "Station", items: ["farm", "research"] },
  { id: "auto", name: "Auto", items: ["autowire", "thermosensor", "notgate"] },
];

export const STARTER = {
  metal: 700,
  algae: 90,
  coal: 40,
  dirt: 120,
  ice: 0,
  food: 28000,
};

export const COLONIST_DEFS = [
  { id: "rhea", name: "Rhea", sprite: "colonist_rhea", hair: "#c96a3a", suit: "#d4a04a", skill: { dig: 1.25, build: 1.0, operate: 0.9, farm: 1.0 } },
  { id: "malik", name: "Malik", sprite: "colonist_malik", hair: "#3a2a22", suit: "#4d7d78", skill: { dig: 1.1, build: 1.2, operate: 1.15, farm: 0.85 } },
  { id: "jun", name: "Jun", sprite: "colonist_jun", hair: "#c8c8d0", suit: "#7b4db0", skill: { dig: 0.9, build: 0.95, operate: 1.05, farm: 1.3 } },
  { id: "vesper", name: "Vesper", sprite: "colonist_vesper", hair: "#ece6de", suit: "#c9a8a0", skill: { dig: 0.8, build: 1.0, operate: 1.35, farm: 1.1 } },
];

export function idx(x, y, w = WORLD_W) {
  return y * w + x;
}

export function inBounds(x, y, w = WORLD_W, h = WORLD_H) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function isSolidMat(id) {
  return MATERIALS[id]?.solid === true;
}

export function isPermeableMat(id) {
  return MATERIALS[id]?.permeable === true;
}

export function isDiggableMat(id) {
  return MATERIALS[id]?.diggable === true;
}

export function hash2(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) >>> 0;
}
