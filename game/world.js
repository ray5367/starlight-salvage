// The world model: the salvage field's entities, wave layouts, upgrade pool
// and spawn rules. No drawing and no input handling live here; physics.js
// moves these entities and render.js draws them.

import { makeRng } from './rng.js';
import { sectorForWave } from './biomes.js';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const STATION_X = 640;
export const STATION_Y = 360;
export const RING_RADIUS = 108;
export const DOCK_RADIUS = 175;
export const VOLATILE_HOLD_LIMIT = 3;
export const MAX_WAVES = 5;
export const COMBO_WINDOW = 6;
export const COMBO_CAP = 5;

// Difficulties, picked on the title screen. Each one changes the hull, the
// fuel tank, the mass quotas, the mine damage and the drift speed, and
// Wreckdiver doubles every score, so the choice is a real trade, not a label.
export const DIFFICULTIES = [
  {
    id: 'drifter',
    name: 'DRIFTER',
    desc: 'Relaxed: sturdy hull, smaller quotas',
    hull: 130,
    fuel: 120,
    quotaMult: 0.8,
    mineDamage: 15,
    speedMult: 0.9,
    scoreMult: 1,
  },
  {
    id: 'salvager',
    name: 'SALVAGER',
    desc: 'The standard salvage run',
    hull: 100,
    fuel: 100,
    quotaMult: 1,
    mineDamage: 25,
    speedMult: 1,
    scoreMult: 1,
  },
  {
    id: 'wreckdiver',
    name: 'WRECKDIVER',
    desc: 'Brutal field, double score',
    hull: 75,
    fuel: 90,
    quotaMult: 1.25,
    mineDamage: 35,
    speedMult: 1.15,
    scoreMult: 2,
  },
];

export function difficultyById(id) {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? DIFFICULTIES[1];
}

export const WAVE_CONFIGS = [
  { quota: 6, debris: 12, mines: 2, speed: 1.0, volatileChance: 0.18 },
  { quota: 9, debris: 15, mines: 3, speed: 1.15, volatileChance: 0.22 },
  { quota: 12, debris: 18, mines: 4, speed: 1.3, volatileChance: 0.3 },
  { quota: 16, debris: 21, mines: 5, speed: 1.45, volatileChance: 0.32 },
  { quota: 20, debris: 24, mines: 6, speed: 1.6, volatileChance: 0.34 },
];

export const DEBRIS_TYPES = {
  scrap: { value: 10, mass: 1, color: '#7dd3fc', glow: '#38bdf8', label: 'SCRAP' },
  volatile: { value: 30, mass: 1, color: '#fcd34d', glow: '#f59e0b', label: 'VOLATILE' },
  core: { value: 50, mass: 1, color: '#e879f9', glow: '#c026d3', label: 'DATA CORE' },
};

export function createWorld(seed, difficultyId = 'salvager') {
  const rng = makeRng(seed);
  const difficulty = difficultyById(difficultyId);
  return {
    seed,
    rng,
    difficulty,
    ship: {
      x: 640,
      y: 580,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 15,
      hull: difficulty.hull,
      maxHull: difficulty.hull,
      fuel: difficulty.fuel,
      maxFuel: difficulty.fuel,
      thrust: 300,
      tetherRange: 260,
      magnetRadius: 90,
      thrusting: false,
      invuln: 0,
      docking: false,
      // Ship systems installed by upgrades; every one starts at its base
      // value and changes only through applyUpgrade in upgrades.js.
      shield: 0,
      maxShield: 0,
      regen: 0,
      fuelOnBank: 0,
      scoreMult: 1,
      volatileHold: VOLATILE_HOLD_LIMIT,
      mineResist: 0,
      comboWindow: COMBO_WINDOW,
    },
    debris: [],
    mines: [],
    fuelCells: [],
    bosses: [],
    shockwaves: [],
    drone: null,
    bossesDown: 0,
    sector: sectorForWave(1),
    particles: [],
    floaters: [],
    tether: { target: null, heldTime: 0 },
    wave: 1,
    score: 0,
    bankedMass: 0,
    quota: WAVE_CONFIGS[0].quota,
    bankedCount: 0,
    runTime: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    banner: null,
    flare: { phase: 'idle', timer: rng.range(16, 24), time: 0 },
    shake: 0,
    flash: 0,
    upgradesTaken: [],
  };
}

// The centered banner shown when a wave starts: the wave number and its
// quota, fading out over its lifetime. Only one banner shows at a time.
export function setBanner(world, text, sub, ttl = 2.6) {
  world.banner = { text, sub, time: ttl, ttl };
}

function spawnSpot(world, minStation, minShip) {
  const rng = world.rng;
  for (let tries = 0; tries < 40; tries += 1) {
    const x = rng.range(50, GAME_WIDTH - 50);
    const y = rng.range(60, GAME_HEIGHT - 50);
    const fromStation = Math.hypot(x - STATION_X, y - STATION_Y);
    const fromShip = Math.hypot(x - world.ship.x, y - world.ship.y);
    if (fromStation > minStation && fromShip > minShip) return { x, y };
  }
  return { x: rng.range(50, GAME_WIDTH - 50), y: rng.range(60, GAME_HEIGHT - 50) };
}

