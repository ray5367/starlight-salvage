// All drawing: the parallax backdrop, the station and recycler ring, every
// entity, particles, the HUD and the title, upgrade, victory, game-over and
// pause screens. Button rectangles are exported so the input handling in
// main.js hit-tests exactly what is drawn here.

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  STATION_X,
  STATION_Y,
  RING_RADIUS,
  DOCK_RADIUS,
  COMBO_CAP,
  DEBRIS_TYPES,
  DIFFICULTIES,
  MAX_WAVES,
} from './world.js';
import { SECTORS } from './biomes.js';
import { UPGRADE_POOL, ownedUpgradeCounts } from './upgrades.js';
import { bossHealthFrac } from './bosses.js';
import { makeRng } from './rng.js';

const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";

export const TITLE_START_BUTTON = { x: 490, y: 524, w: 300, h: 62 };
export const END_BUTTON = { x: 490, y: 552, w: 300, h: 60 };
export const PAUSE_RESUME_BUTTON = { x: 490, y: 414, w: 300, h: 54 };
export const PAUSE_RESTART_BUTTON = { x: 490, y: 480, w: 300, h: 54 };

export function difficultyButtonRects() {
  const width = 280;
  const gap = 30;
  const total = width * 3 + gap * 2;
  const startX = (GAME_WIDTH - total) / 2;
  return [0, 1, 2].map((i) => ({ x: startX + i * (width + gap), y: 448, w: width, h: 64 }));
}

export function upgradeCardRects() {
  const width = 280;
  const gap = 30;
  const total = width * 3 + gap * 2;
  const startX = (GAME_WIDTH - total) / 2;
  return [0, 1, 2].map((i) => ({ x: startX + i * (width + gap), y: 268, w: width, h: 232 }));
}

function font(weight, size) {
  return `${weight} ${size}px ${FONT}`;
}

