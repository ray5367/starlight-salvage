# starlight-salvage

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ray5367/starlight-salvage/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ray5367/starlight-salvage/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Starlight Salvage is an original 2D canvas arcade game: pilot a salvage tug through wreck fields, tether debris with a spring tether, drag it into the recycler ring, and bank the mass quota to clear all 5 waves. Mines, solar flares, volatile cores that detonate if held too long, fuel management, and a choice of 3 upgrades between waves. No libraries, no assets, no network requests — procedural canvas art and synthesized WebAudio sound.

## Run it

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080 in a desktop browser
```

## How to play

- **Goal:** bank the mass quota shown at the top to clear each wave. Clear wave 5 to win the field.
- **Tether:** hold Space or the mouse button near debris to attach the tether, drag it into the glowing recycler ring, release to bank mass and score. Scrap 10, data cores 50, volatile cores 30 — volatiles detonate if held over 3 seconds or slammed too hard.
- **Hazards:** mines damage the hull on contact. Solar flares surge every drifting object.
- **Fuel:** thrust burns fuel. Collect green fuel cells, or drift near the station ring to dock and refuel.
- **Upgrades:** clearing a wave offers 3 upgrades (hull, thrust, tether range, magnet radius, fuel tank). Pick with the mouse or keys 1, 2, 3.

## Controls

WASD / arrows thrust · mouse aims · hold Space or mouse to tether · Enter start/restart · P or Esc pause · M mute · R restart · 1/2/3 pick an upgrade.

`?seed=N` replays the same field; `?shot=start|play|upgrade|victory` jumps to a screen.

## License

MIT. See `LICENSE`.

---

Entered on [make.fun](https://make.fun/?ref=88g3yzab&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards
