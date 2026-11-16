// Movement, the tether spring, collisions, banking, flares and damage. One
// step advances the world by dt and returns the events that happened, so the
// caller can play sounds and change screens without physics knowing about them.

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  STATION_X,
  STATION_Y,
  RING_RADIUS,
  DOCK_RADIUS,
  VOLATILE_HOLD_LIMIT,
  DEBRIS_TYPES,
  WAVE_CONFIGS,
  addParticles,
  addFloater,
} from './world.js';

const SHIP_DAMPING = 0.9;
const DEBRIS_DAMPING = 0.08;
const SHIP_MAX_SPEED = 340;
const FUEL_BURN = 7;
const DOCK_REFUEL = 7;
const TETHER_REST = 64;
const TETHER_SPRING = 5.0;
const TETHER_DAMPING = 2.2;
const HARD_HIT_SPEED = 200;
const VOLATILE_IMPACT_SPEED = 240;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function bounceOffWalls(body, radius) {
  if (body.x < radius) {
    body.x = radius;
    body.vx = Math.abs(body.vx) * 0.7;
  } else if (body.x > GAME_WIDTH - radius) {
    body.x = GAME_WIDTH - radius;
    body.vx = -Math.abs(body.vx) * 0.7;
  }
  if (body.y < radius) {
    body.y = radius;
    body.vy = Math.abs(body.vy) * 0.7;
  } else if (body.y > GAME_HEIGHT - radius) {
    body.y = GAME_HEIGHT - radius;
    body.vy = -Math.abs(body.vy) * 0.7;
  }
}

function damageShip(world, amount, events) {
  const ship = world.ship;
  if (ship.invuln > 0) return false;
  ship.hull -= amount;
  ship.invuln = 0.7;
  world.shake = Math.min(1, world.shake + 0.45);
  events.push({ type: 'hull_hit', amount });
  if (ship.hull <= 0) {
    ship.hull = 0;
    events.push({ type: 'game_over' });
  }
  return true;
}

function explodeDebris(world, debris, events) {
  const index = world.debris.indexOf(debris);
  if (index !== -1) world.debris.splice(index, 1);
  if (world.tether.target === debris) world.tether.target = null;
  addParticles(world, debris.x, debris.y, { count: 34, color: '#fbbf24', speed: 260, life: 0.7, size: 3 });
  addParticles(world, debris.x, debris.y, { count: 18, color: '#f97316', speed: 150, life: 0.5, size: 4 });
  world.shake = Math.min(1, world.shake + 0.55);
  world.flash = Math.min(1, world.flash + 0.5);
  events.push({ type: 'explode', x: debris.x, y: debris.y });
  const ship = world.ship;
  if (distance(debris.x, debris.y, ship.x, ship.y) < 160) damageShip(world, 20, events);
}

function bankDebris(world, debris, events) {
  const index = world.debris.indexOf(debris);
  if (index !== -1) world.debris.splice(index, 1);
  world.score += debris.value;
  world.bankedMass += debris.mass;
  world.bankedCount += 1;
  addParticles(world, debris.x, debris.y, { count: 22, color: DEBRIS_TYPES[debris.type].glow, speed: 170, life: 0.6, size: 2.5 });
  addFloater(world, STATION_X, STATION_Y - RING_RADIUS - 14, `+${debris.value} ${DEBRIS_TYPES[debris.type].label}`, DEBRIS_TYPES[debris.type].color);
  events.push({ type: 'bank', value: debris.value, mass: debris.mass });
  if (world.bankedMass >= world.quota) {
    world.score += 100 * world.wave;
    events.push({ type: 'wave_clear' });
  }
}

function nearestDebrisInRange(world, x, y, range) {
  let best = null;
  let bestDist = range;
  for (const debris of world.debris) {
    const dist = distance(x, y, debris.x, debris.y);
    if (dist <= bestDist) {
      best = debris;
      bestDist = dist;
    }
  }
  return best;
}

function releaseTether(world, events, checkBank) {
  const tether = world.tether;
  const target = tether.target;
  tether.target = null;
  tether.heldTime = 0;
  if (!target) return;
  if (checkBank && distance(target.x, target.y, STATION_X, STATION_Y) < RING_RADIUS) {
    bankDebris(world, target, events);
  } else {
    events.push({ type: 'tether_release' });
  }
}

