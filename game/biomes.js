// The three sectors of the campaign: each one is a biome with its own sky,
// nebula palette, star warmth and hazard pressure, and each one names the
// boss that guards its far edge. Waves map onto sectors, so the field the
// player flies visibly changes as the run deepens: Azure Drift opens the
// run, Ember Reach turns the field volatile, and the Void Veil is where the
// Reaper hunts.

export const SECTORS = [
  {
    id: 'azure',
    name: 'AZURE DRIFT',
    waves: [1, 2],
    tagline: 'Cold lanes, drifting scrap',
    boss: null,
    sky: ['#0a0a24', '#0d0b33', '#070718'],
    blobs: [
      { x: 260, y: 180, r: 340, color: 'rgba(76, 29, 149, 0.55)' },
      { x: 1020, y: 140, r: 300, color: 'rgba(8, 145, 178, 0.4)' },
      { x: 1080, y: 580, r: 360, color: 'rgba(162, 28, 175, 0.38)' },
      { x: 220, y: 600, r: 300, color: 'rgba(14, 116, 144, 0.42)' },
      { x: 660, y: 360, r: 420, color: 'rgba(30, 27, 75, 0.6)' },
    ],
    starWarm: 0.25,
    volatileBonus: 0,
    mineBonus: 0,
    driftMult: 1.0,
    ambient: null,
  },
  {
    id: 'ember',
    name: 'EMBER REACH',
    waves: [3, 4],
    tagline: 'Volatile-rich · the Warden patrols',
    boss: 'warden',
    sky: ['#1d0a10', '#2b0e14', '#120507'],
    blobs: [
      { x: 240, y: 170, r: 350, color: 'rgba(154, 28, 12, 0.55)' },
      { x: 1040, y: 150, r: 310, color: 'rgba(194, 94, 8, 0.42)' },
      { x: 1060, y: 570, r: 360, color: 'rgba(120, 20, 60, 0.4)' },
      { x: 210, y: 590, r: 300, color: 'rgba(160, 60, 8, 0.42)' },
      { x: 660, y: 360, r: 430, color: 'rgba(50, 16, 10, 0.6)' },
    ],
    starWarm: 0.6,
    volatileBonus: 0.08,
    mineBonus: 1,
    driftMult: 1.1,
    ambient: 'ember',
  },
  {
    id: 'void',
    name: 'VOID VEIL',
    waves: [5],
    tagline: 'Dense mines · the Reaper hunts',
    boss: 'reaper',
    sky: ['#070618', '#130b2e', '#04030e'],
    blobs: [
      { x: 250, y: 180, r: 340, color: 'rgba(76, 29, 149, 0.6)' },
      { x: 1030, y: 150, r: 300, color: 'rgba(13, 110, 110, 0.45)' },
      { x: 1070, y: 580, r: 360, color: 'rgba(88, 28, 135, 0.45)' },
      { x: 220, y: 600, r: 300, color: 'rgba(30, 60, 120, 0.45)' },
      { x: 660, y: 360, r: 430, color: 'rgba(15, 10, 40, 0.65)' },
    ],
    starWarm: 0.15,
    volatileBonus: 0.05,
    mineBonus: 2,
    driftMult: 1.2,
    ambient: 'mote',
  },
];

export function sectorForWave(wave) {
  return SECTORS.find((sector) => sector.waves.includes(wave)) ?? SECTORS[0];
}

export function sectorIndexForWave(wave) {
  const index = SECTORS.findIndex((sector) => sector.waves.includes(wave));
  return index === -1 ? 0 : index;
}
