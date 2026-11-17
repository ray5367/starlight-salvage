// The two bosses that guard the campaign's far sectors: the Scrap Warden
// in Ember Reach and the Void Reaper in the Void Veil. A boss is a hazard
// and a prize at once: it patrols the field, drops mines and charges the
// ship, and it only takes damage from debris slammed into it or volatiles
// detonated beside it, so the tether stays the weapon. Defeating one bursts
// it into data cores and pays a large bonus. The Reaper fights in two
// phases and fires shockwave rings that shove the whole field outward.

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  STATION_X,
  STATION_Y,
  addParticles,
  addFloater,
  makeDebrisAt,
} from './world.js';

export const BOSS_DEFS = {
  warden: {
    id: 'warden',
    name: 'SCRAP WARDEN',
    title: 'Warden of the Ember Reach',
    hp: 6,
    radius: 46,
    speed: 34,
    color: '#f97316',
    coreColor: '#fbbf24',
    plateColor: '#7c2d12',
    mineInterval: 6,
    chargeInterval: 9,
    shockInterval: 0,
    score: 500,
    phases: 1,
  },
  reaper: {
    id: 'reaper',
    name: 'VOID REAPER',
    title: 'Herald of the Veil',
    hp: 10,
    radius: 54,
    speed: 52,
    color: '#a78bfa',
    coreColor: '#e879f9',
    plateColor: '#3b0764',
    mineInterval: 5,
    chargeInterval: 7,
    shockInterval: 6,
    score: 900,
    phases: 2,
  },
};

export function bossForWave(wave) {
  if (wave === 3) return 'warden';
  if (wave === 5) return 'reaper';
  return null;
}

export function spawnBoss(world, id) {
  const def = BOSS_DEFS[id];
  const rng = world.rng;
  let x = GAME_WIDTH / 2;
  let y = 130;
  for (let tries = 0; tries < 30; tries += 1) {
    const candidate = { x: rng.range(180, GAME_WIDTH - 180), y: rng.range(110, 260) };
    const fromShip = Math.hypot(candidate.x - world.ship.x, candidate.y - world.ship.y);
    const fromStation = Math.hypot(candidate.x - STATION_X, candidate.y - STATION_Y);
    if (fromShip > 320 && fromStation > 240) {
      x = candidate.x;
      y = candidate.y;
      break;
    }
  }
  const boss = {
    id,
    def,
    name: def.name,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: rng.angle(),
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    phase: 1,
    wobble: 0,
    mineTimer: def.mineInterval,
    chargeTimer: def.chargeInterval,
    chargeState: 'idle',
    chargeTime: 0,
    chargeAngle: 0,
    shockTimer: def.shockInterval || 0,
  };
  world.bosses.push(boss);
  addParticles(world, x, y, { count: 40, color: def.color, speed: 220, life: 0.8, size: 3 });
  return boss;
}

function dropBossMine(world, boss) {
  // The field never holds more than ten mines: the boss stops sowing when
  // the field is already saturated, so a long fight stays fair.
  if (world.mines.length >= 10) return;
  const heading = world.rng.angle();
  const speed = world.rng.range(14, 30);
  world.mines.push({
    x: boss.x + Math.cos(heading) * (boss.radius + 16),
    y: boss.y + Math.sin(heading) * (boss.radius + 16),
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    radius: 14,
    blink: world.rng.range(0, Math.PI * 2),
  });
}

function emitShockwave(world, boss) {
  world.shockwaves.push({
    x: boss.x,
    y: boss.y,
    radius: boss.radius + 6,
    speed: 300,
    maxRadius: 520,
    color: boss.def.color,
    pushed: new Set(),
  });
  addParticles(world, boss.x, boss.y, { count: 24, color: boss.def.coreColor, speed: 200, life: 0.5, size: 3 });
}

export function damageBoss(world, boss, amount, events) {
  if (!world.bosses.includes(boss)) return;
  boss.hp -= amount;
  addParticles(world, boss.x, boss.y, { count: 16, color: boss.def.coreColor, speed: 190, life: 0.5, size: 3 });
  if (boss.hp > 0) {
    events.push({ type: 'boss_hit', boss });
    return;
  }
  const index = world.bosses.indexOf(boss);
  if (index !== -1) world.bosses.splice(index, 1);
  world.bossesDown += 1;
  const points = boss.def.score * world.difficulty.scoreMult;
  world.score += points;
  addParticles(world, boss.x, boss.y, { count: 60, color: boss.def.color, speed: 320, life: 0.9, size: 4 });
  addParticles(world, boss.x, boss.y, { count: 36, color: '#fbbf24', speed: 200, life: 0.7, size: 3 });
  addFloater(world, boss.x, boss.y - boss.radius - 10, `${boss.name} DOWN +${points}`, boss.def.coreColor);
  for (let i = 0; i < 3; i += 1) {
    world.debris.push(makeDebrisAt(world, 'core', boss.x, boss.y, 1));
  }
  world.shake = Math.min(1, world.shake + 0.7);
  world.flash = Math.min(1, world.flash + 0.4);
  events.push({ type: 'boss_down', boss, points });
}