function updateTether(world, input, dt, events) {
  const ship = world.ship;
  const tether = world.tether;
  const held = input.tetherHeld();
  if (!tether.target) {
    if (held) {
      const target = nearestDebrisInRange(world, ship.x, ship.y, ship.tetherRange);
      if (target) {
        tether.target = target;
        tether.heldTime = 0;
        addParticles(world, target.x, target.y, { count: 8, color: '#67e8f9', speed: 90, life: 0.35, size: 2 });
        events.push({ type: 'tether_attach', debris: target });
      }
    }
    return;
  }
  const target = tether.target;
  tether.heldTime += dt;
  const dx = ship.x - target.x;
  const dy = ship.y - target.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const stretch = dist - TETHER_REST;
  const relAlong = (ship.vx - target.vx) * nx + (ship.vy - target.vy) * ny;
  const accel = stretch * TETHER_SPRING + relAlong * TETHER_DAMPING;
  target.vx += nx * accel * dt;
  target.vy += ny * accel * dt;
  ship.vx -= nx * accel * dt * 0.1;
  ship.vy -= ny * accel * dt * 0.1;
  if (dist > ship.tetherRange * 1.5) {
    releaseTether(world, events, false);
    return;
  }
  if (target.type === 'volatile' && tether.heldTime > VOLATILE_HOLD_LIMIT) {
    explodeDebris(world, target, events);
    return;
  }
  if (!held) releaseTether(world, events, true);
}

function updateShip(world, input, dt) {
  const ship = world.ship;
  ship.angle = Math.atan2(input.mouse.y - ship.y, input.mouse.x - ship.x);
  let thrustX = 0;
  let thrustY = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) thrustY -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) thrustY += 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) thrustX -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) thrustX += 1;
  const magnitude = Math.hypot(thrustX, thrustY);
  ship.thrusting = false;
  if (magnitude > 0 && ship.fuel > 0) {
    const scale = ship.thrust / magnitude;
    ship.vx += thrustX * scale * dt;
    ship.vy += thrustY * scale * dt;
    ship.fuel = Math.max(0, ship.fuel - FUEL_BURN * dt);
    ship.thrusting = true;
    if (world.rng.chance(0.6)) {
      const backX = ship.x - Math.cos(ship.angle) * 18;
      const backY = ship.y - Math.sin(ship.angle) * 18;
      addParticles(world, backX, backY, { count: 1, color: '#22d3ee', speed: 60, life: 0.3, size: 2 });
    }
  }
  const damping = Math.exp(-SHIP_DAMPING * dt);
  ship.vx *= damping;
  ship.vy *= damping;
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > SHIP_MAX_SPEED) {
    ship.vx = (ship.vx / speed) * SHIP_MAX_SPEED;
    ship.vy = (ship.vy / speed) * SHIP_MAX_SPEED;
  }
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  bounceOffWalls(ship, ship.radius);
  ship.invuln = Math.max(0, ship.invuln - dt);
  const fromStation = distance(ship.x, ship.y, STATION_X, STATION_Y);
  ship.docking = fromStation < DOCK_RADIUS && speed < 80 && ship.fuel < ship.maxFuel;
  if (ship.docking) ship.fuel = Math.min(ship.maxFuel, ship.fuel + DOCK_REFUEL * dt);
}

function updateDrifters(world, dt) {
  const ship = world.ship;
  const damping = Math.exp(-DEBRIS_DAMPING * dt);
  for (const debris of world.debris) {
    const fromShip = distance(debris.x, debris.y, ship.x, ship.y);
    if (world.tether.target !== debris && debris.type === 'scrap' && fromShip < ship.magnetRadius && fromShip > 1) {
      debris.vx += ((ship.x - debris.x) / fromShip) * 30 * dt;
      debris.vy += ((ship.y - debris.y) / fromShip) * 30 * dt;
    }
    debris.vx *= damping;
    debris.vy *= damping;
    debris.x += debris.vx * dt;
    debris.y += debris.vy * dt;
    debris.angle += debris.spin * dt;
    bounceOffWalls(debris, debris.radius);
  }
  for (const mine of world.mines) {
    mine.vx *= damping;
    mine.vy *= damping;
    mine.x += mine.vx * dt;
    mine.y += mine.vy * dt;
    mine.blink += dt * 3;
    bounceOffWalls(mine, mine.radius);
  }
  for (const cell of world.fuelCells) {
    const fromShip = distance(cell.x, cell.y, ship.x, ship.y);
    if (fromShip < ship.magnetRadius && fromShip > 1) {
      cell.vx += ((ship.x - cell.x) / fromShip) * 130 * dt;
      cell.vy += ((ship.y - cell.y) / fromShip) * 130 * dt;
    }
    cell.vx *= damping;
    cell.vy *= damping;
    cell.x += cell.vx * dt;
    cell.y += cell.vy * dt;
    cell.pulse += dt * 4;
    bounceOffWalls(cell, cell.radius);
  }
}

