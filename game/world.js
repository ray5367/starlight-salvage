// The world model: the salvage field's entities, wave layouts, upgrade pool
// and spawn rules. No drawing and no input handling live here; physics.js
// moves these entities and render.js draws them.

import { makeRng } from './rng.js';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const STATION_X = 640;
export const STATION_Y = 360;
export const RING_RADIUS = 108;
export const DOCK_RADIUS = 175;
export const VOLATILE_HOLD_LIMIT = 3;
export const MAX_WAVES = 5;

export const WAVE_CONFIGS = [
  { quota: 6, debris: 10, mines: 2, speed: 1.0, volatileChance: 0.18 },
  { quota: 9, debris: 13, mines: 3, speed: 1.15, volatileChance: 0.22 },
  { quota: 12, debris: 16, mines: 4, speed: 1.3, volatileChance: 0.26 },
  { quota: 16, debris: 19, mines: 5, speed: 1.45, volatileChance: 0.3 },
  { quota: 20, debris: 22, mines: 6, speed: 1.6, volatileChance: 0.34 },
];

export const UPGRADE_POOL = [
  { id: 'hull', name: 'REINFORCED HULL', desc: '+25 max hull, and repair 25', icon: 'shield' },
  { id: 'thrust', name: 'ION THRUSTERS', desc: '+20% thrust power', icon: 'flame' },
  { id: 'tether', name: 'LONG TETHER', desc: '+30% tether range', icon: 'link' },
  { id: 'magnet', name: 'MAGNET ARRAY', desc: '+45 magnet radius', icon: 'magnet' },
  { id: 'fuel', name: 'FUEL TANK', desc: '+25 max fuel, and refill 25', icon: 'cell' },
];

export const DEBRIS_TYPES = {
  scrap: { value: 10, mass: 1, color: '#7dd3fc', glow: '#38bdf8', label: 'SCRAP' },
  volatile: { value: 30, mass: 1, color: '#fcd34d', glow: '#f59e0b', label: 'VOLATILE' },
  core: { value: 50, mass: 1, color: '#e879f9', glow: '#c026d3', label: 'DATA CORE' },
};

export function createWorld(seed) {
  const rng = makeRng(seed);
  return {
    seed,
    rng,
    ship: {
      x: 640,
      y: 580,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 15,
      hull: 100,
      maxHull: 100,
      fuel: 100,
      maxFuel: 100,
      thrust: 300,
      tetherRange: 260,
      magnetRadius: 90,
      thrusting: false,
      invuln: 0,
      docking: false,
    },
    debris: [],
    mines: [],
    fuelCells: [],
    particles: [],
    floaters: [],
    tether: { target: null, heldTime: 0 },
    wave: 1,
    score: 0,
    bankedMass: 0,
    quota: WAVE_CONFIGS[0].quota,
    bankedCount: 0,
    runTime: 0,
    flare: { phase: 'idle', timer: rng.range(16, 24), time: 0 },
    shake: 0,
    flash: 0,
    upgradesTaken: [],
  };
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
  world.wave = wave;
  world.quota = config.quota;
  world.bankedMass = 0;
  world.debris = [];
  world.mines = [];
  world.fuelCells = [];
  world.tether.target = null;
  world.tether.heldTime = 0;
  for (let i = 0; i < config.debris; i += 1) {
    let type = 'scrap';
    if (i === 0) type = 'core';
    else if (i === 1) type = 'volatile';
    else {
      const roll = world.rng.next();
      if (roll < 0.1) type = 'core';
      else if (roll < 0.1 + config.volatileChance) type = 'volatile';
    }
    world.debris.push(makeDebris(world, type, config.speed));
  }
  for (let i = 0; i < config.mines; i += 1) world.mines.push(makeMine(world, config.speed));
  for (let i = 0; i < 2; i += 1) world.fuelCells.push(makeFuelCell(world));
}

export function seedAmbientField(world) {
  for (let i = 0; i < 12; i += 1) {
    const type = i === 0 ? 'core' : i === 1 ? 'volatile' : 'scrap';
    world.debris.push(makeDebris(world, type, 0.7));
  }
  for (let i = 0; i < 3; i += 1) world.mines.push(makeMine(world, 0.7));
}

export function rollUpgrades(rng) {
  return rng.shuffle(UPGRADE_POOL).slice(0, 3);
}

export function applyUpgrade(world, upgrade) {
  const ship = world.ship;
  if (upgrade.id === 'hull') {
    ship.maxHull += 25;
    ship.hull = Math.min(ship.maxHull, ship.hull + 25);
  } else if (upgrade.id === 'thrust') {
    ship.thrust *= 1.2;
  } else if (upgrade.id === 'tether') {
    ship.tetherRange *= 1.3;
  } else if (upgrade.id === 'magnet') {
    ship.magnetRadius += 45;
  } else if (upgrade.id === 'fuel') {
    ship.maxFuel += 25;
    ship.fuel = Math.min(ship.maxFuel, ship.fuel + 25);
  }
  world.upgradesTaken.push(upgrade.id);
  return upgrade;
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