// A boss hit by debris takes damage only from a hard slam; a gentle bump
// just bounces the debris off its armour.
export function bossDebrisImpact(world, boss, debris, closingSpeed, events) {
  if (closingSpeed < 200) return false;
  damageBoss(world, boss, 1, events);
  return true;
}

export function updateBosses(world, dt, events) {
  const ship = world.ship;
  for (const boss of world.bosses.slice()) {
    const def = boss.def;
    boss.wobble += dt;
    if (def.phases === 2 && boss.phase === 1 && boss.hp <= boss.maxHp / 2) {
      boss.phase = 2;
      addFloater(world, boss.x, boss.y - boss.radius - 10, `${boss.name} ENRAGED`, '#f87171');
      emitShockwave(world, boss);
      events.push({ type: 'boss_phase', boss });
    }
    const phaseMult = boss.phase === 2 ? 1.5 : 1;
    if (boss.chargeState === 'telegraph') {
      boss.chargeTime -= dt;
      boss.vx *= Math.exp(-3 * dt);
      boss.vy *= Math.exp(-3 * dt);
      if (boss.chargeTime <= 0) {
        boss.chargeState = 'charging';
        boss.chargeTime = 0.7;
        boss.vx = Math.cos(boss.chargeAngle) * 280;
        boss.vy = Math.sin(boss.chargeAngle) * 280;
      }
    } else if (boss.chargeState === 'charging') {
      boss.chargeTime -= dt;
      if (boss.chargeTime <= 0) {
        boss.chargeState = 'idle';
        boss.chargeTimer = def.chargeInterval / phaseMult;
      }
    } else {
      boss.chargeTimer -= dt;
      if (boss.chargeTimer <= 0) {
        boss.chargeState = 'telegraph';
        boss.chargeTime = 0.8;
        boss.chargeAngle = Math.atan2(ship.y - boss.y, ship.x - boss.x);
        events.push({ type: 'boss_telegraph', boss });
      }
      const orbitAngle = boss.wobble * 0.22 + (boss.id === 'reaper' ? Math.PI : 0);
      const anchorX = STATION_X + Math.cos(orbitAngle) * 300;
      const anchorY = STATION_Y + Math.sin(orbitAngle) * 210;
      const dx = anchorX - boss.x;
      const dy = anchorY - boss.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = def.speed * phaseMult;
      boss.vx += ((dx / dist) * speed - boss.vx) * Math.min(1, dt * 1.4);
      boss.vy += ((dy / dist) * speed - boss.vy) * Math.min(1, dt * 1.4);
    }
    boss.mineTimer -= dt;
    if (boss.mineTimer <= 0) {
      boss.mineTimer = def.mineInterval / phaseMult;
      dropBossMine(world, boss);
    }
    if (def.shockInterval > 0) {
      boss.shockTimer -= dt;
      if (boss.shockTimer <= 0) {
        boss.shockTimer = def.shockInterval / phaseMult;
        emitShockwave(world, boss);
      }
    }
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    if (boss.x < boss.radius) { boss.x = boss.radius; boss.vx = Math.abs(boss.vx) * 0.6; }
    else if (boss.x > GAME_WIDTH - boss.radius) { boss.x = GAME_WIDTH - boss.radius; boss.vx = -Math.abs(boss.vx) * 0.6; }
    if (boss.y < boss.radius) { boss.y = boss.radius; boss.vy = Math.abs(boss.vy) * 0.6; }
    else if (boss.y > GAME_HEIGHT - boss.radius) { boss.y = GAME_HEIGHT - boss.radius; boss.vy = -Math.abs(boss.vy) * 0.6; }
    boss.angle += dt * 0.35;
  }
}

export function updateShockwaves(world, dt) {
  const ship = world.ship;
  for (const ring of world.shockwaves.slice()) {
    ring.radius += ring.speed * dt;
    const bodies = [ship, ...world.debris, ...world.mines, ...world.fuelCells];
    for (const body of bodies) {
      if (ring.pushed.has(body)) continue;
      const dist = Math.hypot(body.x - ring.x, body.y - ring.y);
      if (Math.abs(dist - ring.radius) < 16 && dist > 1) {
        const nx = (body.x - ring.x) / dist;
        const ny = (body.y - ring.y) / dist;
        body.vx += nx * 210;
        body.vy += ny * 210;
        ring.pushed.add(body);
      }
    }
    if (ring.radius >= ring.maxRadius) {
      const index = world.shockwaves.indexOf(ring);
      if (index !== -1) world.shockwaves.splice(index, 1);
    }
  }
}

export function bossHealthFrac(boss) {
  return Math.max(0, boss.hp / boss.maxHp);
}