function updateCollisions(world, events) {
  const ship = world.ship;
  for (const debris of world.debris.slice()) {
    const dx = debris.x - ship.x;
    const dy = debris.y - ship.y;
    const dist = Math.hypot(dx, dy);
    const minDist = ship.radius + debris.radius;
    if (dist >= minDist || dist === 0) continue;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    debris.x += nx * overlap;
    debris.y += ny * overlap;
    const relVx = debris.vx - ship.vx;
    const relVy = debris.vy - ship.vy;
    const closing = -(relVx * nx + relVy * ny);
    if (closing > 0) {
      const impulse = (1.6 * closing) / (1 / 3 + 1 / debris.mass);
      debris.vx += (impulse / debris.mass) * nx;
      debris.vy += (impulse / debris.mass) * ny;
      ship.vx -= (impulse / 3) * nx;
      ship.vy -= (impulse / 3) * ny;
    }
    if (closing > HARD_HIT_SPEED) {
      if (debris.type === 'volatile' && closing > VOLATILE_IMPACT_SPEED) {
        explodeDebris(world, debris, events);
      } else {
        damageShip(world, Math.min(12, 2 + Math.round((closing - HARD_HIT_SPEED) / 25)), events);
      }
    }
  }
  for (const mine of world.mines.slice()) {
    if (distance(mine.x, mine.y, ship.x, ship.y) < mine.radius + ship.radius) {
      const index = world.mines.indexOf(mine);
      if (index !== -1) world.mines.splice(index, 1);
      addParticles(world, mine.x, mine.y, { count: 30, color: '#f87171', speed: 240, life: 0.6, size: 3 });
      world.shake = Math.min(1, world.shake + 0.5);
      events.push({ type: 'mine_hit', x: mine.x, y: mine.y });
      damageShip(world, 25, events);
    }
  }
  for (const cell of world.fuelCells.slice()) {
    if (distance(cell.x, cell.y, ship.x, ship.y) < cell.radius + ship.radius + 6) {
      const index = world.fuelCells.indexOf(cell);
      if (index !== -1) world.fuelCells.splice(index, 1);
      ship.fuel = Math.min(ship.maxFuel, ship.fuel + 40);
      addParticles(world, cell.x, cell.y, { count: 14, color: '#4ade80', speed: 110, life: 0.5, size: 2.5 });
      addFloater(world, cell.x, cell.y - 18, '+40 FUEL', '#4ade80');
      events.push({ type: 'fuel' });
    }
  }
}

function updateFlare(world, dt, events) {
  const flare = world.flare;
  const config = WAVE_CONFIGS[world.wave - 1];
  if (flare.phase === 'idle') {
    flare.timer -= dt;
    if (flare.timer <= 0) {
      flare.phase = 'warn';
      flare.time = 2;
      events.push({ type: 'flare_warn' });
    }
  } else if (flare.phase === 'warn') {
    flare.time -= dt;
    if (flare.time <= 0) {
      flare.phase = 'active';
      flare.time = 3;
      for (const debris of world.debris) {
        const heading = world.rng.angle();
        const surge = world.rng.range(60, 140) * config.speed;
        debris.vx += Math.cos(heading) * surge;
        debris.vy += Math.sin(heading) * surge;
      }
      for (const mine of world.mines) {
        const heading = world.rng.angle();
        mine.vx += Math.cos(heading) * 50;
        mine.vy += Math.sin(heading) * 50;
      }
      world.flash = 1;
      world.shake = Math.min(1, world.shake + 0.3);
      events.push({ type: 'flare_start' });
    }
  } else {
    flare.time -= dt;
    if (flare.time <= 0) {
      flare.phase = 'idle';
      flare.timer = world.rng.range(18, 26);
    }
  }
}

function updateEffects(world, dt) {
  for (const particle of world.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.exp(-2 * dt);
    particle.vy *= Math.exp(-2 * dt);
  }
  world.particles = world.particles.filter((particle) => particle.life > 0);
  for (const floater of world.floaters) {
    floater.life -= dt;
    floater.y -= 26 * dt;
  }
  world.floaters = world.floaters.filter((floater) => floater.life > 0);
  world.shake = Math.max(0, world.shake - dt * 1.6);
  world.flash = Math.max(0, world.flash - dt * 1.2);
}

export function stepWorld(world, input, dt) {
  const events = [];
  world.runTime += dt;
  updateFlare(world, dt, events);
  updateShip(world, input, dt);
  updateTether(world, input, dt, events);
  updateDrifters(world, dt);
  updateCollisions(world, events);
  updateEffects(world, dt);
  return events;
}

export function stepAmbient(world, dt) {
  const damping = Math.exp(-DEBRIS_DAMPING * dt);
  for (const debris of world.debris) {
    debris.vx *= damping;
    debris.vy *= damping;
    debris.x += debris.vx * dt;
    debris.y += debris.vy * dt;
    debris.angle += debris.spin * dt;
    bounceOffWalls(debris, debris.radius);
  }
  for (const mine of world.mines) {
    mine.vx *= damping;
    mine.vy *= damping;
    mine.x += mine.vx * dt;
    mine.y += mine.vy * dt;
    mine.blink += dt * 3;
    bounceOffWalls(mine, mine.radius);
  }
  updateEffects(world, dt);
}