function roundRectPath(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function inside(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

export function createBackdrop(seed, sector = SECTORS[0]) {
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
  const layers = [
    { factor: 0.08, stars: [] },
    { factor: 0.16, stars: [] },
    { factor: 0.3, stars: [] },
  ];
  const counts = [110, 70, 40];
  layers.forEach((layer, index) => {
    for (let i = 0; i < counts[index]; i += 1) {
      layer.stars.push({
        x: rng.range(0, GAME_WIDTH),
        y: rng.range(0, GAME_HEIGHT),
        radius: rng.range(0.6, 1.1 + index * 0.7),
        phase: rng.range(0, Math.PI * 2),
        speed: rng.range(0.6, 2.2),
        warm: rng.chance(sector.starWarm),
      });
    }
  });
  const nebula = document.createElement('canvas');
  nebula.width = GAME_WIDTH;
  nebula.height = GAME_HEIGHT;
  const nctx = nebula.getContext('2d');
  for (const blob of sector.blobs) {
    const gradient = nctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
    gradient.addColorStop(0, blob.color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    nctx.fillStyle = gradient;
    nctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  return { layers, nebula, sky: sector.sky };
}

function drawBackdrop(ctx, world, backdrop, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, backdrop.sky[0]);
  gradient.addColorStop(0.55, backdrop.sky[1]);
  gradient.addColorStop(1, backdrop.sky[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.drawImage(backdrop.nebula, 0, 0);
  const offsetX = world.ship.x - GAME_WIDTH / 2;
  const offsetY = world.ship.y - GAME_HEIGHT / 2;
  for (const layer of backdrop.layers) {
    for (const star of layer.stars) {
      const x = (((star.x - offsetX * layer.factor) % GAME_WIDTH) + GAME_WIDTH) % GAME_WIDTH;
      const y = (((star.y - offsetY * layer.factor) % GAME_HEIGHT) + GAME_HEIGHT) % GAME_HEIGHT;
      const alpha = 0.45 + 0.4 * Math.sin(time * star.speed + star.phase);
      ctx.fillStyle = star.warm ? `rgba(254, 215, 170, ${alpha})` : `rgba(224, 242, 254, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawStation(ctx, time) {
  const glow = ctx.createRadialGradient(STATION_X, STATION_Y, 10, STATION_X, STATION_Y, 190);
  glow.addColorStop(0, 'rgba(34, 211, 238, 0.22)');
  glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(STATION_X, STATION_Y, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(STATION_X, STATION_Y);
  ctx.rotate(time * 0.25);
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.75)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i += 1) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(58, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(66, 0, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#164e63';
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(STATION_X, STATION_Y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a5f3fc';
  ctx.beginPath();
  ctx.arc(STATION_X, STATION_Y, 9, 0, Math.PI * 2);
  ctx.fill();
  const blink = 0.5 + 0.5 * Math.sin(time * 2.4);
  ctx.fillStyle = `rgba(251, 191, 36, ${0.4 + 0.6 * blink})`;
  ctx.beginPath();
  ctx.arc(STATION_X - 18, STATION_Y - 18, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(STATION_X + 18, STATION_Y + 16, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawRing(ctx, world, time) {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 10]);
  ctx.beginPath();
  ctx.arc(STATION_X, STATION_Y, DOCK_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const target = world.tether.target;
  const banking = target && Math.hypot(target.x - STATION_X, target.y - STATION_Y) < RING_RADIUS;
  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.strokeStyle = banking ? `rgba(74, 222, 128, ${0.7 + 0.3 * pulse})` : `rgba(34, 211, 238, ${0.45 + 0.3 * pulse})`;
  ctx.lineWidth = banking ? 5 : 3;
  ctx.setLineDash([20, 13]);
  ctx.lineDashOffset = -time * 26;
  ctx.beginPath();
  ctx.arc(STATION_X, STATION_Y, RING_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(STATION_X, STATION_Y, RING_RADIUS - 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = banking ? '#4ade80' : 'rgba(165, 243, 252, 0.8)';
  ctx.font = font(700, 14);
  ctx.textAlign = 'center';
  ctx.fillText(banking ? 'RELEASE TO BANK' : 'RECYCLER', STATION_X, STATION_Y - RING_RADIUS - 12);
}

function drawDebris(ctx, debris, time) {
  const type = DEBRIS_TYPES[debris.type];
  ctx.save();
  ctx.translate(debris.x, debris.y);
  ctx.rotate(debris.angle);
  ctx.beginPath();
  debris.shape.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.fill();
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (debris.type === 'volatile') {
    const pulse = 0.7 + 0.3 * Math.sin(time * 6);
    ctx.fillStyle = `rgba(245, 158, 11, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5 + pulse * 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (debris.type === 'core') {
    ctx.rotate(-debris.angle + time * 1.4);
    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(125, 211, 252, 0.5)';
    ctx.beginPath();
    ctx.arc(-3, 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMines(ctx, mines, time) {
  for (const mine of mines) {
    ctx.save();
    ctx.translate(mine.x, mine.y);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + time * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
      ctx.lineTo(Math.cos(angle) * 17, Math.sin(angle) * 17);
      ctx.stroke();
    }
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.stroke();
    const blink = Math.sin(mine.blink) > 0.2;
    ctx.fillStyle = blink ? '#f87171' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFuelCells(ctx, cells, time) {
  for (const cell of cells) {
    ctx.save();
    ctx.translate(cell.x, cell.y);
    ctx.rotate(Math.sin(time * 1.5 + cell.pulse) * 0.25);
    const glow = 0.5 + 0.5 * Math.sin(cell.pulse);
    ctx.fillStyle = `rgba(74, 222, 128, ${0.14 + 0.1 * glow})`;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14532d';
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    roundRectPath(ctx, -11, -7, 20, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(9, -3.5, 4, 7);
    ctx.fillRect(-7, -3.5, 3.5, 7);
    ctx.fillRect(-2, -3.5, 3.5, 7);
    ctx.restore();
  }
}

function drawBosses(ctx, bosses, time) {
  for (const boss of bosses) {
    const def = boss.def;
    const enraged = boss.phase === 2;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const glow = ctx.createRadialGradient(0, 0, boss.radius * 0.4, 0, 0, boss.radius * 2.1);
    glow.addColorStop(0, enraged ? 'rgba(248, 113, 113, 0.28)' : `${def.color}44`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 2.1, 0, Math.PI * 2);
    ctx.fill();
    if (boss.chargeState === 'telegraph') {
      const blink = Math.sin(time * 18) > 0;
      ctx.save();
      ctx.rotate(boss.chargeAngle);
      ctx.fillStyle = blink ? 'rgba(248, 113, 113, 0.2)' : 'rgba(248, 113, 113, 0.08)';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(420, -46);
      ctx.lineTo(420, 46);
      ctx.lineTo(0, 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.rotate(boss.angle);
    ctx.fillStyle = def.plateColor;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      ctx.save();
      ctx.rotate((i / 6) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(boss.radius * 0.52, -13);
      ctx.lineTo(boss.radius + 6, -9);
      ctx.lineTo(boss.radius + 6, 9);
      ctx.lineTo(boss.radius * 0.52, 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const pulse = 0.7 + 0.3 * Math.sin(time * (enraged ? 8 : 4) + boss.wobble);
    ctx.fillStyle = def.coreColor;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = font(700, 15);
    ctx.fillStyle = enraged ? '#f87171' : def.coreColor;
    ctx.fillText(enraged ? `${boss.name} — ENRAGED` : boss.name, boss.x, boss.y - boss.radius - 16);
    ctx.restore();
  }
}

function drawBossBar(ctx, bosses) {
  const boss = bosses[0];
  if (!boss) return;
  const width = 360;
  const x = GAME_WIDTH / 2 - width / 2;
  const y = 70;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = font(700, 13);
  ctx.fillStyle = boss.def.coreColor;
  ctx.fillText(`${boss.name}  ·  ${boss.hp} / ${boss.maxHp} HULL`, GAME_WIDTH / 2, y - 6);
  drawBar(ctx, x, y, width, 10, bossHealthFrac(boss), boss.def.color, 'rgba(148, 163, 184, 0.25)');
  ctx.restore();
}

function drawShockwaves(ctx, shockwaves) {
  for (const ring of shockwaves) {
    const alpha = Math.max(0, 1 - ring.radius / ring.maxRadius);
    ctx.save();
    ctx.strokeStyle = ring.color;
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.35;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDrone(ctx, drone, time) {
  if (!drone) return;
  ctx.save();
  ctx.translate(drone.x, drone.y);
  ctx.rotate(drone.angle);
  ctx.fillStyle = 'rgba(103, 232, 249, 0.2)';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#155e75';
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-8, 7);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const blink = 0.5 + 0.5 * Math.sin(time * 6);
  ctx.fillStyle = `rgba(165, 243, 252, ${0.5 + 0.5 * blink})`;
  ctx.beginPath();
  ctx.arc(2, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (drone.carrying) {
    ctx.save();
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(drone.x, drone.y);
    ctx.lineTo(drone.carrying.x, drone.carrying.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawShip(ctx, ship, time) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  if (ship.thrusting) {
    const flicker = 13 + Math.sin(time * 42) * 5 + Math.cos(time * 31) * 3;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-13, 5);
    ctx.lineTo(-13 - flicker, 0);
    ctx.lineTo(-13, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(103, 232, 249, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-13, 3);
    ctx.lineTo(-13 - flicker * 0.55, 0);
    ctx.lineTo(-13, -3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#0e7490';
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(21, 0);
  ctx.lineTo(-13, 11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-13, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a5f3fc';
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (ship.shield > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + time * 0.8;
      const px = ship.x + Math.cos(angle) * (ship.radius + 9);
      const py = ship.y + Math.sin(angle) * (ship.radius + 9);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  if (ship.invuln > 0 && Math.sin(time * 30) > -0.2) {
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTether(ctx, world, time) {
  const ship = world.ship;
  const target = world.tether.target;
  if (!target) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.strokeStyle = '#a5f3fc';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -time * 70;
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ecfeff';
  ctx.beginPath();
  ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
  ctx.fill();
  if (target.type === 'volatile') {
    const frac = Math.min(1, world.tether.heldTime / world.ship.volatileHold);
    ctx.strokeStyle = frac > 0.66 ? '#f87171' : '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius + 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTargetHint(ctx, world, input) {
  const ship = world.ship;
  if (world.tether.target || !input.tetherHeld()) return;
  let best = null;
  let bestDist = ship.tetherRange;
  for (const debris of world.debris) {
    const dist = Math.hypot(debris.x - ship.x, debris.y - ship.y);
    if (dist <= bestDist) {
      best = debris;
      bestDist = dist;
    }
  }
  if (!best) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y);
  ctx.lineTo(best.x, best.y);
  ctx.stroke();
  ctx.restore();
}

function drawParticles(ctx, particles) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFloaters(ctx, floaters) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = font(700, 18);
  for (const floater of floaters) {
    ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRectPath(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fill();
  }
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function drawHud(ctx, world, ui) {
  const ship = world.ship;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e0f2fe';
  ctx.font = font(700, 27);
  ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 24, 38);
  ctx.font = font(600, 16);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText(`WAVE ${world.wave} / ${MAX_WAVES}  ·  ${world.sector.name}  ·  ${world.difficulty.name}`, 24, 62);
  if (ui.bestScore > 0) {
    ctx.font = font(400, 13);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
    ctx.fillText(`BEST ${ui.bestScore.toLocaleString('en-US')}`, 24, 82);
  }
  if (world.combo >= 2) {
    const multiplier = Math.min(world.combo, COMBO_CAP);
    ctx.font = font(700, 20);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`COMBO x${multiplier}`, 24, 110);
    drawBar(ctx, 24, 116, 110, 7, world.comboTimer / ship.comboWindow, '#fbbf24', 'rgba(148, 163, 184, 0.25)');
  }
  ctx.textAlign = 'center';
  ctx.font = font(600, 14);
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(`MASS BANKED  ${world.bankedMass} / ${world.quota}`, GAME_WIDTH / 2, 26);
  drawBar(ctx, GAME_WIDTH / 2 - 150, 34, 300, 12, world.bankedMass / world.quota, '#22d3ee', 'rgba(148, 163, 184, 0.25)');
  drawBossBar(ctx, world.bosses);
  ctx.textAlign = 'right';
  ctx.font = font(600, 16);
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(formatTime(world.runTime), GAME_WIDTH - 24, 30);
  ctx.font = font(400, 13);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
  ctx.fillText(ui.muted ? 'M: SOUND OFF' : 'M: SOUND ON', GAME_WIDTH - 24, 50);
  const hullFrac = ship.hull / ship.maxHull;
  const hullColor = hullFrac > 0.5 ? '#4ade80' : hullFrac > 0.25 ? '#fbbf24' : '#f87171';
  ctx.textAlign = 'left';
  ctx.font = font(700, 13);
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(`HULL ${Math.ceil(ship.hull)}`, 24, GAME_HEIGHT - 56);
  drawBar(ctx, 24, GAME_HEIGHT - 50, 240, 13, hullFrac, hullColor, 'rgba(148, 163, 184, 0.25)');
  if (ship.maxShield > 0) {
    ctx.fillStyle = '#67e8f9';
    ctx.font = font(700, 13);
    ctx.fillText(`SHIELD ${'◆'.repeat(ship.shield)}${'◇'.repeat(Math.max(0, ship.maxShield - ship.shield))}`, 280, GAME_HEIGHT - 56);
  }
  ctx.fillText(`FUEL ${Math.ceil(ship.fuel)}`, 24, GAME_HEIGHT - 26);
  drawBar(ctx, 24, GAME_HEIGHT - 20, 240, 13, ship.fuel / ship.maxFuel, '#fbbf24', 'rgba(148, 163, 184, 0.25)');
  if (ship.docking) {
    ctx.fillStyle = '#4ade80';
    ctx.font = font(700, 13);
    ctx.fillText('DOCKED: REFUELING', 280, GAME_HEIGHT - 26);
  } else if (ship.fuel <= 0) {
    ctx.fillStyle = '#f87171';
    ctx.font = font(700, 13);
    ctx.fillText('OUT OF FUEL: EMERGENCY THRUST 25% — DOCK AT THE RING TO REFUEL', 280, GAME_HEIGHT - 26);
  }
  ctx.textAlign = 'right';
  ctx.font = font(400, 13);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
  ctx.fillText('WASD / arrows thrust · Mouse aims · Hold Space / mouse: tether', GAME_WIDTH - 24, GAME_HEIGHT - 44);
  ctx.fillText('P pause · M mute · R restart', GAME_WIDTH - 24, GAME_HEIGHT - 24);
  const target = world.tether.target;
  if (target) {
    ctx.textAlign = 'center';
    if (target.type === 'volatile') {
      const left = Math.max(0, ship.volatileHold - world.tether.heldTime);
      ctx.font = font(700, 17);
      ctx.fillStyle = left < 1 ? '#f87171' : '#fbbf24';
      ctx.fillText(`VOLATILE TETHERED: ${left.toFixed(1)}s TO DETONATION`, GAME_WIDTH / 2, 98);
    } else {
      ctx.font = font(600, 15);
      ctx.fillStyle = '#a5f3fc';
      ctx.fillText(`TETHERED: ${DEBRIS_TYPES[target.type].label} — DRAG IT INTO THE RING`, GAME_WIDTH / 2, 98);
    }
  }
  if (world.flare.phase === 'warn') {
    const blink = 0.55 + 0.45 * Math.sin(ui.time * 10);
    ctx.textAlign = 'center';
    ctx.font = font(700, 20);
    ctx.fillStyle = `rgba(251, 191, 36, ${blink})`;
    ctx.fillText('!! SOLAR FLARE INCOMING !!', GAME_WIDTH / 2, 132);
  } else if (world.flare.phase === 'active') {
    ctx.textAlign = 'center';
    ctx.font = font(700, 20);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('SOLAR FLARE — DEBRIS SURGE', GAME_WIDTH / 2, 132);
  }
  ctx.restore();
}

function drawBanner(ctx, world) {
  const banner = world.banner;
  if (!banner) return;
  const fadeIn = Math.min(1, (banner.ttl - banner.time) / 0.25);
  const fadeOut = Math.min(1, banner.time / 0.5);
  const alpha = Math.min(fadeIn, fadeOut);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(34, 211, 238, 0.8)';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ecfeff';
  ctx.font = font(700, 54);
  // The banner rides the top third, never the centre: the ring, the ship
  // and the field stay readable while the wave announces itself.
  ctx.fillText(banner.text, GAME_WIDTH / 2, 178);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#7dd3fc';
  ctx.font = font(600, 20);
  ctx.fillText(banner.sub, GAME_WIDTH / 2, 214);
  ctx.restore();
}

function drawButton(ctx, rect, label, hovered, accent) {
  ctx.save();
  ctx.fillStyle = hovered ? 'rgba(34, 211, 238, 0.28)' : 'rgba(14, 116, 144, 0.45)';
  ctx.strokeStyle = hovered ? '#a5f3fc' : accent;
  ctx.lineWidth = hovered ? 3 : 2;
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ecfeff';
  ctx.font = font(700, 22);
  ctx.textAlign = 'center';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 8);
  ctx.restore();
}

function drawTitle(ctx, world, ui) {
  ctx.fillStyle = 'rgba(5, 5, 20, 0.52)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(34, 211, 238, 0.8)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#ecfeff';
  ctx.font = font(700, 74);
  ctx.fillText('STARLIGHT SALVAGE', GAME_WIDTH / 2, 168);
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7dd3fc';
  ctx.font = font(600, 21);
  ctx.fillText('Pilot a salvage tug through the wreck fields. Tether debris. Bank mass. Survive.', GAME_WIDTH / 2, 208);
  if (ui.bestScore > 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = font(700, 17);
    ctx.fillText(`BEST SCORE  ${ui.bestScore.toLocaleString('en-US')}`, GAME_WIDTH / 2, 232);
  } else {
    ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
    ctx.font = font(400, 15);
    ctx.fillText('No salvage banked yet — fly your first run.', GAME_WIDTH / 2, 232);
  }
  const lines = [
    'Tether debris with Space or the mouse, then drag it into the recycler ring and release to bank it.',
    'Bank the wave quota to advance — clear all 5 waves across 3 sectors to win the field.',
    'Volatile cores pay triple but detonate if held too long. Slam debris into bosses to break them.',
    'Mines and solar flares will ruin your hull. Dock at the station ring to refuel.',
  ];
  ctx.font = font(400, 17);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.92)';
  lines.forEach((line, i) => ctx.fillText(line, GAME_WIDTH / 2, 262 + i * 25));
  ctx.font = font(700, 14);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('THE CAMPAIGN  ·  3 SECTORS  ·  2 BOSSES  ·  13 SHIP SYSTEMS', GAME_WIDTH / 2, 378);
  const chipWidth = 293;
  const chipGap = 15;
  const chipTotal = chipWidth * 3 + chipGap * 2;
  const chipX = (GAME_WIDTH - chipTotal) / 2;
  const chipColors = { azure: '#22d3ee', ember: '#f97316', void: '#a78bfa' };
  const numerals = ['I', 'II', 'III'];
  SECTORS.forEach((sector, i) => {
    const rect = { x: chipX + i * (chipWidth + chipGap), y: 388, w: chipWidth, h: 32 };
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = chipColors[sector.id];
    ctx.lineWidth = 2;
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e0f2fe';
    ctx.font = font(700, 13);
    const bossLabel = sector.boss === 'warden' ? 'BOSS: SCRAP WARDEN' : sector.boss === 'reaper' ? 'BOSS: VOID REAPER' : 'NO BOSS';
    ctx.fillText(`${numerals[i]} · ${sector.name} · ${bossLabel}`, rect.x + rect.w / 2, rect.y + 21);
  });
  ctx.font = font(700, 14);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.7)';
  ctx.fillText('CHOOSE YOUR FIELD  ·  1 / 2 / 3', GAME_WIDTH / 2, 438);
  const difficultyRects = difficultyButtonRects();
  DIFFICULTIES.forEach((difficulty, i) => {
    const rect = difficultyRects[i];
    const selected = ui.selectedDifficulty === difficulty.id;
    const hovered = inside(ui.mouse, rect);
    ctx.fillStyle = selected ? 'rgba(34, 211, 238, 0.26)' : hovered ? 'rgba(34, 211, 238, 0.12)' : 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = selected ? '#a5f3fc' : 'rgba(103, 232, 249, 0.55)';
    ctx.lineWidth = selected ? 3 : 2;
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = selected ? '#ecfeff' : '#bae6fd';
    ctx.font = font(700, 18);
    ctx.fillText(difficulty.name, rect.x + rect.w / 2, rect.y + 27);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.7)';
    ctx.font = font(400, 13);
    ctx.fillText(difficulty.desc, rect.x + rect.w / 2, rect.y + 48);
  });
  drawButton(ctx, TITLE_START_BUTTON, 'START SALVAGING', inside(ui.mouse, TITLE_START_BUTTON), '#22d3ee');
  ctx.font = font(400, 15);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
  ctx.fillText('WASD / arrows thrust · Mouse aims · Hold Space or mouse to tether · P pause · M mute · R restart', GAME_WIDTH / 2, 616);
  ctx.fillText('Press Enter to start', GAME_WIDTH / 2, 644);
  ctx.restore();
}

function drawUpgradeIcon(ctx, icon, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#67e8f9';
  ctx.fillStyle = '#67e8f9';
  ctx.lineWidth = 2.5;
  if (icon === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(13, -9);
    ctx.lineTo(13, 5);
    ctx.quadraticCurveTo(13, 14, 0, 19);
    ctx.quadraticCurveTo(-13, 14, -13, 5);
    ctx.lineTo(-13, -9);
    ctx.closePath();
    ctx.stroke();
  } else if (icon === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.bezierCurveTo(12, -4, 13, 6, 6, 13);
    ctx.bezierCurveTo(2, 17, -4, 17, -7, 12);
    ctx.bezierCurveTo(-13, 5, -8, -6, 0, -18);
    ctx.closePath();
    ctx.stroke();
  } else if (icon === 'link') {
    ctx.beginPath();
    ctx.arc(-7, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
  } else if (icon === 'magnet') {
    ctx.beginPath();
    ctx.arc(0, -2, 12, Math.PI, 0, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(-12, 12);
    ctx.moveTo(12, -2);
    ctx.lineTo(12, 12);
    ctx.stroke();
    ctx.fillRect(-14, 10, 5, 6);
    ctx.fillRect(9, 10, 5, 6);
  } else if (icon === 'aegis') {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * 17;
      const py = Math.sin(angle) * 17;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
  } else if (icon === 'drone') {
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-9, 8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-9, -8);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (icon === 'coil') {
    ctx.beginPath();
    ctx.moveTo(4, -18);
    ctx.lineTo(-8, 2);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 18);
    ctx.lineTo(9, -3);
    ctx.lineTo(1, -3);
    ctx.closePath();
    ctx.stroke();
  } else if (icon === 'clamp') {
    ctx.beginPath();
    ctx.moveTo(-11, -16);
    ctx.lineTo(11, -16);
    ctx.lineTo(-11, 16);
    ctx.lineTo(11, 16);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-11, -16);
    ctx.lineTo(11, 16);
    ctx.moveTo(11, -16);
    ctx.lineTo(-11, 16);
    ctx.stroke();
  } else if (icon === 'plate') {
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-14, -10 + i * 10);
      ctx.lineTo(0, -16 + i * 10);
      ctx.lineTo(14, -10 + i * 10);
      ctx.stroke();
    }
  } else if (icon === 'scoop') {
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.lineTo(14, -14);
    ctx.lineTo(4, 6);
    ctx.lineTo(4, 16);
    ctx.lineTo(-4, 16);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.stroke();
  } else if (icon === 'relay') {
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(-6 + i * 6, 0, 5 + i * 4, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
  } else if (icon === 'nano') {
    ctx.fillRect(-3, -16, 6, 32);
    ctx.fillRect(-16, -3, 32, 6);
  } else {
    roundRectPath(ctx, -13, -9, 23, 18, 4);
    ctx.stroke();
    ctx.fillRect(10, -4, 4, 8);
    ctx.fillRect(-9, -4, 4, 8);
    ctx.fillRect(-3, -4, 4, 8);
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawUpgradeBay(ctx, world) {
  const owned = ownedUpgradeCounts(world);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = font(700, 14);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('UPGRADE BAY  ·  13 SHIP SYSTEMS  ·  ✓ INSTALLED THIS RUN', GAME_WIDTH / 2, 528);
  const chipW = 120;
  const chipH = 28;
  const gap = 10;
  const perRow = 7;
  const rows = [UPGRADE_POOL.slice(0, perRow), UPGRADE_POOL.slice(perRow)];
  rows.forEach((row, rowIndex) => {
    const total = row.length * chipW + (row.length - 1) * gap;
    const startX = (GAME_WIDTH - total) / 2;
    const y = 538 + rowIndex * (chipH + 6);
    row.forEach((upgrade, i) => {
      const count = owned.get(upgrade.id) ?? 0;
      const x = startX + i * (chipW + gap);
      ctx.fillStyle = count > 0 ? 'rgba(34, 211, 238, 0.18)' : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = count > 0 ? '#67e8f9' : 'rgba(100, 116, 139, 0.6)';
      ctx.lineWidth = count > 0 ? 2 : 1.5;
      roundRectPath(ctx, x, y, chipW, chipH, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = count > 0 ? '#ecfeff' : 'rgba(224, 242, 254, 0.55)';
      ctx.font = font(700, 11);
      const label = count > 1 ? `✓x${count} ${upgrade.name}` : count === 1 ? `✓ ${upgrade.name}` : upgrade.name;
      ctx.fillText(label, x + chipW / 2, y + 18);
    });
  });
  ctx.restore();
}

function drawUpgradeScreen(ctx, world, ui) {
  ctx.fillStyle = 'rgba(5, 5, 20, 0.68)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ecfeff';
  ctx.font = font(700, 46);
  ctx.fillText(`WAVE ${world.wave} CLEARED`, GAME_WIDTH / 2, 150);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = font(600, 20);
  ctx.fillText('CHOOSE AN UPGRADE', GAME_WIDTH / 2, 188);
  const rects = upgradeCardRects();
  ui.choices.forEach((upgrade, i) => {
    const rect = rects[i];
    const hovered = inside(ui.mouse, rect);
    ctx.fillStyle = hovered ? 'rgba(34, 211, 238, 0.16)' : 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = hovered ? '#a5f3fc' : 'rgba(103, 232, 249, 0.55)';
    ctx.lineWidth = hovered ? 3 : 2;
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fill();
    ctx.stroke();
    drawUpgradeIcon(ctx, upgrade.icon, rect.x + rect.w / 2, rect.y + 52);
    ctx.fillStyle = '#ecfeff';
    ctx.font = font(700, 19);
    ctx.fillText(upgrade.name, rect.x + rect.w / 2, rect.y + 112);
    ctx.font = font(400, 15);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
    const descLines = wrapText(ctx, upgrade.desc, rect.w - 44);
    descLines.forEach((line, j) => ctx.fillText(line, rect.x + rect.w / 2, rect.y + 142 + j * 22));
    ctx.font = font(700, 16);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`[ ${i + 1} ]`, rect.x + rect.w / 2, rect.y + rect.h - 20);
  });
  ctx.font = font(400, 15);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
  ctx.fillText('Click a card or press 1, 2 or 3', GAME_WIDTH / 2, 632);
  ctx.restore();
  drawUpgradeBay(ctx, world);
}

function drawEndScreen(ctx, world, ui, victory) {
  ctx.fillStyle = victory ? 'rgba(5, 20, 28, 0.72)' : 'rgba(28, 5, 8, 0.72)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = victory ? 'rgba(34, 211, 238, 0.8)' : 'rgba(248, 113, 113, 0.8)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = victory ? '#a5f3fc' : '#fca5a5';
  ctx.font = font(700, 62);
  ctx.fillText(victory ? 'FIELD CLEARED!' : 'SHIP LOST', GAME_WIDTH / 2, 190);
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(224, 242, 254, 0.9)';
  ctx.font = font(600, 21);
  ctx.fillText(victory ? 'Every wave banked. The wreck field is yours.' : 'The tug broke apart in the wreck field.', GAME_WIDTH / 2, 234);
  const stats = [
    ['FINAL SCORE', world.score.toLocaleString('en-US')],
    ['BEST SCORE', ui.bestScore.toLocaleString('en-US')],
    ['TIME', formatTime(world.runTime)],
    ['DEBRIS BANKED', String(world.bankedCount)],
    ['BEST COMBO', world.bestCombo >= 2 ? `x${Math.min(world.bestCombo, COMBO_CAP)}` : '—'],
    ['BOSSES DOWN', `${world.bossesDown} / 2`],
    ['SHIP SYSTEMS', `${world.upgradesTaken.length} INSTALLED`],
    victory ? ['SECTORS CLEARED', '3 / 3'] : ['WAVE REACHED', `${world.wave} / ${MAX_WAVES}`],
  ];
  ctx.font = font(400, 18);
  stats.forEach(([label, value], i) => {
    const y = 272 + i * 29;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(label, GAME_WIDTH / 2 - 24, y);
    ctx.fillStyle = '#ecfeff';
    ctx.font = font(700, 18);
    ctx.textAlign = 'left';
    ctx.fillText(value, GAME_WIDTH / 2 + 24, y);
    ctx.font = font(400, 18);
  });
  if (ui.newBest) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = font(700, 22);
    ctx.textAlign = 'center';
    ctx.fillText('★ NEW BEST SCORE ★', GAME_WIDTH / 2, 522);
  }
  drawButton(ctx, END_BUTTON, victory ? 'SALVAGE AGAIN' : 'TRY AGAIN', inside(ui.mouse, END_BUTTON), victory ? '#22d3ee' : '#f87171');
  ctx.font = font(400, 15);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('Press R to restart', GAME_WIDTH / 2, 648);
  ctx.restore();
}

function drawPauseOverlay(ctx, ui) {
  ctx.fillStyle = 'rgba(5, 5, 20, 0.6)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ecfeff';
  ctx.font = font(700, 52);
  ctx.fillText('PAUSED', GAME_WIDTH / 2, 340);
  ctx.font = font(400, 18);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.8)';
  ctx.fillText('P or Esc to resume · R to restart', GAME_WIDTH / 2, 384);
  ctx.restore();
  drawButton(ctx, PAUSE_RESUME_BUTTON, 'RESUME', inside(ui.mouse, PAUSE_RESUME_BUTTON), '#22d3ee');
  drawButton(ctx, PAUSE_RESTART_BUTTON, 'RESTART RUN', inside(ui.mouse, PAUSE_RESTART_BUTTON), '#fbbf24');
}

export function render(ctx, world, ui) {
  ctx.save();
  const shakeX = Math.sin(ui.time * 127.3) * world.shake * 9;
  const shakeY = Math.cos(ui.time * 131.7) * world.shake * 9;
  ctx.translate(shakeX, shakeY);
  drawBackdrop(ctx, world, ui.backdrop, ui.time);
  drawRing(ctx, world, ui.time);
  drawStation(ctx, ui.time);
  drawFuelCells(ctx, world.fuelCells, ui.time);
  for (const debris of world.debris) drawDebris(ctx, debris, ui.time);
  drawMines(ctx, world.mines, ui.time);
  drawBosses(ctx, world.bosses, ui.time);
  drawShockwaves(ctx, world.shockwaves);
  if (ui.screen === 'playing' && !ui.paused) drawTargetHint(ctx, world, ui.input);
  if (ui.screen === 'playing') {
    drawTether(ctx, world, ui.time);
    drawShip(ctx, world.ship, ui.time);
    drawDrone(ctx, world.drone, ui.time);
  }
  drawParticles(ctx, world.particles);
  drawFloaters(ctx, world.floaters);
  ctx.restore();
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(251, 191, 36, ${world.flash * 0.22})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  if (ui.screen === 'playing') drawHud(ctx, world, ui);
  if (ui.screen === 'playing' && !ui.paused) drawBanner(ctx, world);
  if (ui.screen === 'title') drawTitle(ctx, world, ui);
  else if (ui.screen === 'upgrade') drawUpgradeScreen(ctx, world, ui);
  else if (ui.screen === 'victory') drawEndScreen(ctx, world, ui, true);
  else if (ui.screen === 'gameover') drawEndScreen(ctx, world, ui, false);
  if (ui.screen === 'playing' && ui.paused) drawPauseOverlay(ctx, ui);
}
