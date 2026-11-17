// Saved progress: the best score and the run count, kept in localStorage
// under one versioned key. Every read is guarded, so a browser with storage
// disabled or a corrupt value plays exactly the same game with no saved best.

const STORAGE_KEY = 'starlight-salvage:save:v1';

function readSave() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bestScore: 0, runs: 0, wins: 0 };
    const parsed = JSON.parse(raw);
    return {
      bestScore: Number.isFinite(parsed.bestScore) ? Math.max(0, Math.floor(parsed.bestScore)) : 0,
      runs: Number.isFinite(parsed.runs) ? Math.max(0, Math.floor(parsed.runs)) : 0,
      wins: Number.isFinite(parsed.wins) ? Math.max(0, Math.floor(parsed.wins)) : 0,
    };
  } catch {
    return { bestScore: 0, runs: 0, wins: 0 };
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function loadBestScore() {
  return readSave().bestScore;
}

export function loadSaveSummary() {
  return readSave();
}

// Records one finished run. Returns true when the score sets a new best.
export function recordRun(score, won) {
  const save = readSave();
  const isNewBest = score > save.bestScore;
  if (isNewBest) save.bestScore = Math.floor(score);
  save.runs += 1;
  if (won) save.wins += 1;
  writeSave(save);
  return isNewBest;
}
