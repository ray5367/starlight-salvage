// Boot, the frame loop and the screen state machine: title, playing,
// upgrade, victory and game over. Screenshot hooks (?seed=N and
// ?shot=start|play|upgrade|victory) run through these same transitions, so a
// staged screenshot is a real render of a real game state.

import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { MusicSequencer } from './music.js';
import { loadBestScore, recordRun } from './storage.js';
import {
  createWorld,
  startWave,
  seedAmbientField,
  rollUpgrades,
  applyUpgrade,
  DIFFICULTIES,
  COMBO_WINDOW,
  STATION_X,
  STATION_Y,
  RING_RADIUS,
  MAX_WAVES,
} from './world.js';
import { stepWorld, stepAmbient } from './physics.js';
import {
  createBackdrop,
  render,
  TITLE_START_BUTTON,
  END_BUTTON,
  PAUSE_RESUME_BUTTON,
  PAUSE_RESTART_BUTTON,
  difficultyButtonRects,
  upgradeCardRects,
} from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);

function parseSeed(raw) {
  if (raw === null) return (Math.random() * 2 ** 31) | 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed >>> 0;
}

const seed = parseSeed(params.get('seed'));
const shot = params.get('shot');

const input = new Input(canvas);
input.attach();
const audio = new AudioEngine();
const music = new MusicSequencer(seed);
music.attach(audio);

let world = createWorld(seed);
let backdrop = createBackdrop(seed);
let screen = 'title';
let paused = false;
let choices = [];
let runNumber = 0;
let selectedDifficulty = 'salvager';
let bestScore = loadBestScore();
let newBest = false;
let displayBestOverride = null;
let runRecorded = false;
// Screenshot staging (?shot=...) renders real states but must never write a
// staged score into the player's saved best.
const staging = shot !== null;

seedAmbientField(world);

function startRun() {
  const runSeed = (seed + runNumber * 7919) >>> 0;
  runNumber += 1;
  world = createWorld(runSeed, selectedDifficulty);
  backdrop = createBackdrop(runSeed);
  startWave(world, 1);
  screen = 'playing';
  paused = false;
  choices = [];
  newBest = false;
  runRecorded = false;
  input.clearMomentary();
}

function finishRun(won) {
  if (runRecorded) return;
  runRecorded = true;
  if (staging) return;
  newBest = recordRun(world.score, won);
  bestScore = loadBestScore();
}

function completeWave() {
  if (world.wave >= MAX_WAVES) {
    finishRun(true);
    screen = 'victory';
  } else {
    choices = rollUpgrades(world.rng);
    screen = 'upgrade';
  }
  input.clearMomentary();
}

function pickUpgrade(index) {
  const upgrade = choices[index];
  if (!upgrade) return;
  applyUpgrade(world, upgrade);
  audio.arpeggio();
  startWave(world, world.wave + 1);
  screen = 'playing';
  paused = false;
  input.clearMomentary();
}

function handleEvents(events) {
  let waveCleared = false;
  let destroyed = false;
  for (const event of events) {
    if (event.type === 'bank') audio.chimeCombo(event.combo ?? 1);
    else if (event.type === 'explode' || event.type === 'mine_hit') audio.explosion();
    else if (event.type === 'hull_hit') audio.thud();
    else if (event.type === 'fuel') audio.fuelPickup();
    else if (event.type === 'tether_attach') audio.zap();
    else if (event.type === 'flare_warn') audio.warning();
    else if (event.type === 'wave_clear') waveCleared = true;
    else if (event.type === 'game_over') destroyed = true;
  }
  if (destroyed) {
    finishRun(false);
    screen = 'gameover';
    audio.explosion();
    input.clearMomentary();
  } else if (waveCleared) {
    audio.arpeggio();
    completeWave();
  }
}

function handleKeys() {
  if (input.wasPressed('KeyM')) audio.toggleMute();
  if (input.wasPressed('KeyR') && screen !== 'title') startRun();
  if ((input.wasPressed('KeyP') || input.wasPressed('Escape')) && screen === 'playing') {
    paused = !paused;
    audio.click();
  }
  if (input.wasPressed('Enter') && (screen === 'title' || screen === 'victory' || screen === 'gameover')) {
    audio.click();
    startRun();
  }
  if (screen === 'title') {
    const pick = ['Digit1', 'Digit2', 'Digit3'].findIndex((code) => input.wasPressed(code));
    if (pick !== -1) {
      selectedDifficulty = DIFFICULTIES[pick].id;
      audio.click();
    }
  }
  if (screen === 'upgrade') {
    if (input.wasPressed('Digit1')) pickUpgrade(0);
    else if (input.wasPressed('Digit2')) pickUpgrade(1);
    else if (input.wasPressed('Digit3')) pickUpgrade(2);
  }
}

