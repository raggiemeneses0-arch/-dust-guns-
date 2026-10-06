# 🤠 Dust & Guns

A western top-down browser shooter. You play a lone cowboy, hold six territories
against waves of bandits, bank the coin you take off them, and spend it on guns,
outfits and gun finishes.

**No build step, no dependencies, no assets.** Plain HTML, CSS and JavaScript
modules. Every sound is synthesised with WebAudio and every sprite is drawn
procedurally on a 2D canvas, so the repo is a handful of text files that load
instantly.

---

## Play it

Open `index.html` in a browser, or serve it (needed because ES modules are
fetched over HTTP):

```bash
npm start            # serves on http://0.0.0.0:8080
# or
PORT=3000 npm start
```

Progress saves itself to `localStorage` in that browser.

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Aim | Mouse |
| Fire | Left click |
| Reload | `R` |
| Sprint | `Shift` |
| Dodge roll (brief i-frames) | `Space` / right click |
| Swap weapon | `Q` |
| Weapon slot | `1` – `4` |
| Shop | `Tab` / `B` |
| Pause | `Esc` |

## What's in the game

### 🔫 Guns — 14 of them
Revolvers, derringers, shotguns, lever-action rifles, a scoped sharpshooter, a
Buffalo rifle that punches through five bodies, a hand-crank Gatling and a
Dynamite Launcher with real splash damage. Every gun carries its own damage,
fire rate, magazine, reload time, spread cone, recoil heat curve, pierce count,
blast radius, crit chance and range falloff — all of it defined as data in
`src/data/guns.js`.

### 💰 Currency — two kinds
- **Coins** — drop from every bandit, spent on guns, outfits, finishes and
  territory deeds. You keep what you earn even if you die.
- **Bounty stars** — rare, paid only by bosses and by clearing a territory.
  They buy the legendary gear.

### 🎨 Skins — 14 cosmetics
Eight outfits for the cowboy (Dust Drifter → Golden Marshal) and six finishes
for whatever you're holding (Blued Steel → Gold Inlaid). Colours are applied at
draw time, so any outfit works with any gun.

### 🗺️ Selectable maps — 6 territories
Main Street, Saloon Alley, Ghost Town, Red Canyon, Rail Yard and Sunset Mesa.
Each has its own palette, layout, enemy roster, difficulty and payout
multiplier. Territories unlock by clearing the previous one — or by buying the
deed with coin. Sunset Mesa ends with The Bandit King.

### Everything else
Wave director with five enemy archetypes (Bandit, Gunslinger, Shotgun Thug,
Ridge Sniper, Dynamite Brute) plus a boss; exploding powder kegs and
destructible cover; dodge rolls with i-frames; coin magnetism; ammo crates and
health flasks; sniper laser telegraphs; minimap and off-screen threat markers;
screen shake; synthesised gunshots; and a run summary with accuracy.

## Layout

```
index.html            markup for every screen and the HUD
styles.css            western theme
src/
  main.js             boot, mode machine, requestAnimationFrame loop
  config.js           all tuning constants in one place
  core/
    save.js           save file: defaults, hardening, storage injection
    store.js          the shop: buy / sell / equip (pure functions)
    economy.js        currency maths and rewards
    rng.js            seeded PRNG (mulberry32)
    utils.js          math + geometry helpers
  data/
    guns.js           the arsenal
    skins.js          outfits and gun finishes
    maps.js           territories, layouts, palettes, spawn logic
    enemies.js        archetypes and wave planning
  game/
    game.js           the simulation (no DOM references)
    render.js         procedural canvas rendering
    ballistics.js     spread, pellets, falloff, line of sight
    input.js          keyboard + mouse
    audio.js          WebAudio synthesis
  ui/
    ui.js             DOM screens, shop, HUD
tests/                89 tests, node:test, zero dependencies
tools/serve.js        tiny static server
```

The split matters: `src/game/game.js` and everything below it never touches the
DOM, so the simulation runs headless. The tests drive the real classes rather
than copies of them.

## Tests

```bash
npm test
```

89 tests, no dependencies:

- **Data integrity** — unique ids, valid stats, rising difficulty, deterministic
  wave plans, boss only on the final wave.
- **Shop and economy** — purchases refuse when broke, legendary gear costs
  bounty, the loadout caps at four, selling never leaves you unarmed, saves
  survive garbage input.
- **Simulation** — full waves fought to completion, map clears, death, reload
  cycles, explosions, destructible cover, pickup collection, and a check that
  nothing escapes the arena or goes `NaN`.
- **DOM boot** (`tests/dom-boot.test.js`) — imports the real `src/main.js`
  against a minimal environment shim and drives 900 real frames: every screen
  renders, the renderer issues tens of thousands of canvas calls, and the HUD
  stays in sync with the simulation.

## Known limits

- A real browser isn't available in CI, so `tests/dom-boot.test.js` uses a DOM
  shim instead of headless Chrome. It runs the shipped browser code, but it
  can't catch anything a browser's real layout or audio pipeline would.
- Single player only, and the save is local to the browser.