function makeDebrisShape(rng, radius) {
  const points = rng.int(7, 9);
  const shape = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const r = radius * rng.range(0.7, 1.15);
    shape.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return shape;
}

export function makeDebris(world, type, speedMult) {
  const rng = world.rng;
  const spot = spawnSpot(world, 230, 170);
  const heading = rng.angle();
  const speed = rng.range(20, 60) * speedMult;
  const radius = type === 'core' ? rng.range(12, 15) : type === 'volatile' ? rng.range(14, 18) : rng.range(13, 20);
  return {
    type,
    x: spot.x,
    y: spot.y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    angle: rng.angle(),
    spin: rng.range(-1.2, 1.2),
    radius,
    mass: DEBRIS_TYPES[type].mass,
    value: DEBRIS_TYPES[type].value,
    shape: makeDebrisShape(rng, radius),
  };
}

export function makeDebrisAt(world, type, x, y, speedMult) {
  const rng = world.rng;
  const heading = rng.angle();
  const speed = rng.range(30, 90) * speedMult;
  const radius = type === 'core' ? rng.range(12, 15) : type === 'volatile' ? rng.range(14, 18) : rng.range(13, 20);
  return {
    type,
    x: x + rng.range(-30, 30),
    y: y + rng.range(-30, 30),
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    angle: rng.angle(),
    spin: rng.range(-1.2, 1.2),
    radius,
    mass: DEBRIS_TYPES[type].mass,
    value: DEBRIS_TYPES[type].value,
    shape: makeDebrisShape(rng, radius),
  };
}

export function makeMine(world, speedMult) {
  const rng = world.rng;
  const spot = spawnSpot(world, 250, 220);
  const heading = rng.angle();
  const speed = rng.range(10, 26) * speedMult;
  return {
    x: spot.x,
    y: spot.y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    radius: 14,
    blink: rng.range(0, Math.PI * 2),
  };
}

export function makeFuelCell(world) {
  const rng = world.rng;
  const spot = spawnSpot(world, 200, 150);
  const heading = rng.angle();
  const speed = rng.range(8, 18);
  return {
    x: spot.x,
    y: spot.y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    radius: 12,
    pulse: rng.range(0, Math.PI * 2),
  };
}

export function startWave(world, wave) {
  const config = WAVE_CONFIGS[wave - 1];
  const sector = sectorForWave(wave);
  const speed = config.speed * world.difficulty.speedMult * sector.driftMult;
  world.wave = wave;
  world.sector = sector;
  world.quota = Math.max(1, Math.round(config.quota * world.difficulty.quotaMult));
  world.bankedMass = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.debris = [];
  world.mines = [];
  world.fuelCells = [];
  world.bosses = [];
  world.shockwaves = [];
  world.tether.target = null;
  world.tether.heldTime = 0;
  world.ship.shield = world.ship.maxShield;
  const volatileChance = Math.min(0.5, config.volatileChance + sector.volatileBonus);
  for (let i = 0; i < config.debris; i += 1) {
    let type = 'scrap';
    if (i === 0) type = 'core';
    else if (i === 1) type = 'volatile';
    else {
      const roll = world.rng.next();
      if (roll < 0.1) type = 'core';
      else if (roll < 0.1 + volatileChance) type = 'volatile';
    }
    world.debris.push(makeDebris(world, type, speed));
  }
  for (let i = 0; i < config.mines + sector.mineBonus; i += 1) world.mines.push(makeMine(world, speed));
  for (let i = 0; i < 2; i += 1) world.fuelCells.push(makeFuelCell(world));
  setBanner(world, `WAVE ${wave} — ${sector.name}`, `BANK ${world.quota} MASS  ·  ${world.difficulty.name}`);
}

export function seedAmbientField(world) {
  for (let i = 0; i < 12; i += 1) {
    const type = i === 0 ? 'core' : i === 1 ? 'volatile' : 'scrap';
    world.debris.push(makeDebris(world, type, 0.7));
  }
  for (let i = 0; i < 3; i += 1) world.mines.push(makeMine(world, 0.7));
}

export function addParticles(world, x, y, { count, color, speed, life, size }) {
  const rng = world.rng;
  for (let i = 0; i < count; i += 1) {
    const heading = rng.angle();
    const velocity = rng.range(0.25, 1) * speed;
    world.particles.push({
      x,
      y,
      vx: Math.cos(heading) * velocity,
      vy: Math.sin(heading) * velocity,
      life: rng.range(0.5, 1) * life,
      maxLife: life,
      size: rng.range(0.6, 1.4) * size,
      color,
    });
  }
  if (world.particles.length > 400) world.particles.splice(0, world.particles.length - 400);
}

export function addFloater(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  if (world.floaters.length > 20) world.floaters.shift();
}