function inside(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function handleClicks() {
  let click = input.consumeClick();
  while (click) {
    if (screen === 'playing' && paused) {
      if (inside(click, PAUSE_RESUME_BUTTON)) {
        paused = false;
        audio.click();
        input.clearMomentary();
        return;
      }
      if (inside(click, PAUSE_RESTART_BUTTON)) {
        audio.click();
        startRun();
        return;
      }
    } else if (screen === 'title') {
      const pick = difficultyButtonRects().findIndex((rect) => inside(click, rect));
      if (pick !== -1) {
        selectedDifficulty = DIFFICULTIES[pick].id;
        audio.click();
      } else if (inside(click, TITLE_START_BUTTON)) {
        audio.click();
        startRun();
      }
    } else if (screen === 'upgrade') {
      const index = upgradeCardRects().findIndex((rect) => inside(click, rect));
      if (index !== -1) pickUpgrade(index);
    } else if ((screen === 'victory' || screen === 'gameover') && inside(click, END_BUTTON)) {
      audio.click();
      startRun();
    }
    click = input.consumeClick();
  }
}

function stagePlayShot() {
  world.score = 240;
  world.bankedMass = 2;
  world.runTime = 47;
  displayBestOverride = 1870;
  world.combo = 3;
  world.comboTimer = COMBO_WINDOW - 1.8;
  world.bestCombo = 3;
  world.banner = { text: 'WAVE 1', sub: 'BANK 6 MASS  ·  SALVAGER', time: 1.9, ttl: 2.6 };
  world.ship.hull = 82;
  world.ship.fuel = 64;
  world.ship.x = 430;
  world.ship.y = 480;
  world.ship.vx = 0;
  world.ship.vy = 0;
  const scrap = world.debris.find((debris) => debris.type === 'scrap');
  if (scrap) {
    scrap.x = 520;
    scrap.y = 420;
    scrap.vx = 0;
    scrap.vy = 0;
    world.tether.target = scrap;
    world.tether.heldTime = 0.4;
  }
  const core = world.debris.find((debris) => debris.type === 'core');
  if (core) {
    core.x = 830;
    core.y = 250;
    core.vx = 10;
    core.vy = 8;
  }
  const volatile = world.debris.find((debris) => debris.type === 'volatile');
  if (volatile) {
    volatile.x = 950;
    volatile.y = 520;
    volatile.vx = -12;
    volatile.vy = -6;
  }
}

function applyShotPreset(shotName) {
  if (shotName === 'start') {
    // The title as a returning player sees it: a saved best on display.
    displayBestOverride = 1870;
  } else if (shotName === 'play') {
    startRun();
    stagePlayShot();
  } else if (shotName === 'upgrade') {
    startRun();
    world.bankedMass = world.quota;
    completeWave();
  } else if (shotName === 'victory') {
    startRun();
    world.wave = MAX_WAVES;
    world.score = 1870;
    world.bankedCount = 63;
    world.bestCombo = 4;
    world.runTime = 312;
    world.bankedMass = world.quota;
    displayBestOverride = 1870;
    newBest = true;
    completeWave();
  }
}

applyShotPreset(shot);
if (shot === 'play') input.overrideHeld = true;

let lastNow = performance.now();

function frame(now) {
  const dt = Math.min((now - lastNow) / 1000, 0.033);
  lastNow = now;
  if (input.anyGesture && audio.ensure()) music.start();
  handleKeys();
  if (screen === 'playing' && !paused) {
    handleEvents(stepWorld(world, input, dt));
  } else if (screen === 'title') {
    stepAmbient(world, dt);
  }
  handleClicks();
  render(ctx, world, {
    screen,
    paused,
    choices,
    mouse: input.mouse,
    input,
    time: now / 1000,
    muted: audio.muted,
    backdrop,
    bestScore: displayBestOverride ?? bestScore,
    newBest,
    selectedDifficulty,
  });
  window.__shotReady = true;
  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Read-only hooks for automated play-testing: the game's own state, exposed
// so a browser script can steer the ship and confirm banking works, plus one
// test-only hook, setHull, that lets a scripted run reach the game-over
// screen through the real damage path instead of waiting for random mines.
window.__salvage = {
  state() {
    return {
      screen,
      paused,
      score: world.score,
      hull: Math.round(world.ship.hull),
      fuel: Math.round(world.ship.fuel),
      wave: world.wave,
      bankedMass: world.bankedMass,
      quota: world.quota,
      combo: world.combo,
      bestCombo: world.bestCombo,
      difficulty: world.difficulty.id,
      selectedDifficulty,
      bestScore: displayBestOverride ?? bestScore,
      newBest,
      tethered: world.tether.target !== null,
      debris: world.debris.length,
      runTime: Math.round(world.runTime),
      audio: audio.ctx ? audio.ctx.state : 'none',
      music: music.playing,
      muted: audio.muted,
    };
  },
  setHull(value) {
    world.ship.hull = value;
    world.ship.invuln = 0;
  },
  bot() {
    const ship = world.ship;
    let nearest = null;
    let nearestDist = Infinity;
    for (const debris of world.debris) {
      if (debris.type === 'volatile') continue;
      const dist = Math.hypot(debris.x - ship.x, debris.y - ship.y);
      if (dist < nearestDist) {
        nearest = debris;
        nearestDist = dist;
      }
    }
    if (!nearest && world.debris.length > 0) {
      nearest = world.debris[0];
      nearestDist = Math.hypot(nearest.x - ship.x, nearest.y - ship.y);
    }
    const target = world.tether.target;
    let nearestMine = null;
    let nearestMineDist = Infinity;
    for (const mine of world.mines) {
      const dist = Math.hypot(mine.x - ship.x, mine.y - ship.y);
      if (dist < nearestMineDist) {
        nearestMine = mine;
        nearestMineDist = dist;
      }
    }
    let nearestCell = null;
    let nearestCellDist = Infinity;
    for (const cell of world.fuelCells) {
      const dist = Math.hypot(cell.x - ship.x, cell.y - ship.y);
      if (dist < nearestCellDist) {
        nearestCell = cell;
        nearestCellDist = dist;
      }
    }
    return {
      screen,
      score: world.score,
      ship: { x: ship.x, y: ship.y },
      tethered: target !== null,
      target: target ? { x: target.x, y: target.y } : null,
      nearest: nearest ? { x: nearest.x, y: nearest.y } : null,
      nearestDist,
      nearestMine: nearestMine ? { x: nearestMine.x, y: nearestMine.y } : null,
      nearestCell: nearestCell ? { x: nearestCell.x, y: nearestCell.y } : null,
      tetherRange: ship.tetherRange,
      ring: { x: STATION_X, y: STATION_Y, r: RING_RADIUS },
    };
  },
};
