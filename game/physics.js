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
  COMBO_CAP,
  DEBRIS_TYPES,
  WAVE_CONFIGS,
  makeDebris,
  addParticles,
  addFloater,
} from './world.js';
import { updateBosses, updateShockwaves, damageBoss, bossDebrisImpact } from './bosses.js';

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
  // The Aegis shield eats the whole hit and spends one charge; the hull
  // only suffers once the shield is down.
  if (ship.shield > 0) {
    ship.shield -= 1;
    ship.invuln = 0.7;
    addParticles(world, ship.x, ship.y, { count: 18, color: '#67e8f9', speed: 160, life: 0.4, size: 2.5 });
    events.push({ type: 'shield_block' });
    return false;
  }
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
  // A volatile blast beside a boss cracks its armour: the tether stays the
  // weapon, and dragging a volatile into a boss is the fastest kill.
  for (const boss of world.bosses.slice()) {
    if (distance(debris.x, debris.y, boss.x, boss.y) < 170 + boss.radius) {
      damageBoss(world, boss, 2, events);
    }
  }
}

function bankDebris(world, debris, events, viaDrone = false) {
  const index = world.debris.indexOf(debris);
  if (index !== -1) world.debris.splice(index, 1);
  const ship = world.ship;
  // Banking again before the combo window runs out raises the multiplier, up
  // to the cap; a slow run banks at x1. Wreckdiver doubles every score, and
  // Overcharge coils multiply it again. Drone deliveries bank flat: the
  // combo is the pilot's to earn.
  let multiplier = 1;
  if (!viaDrone) {
    world.combo = world.comboTimer > 0 ? world.combo + 1 : 1;
    world.comboTimer = ship.comboWindow;
    world.bestCombo = Math.max(world.bestCombo, world.combo);
    multiplier = Math.min(world.combo, COMBO_CAP);
  }
  const points = Math.round(debris.value * multiplier * ship.scoreMult * world.difficulty.scoreMult);
  world.score += points;
  world.bankedMass += debris.mass;
  world.bankedCount += 1;
  if (ship.fuelOnBank > 0) ship.fuel = Math.min(ship.maxFuel, ship.fuel + ship.fuelOnBank);
  addParticles(world, debris.x, debris.y, { count: 22, color: DEBRIS_TYPES[debris.type].glow, speed: 170, life: 0.6, size: 2.5 });
  const label = multiplier > 1 ? `+${points} ${DEBRIS_TYPES[debris.type].label} x${multiplier}` : `+${points} ${DEBRIS_TYPES[debris.type].label}`;
  addFloater(world, STATION_X, STATION_Y - RING_RADIUS - 14, label, DEBRIS_TYPES[debris.type].color);
  events.push({ type: 'bank', value: points, mass: debris.mass, combo: world.combo, multiplier });
  if (world.bankedMass >= world.quota) {
    world.score += 100 * world.wave * world.difficulty.scoreMult;
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
  if (target.type === 'volatile' && tether.heldTime > ship.volatileHold) {
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
  // An empty tank leaves the emergency reserve: quarter-power thrust that
  // burns nothing, so a stranded ship can always limp back to the ring.
  const reserve = ship.fuel <= 0;
  const power = reserve ? 0.25 : 1;
  if (magnitude > 0) {
    const scale = (ship.thrust * power) / magnitude;
    ship.vx += thrustX * scale * dt;
    ship.vy += thrustY * scale * dt;
    if (!reserve) ship.fuel = Math.max(0, ship.fuel - FUEL_BURN * dt);
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
  if (ship.regen > 0 && ship.hull > 0) ship.hull = Math.min(ship.maxHull, ship.hull + ship.regen * dt);
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
      damageShip(world, Math.round(world.difficulty.mineDamage * (1 - ship.mineResist)), events);
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
  for (const boss of world.bosses.slice()) {
    // Debris slammed into the boss at speed cracks its armour; gentle
    // contact just bounces off.
    for (const debris of world.debris.slice()) {
      const dx = debris.x - boss.x;
      const dy = debris.y - boss.y;
      const dist = Math.hypot(dx, dy);
      const minDist = boss.radius + debris.radius;
      if (dist >= minDist || dist === 0) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      debris.x = boss.x + nx * minDist;
      debris.y = boss.y + ny * minDist;
      const closing = -((debris.vx - boss.vx) * nx + (debris.vy - boss.vy) * ny);
      const reflect = 2 * ((debris.vx - boss.vx) * nx + (debris.vy - boss.vy) * ny);
      debris.vx -= reflect * nx;
      debris.vy -= reflect * ny;
      if (closing > 0) bossDebrisImpact(world, boss, debris, closing, events);
      if (!world.bosses.includes(boss)) break;
    }
    if (!world.bosses.includes(boss)) continue;
    // Ramming the boss hurts the ship, never the boss.
    const shipDist = distance(boss.x, boss.y, ship.x, ship.y);
    if (shipDist < boss.radius + ship.radius && shipDist > 0) {
      const nx = (ship.x - boss.x) / shipDist;
      const ny = (ship.y - boss.y) / shipDist;
      ship.x = boss.x + nx * (boss.radius + ship.radius);
      ship.y = boss.y + ny * (boss.radius + ship.radius);
      ship.vx += nx * 180;
      ship.vy += ny * 180;
      damageShip(world, 15, events);
    }
  }
}

function updateDrone(world, dt, events) {
  const drone = world.drone;
  if (!drone) return;
  const ship = world.ship;
  const SPEED = 250;
  let targetX;
  let targetY;
  if (drone.carrying) {
    // Ferry the load to the recycler ring and bank it flat.
    targetX = STATION_X;
    targetY = STATION_Y;
    if (Math.hypot(drone.x - STATION_X, drone.y - STATION_Y) < RING_RADIUS) {
      const load = drone.carrying;
      drone.carrying = null;
      drone.state = 'seek';
      if (world.debris.includes(load)) bankDebris(world, load, events, true);
      return;
    }
  } else {
    let nearest = null;
    let nearestDist = 520;
    for (const debris of world.debris) {
      if (debris.type !== 'scrap') continue;
      if (world.tether.target === debris) continue;
      const dist = Math.hypot(debris.x - drone.x, debris.y - drone.y);
      if (dist < nearestDist) {
        nearest = debris;
        nearestDist = dist;
      }
    }
    if (nearest) {
      targetX = nearest.x;
      targetY = nearest.y;
      if (nearestDist < 24) {
        drone.carrying = nearest;
        drone.state = 'deliver';
      }
    } else {
      // Nothing worth fetching: hold station beside the ship.
      const orbit = world.runTime * 1.1;
      targetX = ship.x + Math.cos(orbit) * 72;
      targetY = ship.y + Math.sin(orbit) * 72;
    }
  }
  const dx = targetX - drone.x;
  const dy = targetY - drone.y;
  const dist = Math.hypot(dx, dy) || 1;
  const arrive = Math.min(1, dist / 60);
  drone.vx += ((dx / dist) * SPEED * arrive - drone.vx) * Math.min(1, dt * 3);
  drone.vy += ((dy / dist) * SPEED * arrive - drone.vy) * Math.min(1, dt * 3);
  drone.x += drone.vx * dt;
  drone.y += drone.vy * dt;
  if (Math.hypot(drone.vx, drone.vy) > 20) drone.angle = Math.atan2(drone.vy, drone.vx);
  if (drone.carrying) {
    drone.carrying.x = drone.x;
    drone.carrying.y = drone.y + 16;
    drone.carrying.vx = 0;
    drone.carrying.vy = 0;
  }
}

// Sector atmosphere: embers rise through Ember Reach, cold motes drift the
// Void Veil. Pure ambience, capped so it never floods the particle budget.
function updateAmbient(world, dt) {
  const ambient = world.sector ? world.sector.ambient : null;
  if (!ambient || world.particles.length > 300) return;
  if (!world.rng.chance(dt * 7)) return;
  const rng = world.rng;
  if (ambient === 'ember') {
    world.particles.push({
      x: rng.range(0, GAME_WIDTH),
      y: GAME_HEIGHT + 4,
      vx: rng.range(-8, 8),
      vy: rng.range(-46, -26),
      life: rng.range(1.6, 2.6),
      maxLife: 2.6,
      size: rng.range(1.2, 2.4),
      color: rng.chance(0.5) ? '#fb923c' : '#fbbf24',
    });
  } else {
    world.particles.push({
      x: rng.chance(0.5) ? -4 : GAME_WIDTH + 4,
      y: rng.range(0, GAME_HEIGHT),
      vx: rng.range(10, 26) * (rng.chance(0.5) ? 1 : -1),
      vy: rng.range(-8, 8),
      life: rng.range(2, 3.4),
      maxLife: 3.4,
      size: rng.range(1.2, 2.2),
      color: '#a78bfa',
    });
  }
}

// Volatiles can detonate and bosses can scatter the field, so a wave must
// never run dry: while the debris left plus the mass already banked falls
// short of the quota, fresh scrap drifts in. The wave stays winnable.
function topUpField(world) {
  const config = WAVE_CONFIGS[world.wave - 1];
  const speed = config.speed * world.difficulty.speedMult * world.sector.driftMult;
  let guard = 0;
  while (world.debris.length + world.bankedMass < world.quota && guard < 8) {
    world.debris.push(makeDebris(world, 'scrap', speed));
    guard += 1;
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
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) {
      world.comboTimer = 0;
      world.combo = 0;
    }
  }
  if (world.banner) {
    world.banner.time -= dt;
    if (world.banner.time <= 0) world.banner = null;
  }
  updateFlare(world, dt, events);
  updateShip(world, input, dt);
  updateTether(world, input, dt, events);
  updateDrifters(world, dt);
  updateBosses(world, dt, events);
  updateShockwaves(world, dt);
  updateDrone(world, dt, events);
  updateCollisions(world, events);
  topUpField(world);
  updateEffects(world, dt);
  updateAmbient(world, dt);
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
