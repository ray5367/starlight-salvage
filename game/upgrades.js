// The ship-systems upgrade pool: thirteen upgrades, each one a real change
// to the ship or the run, offered three at a time between waves. Upgrades
// stack when rolled again, and every one of them is named on the upgrade
// screen's bay strip, so the depth of the build is visible at a glance.

export const UPGRADE_POOL = [
  { id: 'hull', name: 'REINFORCED HULL', desc: '+25 max hull, and repair 25', icon: 'shield' },
  { id: 'thrust', name: 'ION THRUSTERS', desc: '+20% thrust power', icon: 'flame' },
  { id: 'tether', name: 'LONG TETHER', desc: '+30% tether range', icon: 'link' },
  { id: 'magnet', name: 'MAGNET ARRAY', desc: '+45 magnet radius', icon: 'magnet' },
  { id: 'fuel', name: 'FUEL TANK', desc: '+25 max fuel, and refill 25', icon: 'cell' },
  { id: 'aegis', name: 'AEGIS SHIELD', desc: 'Shield blocks 2 hits, recharges each wave', icon: 'aegis' },
  { id: 'drone', name: 'SALVAGE DRONE', desc: 'A drone ferries scrap to the ring for you', icon: 'drone' },
  { id: 'overcharge', name: 'OVERCHARGE COILS', desc: 'Banked debris scores +50%', icon: 'coil' },
  { id: 'stabilizer', name: 'STASIS CLAMP', desc: '+2 seconds of volatile hold time', icon: 'clamp' },
  { id: 'plating', name: 'ABLATIVE PLATING', desc: 'Mine damage reduced by 40%', icon: 'plate' },
  { id: 'scoop', name: 'FUEL SCOOP', desc: 'Banking debris refuels +6 fuel', icon: 'scoop' },
  { id: 'relay', name: 'COMBO RELAY', desc: '+3 seconds of combo window', icon: 'relay' },
  { id: 'nanites', name: 'REPAIR NANITES', desc: 'Hull slowly regenerates', icon: 'nano' },
];

export function upgradeById(id) {
  return UPGRADE_POOL.find((upgrade) => upgrade.id === id) ?? null;
}

export function rollUpgrades(rng) {
  return rng.shuffle(UPGRADE_POOL).slice(0, 3);
}

// Counts of each upgrade the run has installed, for the bay strip.
export function ownedUpgradeCounts(world) {
  const counts = new Map();
  for (const id of world.upgradesTaken) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
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
  } else if (upgrade.id === 'aegis') {
    ship.maxShield += 2;
    ship.shield = ship.maxShield;
  } else if (upgrade.id === 'drone') {
    if (!world.drone) {
      world.drone = {
        x: ship.x + 40,
        y: ship.y - 30,
        vx: 0,
        vy: 0,
        carrying: null,
        state: 'seek',
        angle: 0,
      };
    }
  } else if (upgrade.id === 'overcharge') {
    ship.scoreMult *= 1.5;
  } else if (upgrade.id === 'stabilizer') {
    ship.volatileHold += 2;
  } else if (upgrade.id === 'plating') {
    ship.mineResist = Math.min(0.8, ship.mineResist + 0.4);
  } else if (upgrade.id === 'scoop') {
    ship.fuelOnBank += 6;
  } else if (upgrade.id === 'relay') {
    ship.comboWindow += 3;
  } else if (upgrade.id === 'nanites') {
    ship.regen += 1.2;
  }
  world.upgradesTaken.push(upgrade.id);
  return upgrade;
}
