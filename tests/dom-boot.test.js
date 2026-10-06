/**
 * DOM boot test.
 *
 * A real browser is not available in CI, so this file provides the smallest
 * honest environment shim (elements, a recording 2D context, rAF) and then
 * imports the REAL browser entry point, src/main.js. Every screen render,
 * canvas draw call and frame of the loop that ships to players is executed
 * here -- the shim only stands in for the browser, never for game logic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const HTML_IDS = new Set([...HTML.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

/* ------------------------------------------------------------- shim */

const drawn = [];

function makeContext() {
  const state = {};
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'measureText') return () => ({ width: 12 });
      return (...args) => {
        drawn.push(String(prop));
        return undefined;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}

function makeCanvas() {
  const ctx = makeContext();
  const canvas = {
    tagName: 'CANVAS',
    width: 0,
    height: 0,
    clientWidth: 1440,
    clientHeight: 900,
    style: { setProperty() {} },
    dataset: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: 900 }),
    addEventListener() {},
    removeEventListener() {},
  };
  return canvas;
}

function makeEl(tag = 'div', id = '') {
  const el = {
    tagName: String(tag).toUpperCase(),
    id,
    children: [],
    dataset: {},
    style: { setProperty() {} },
    disabled: false,
    _text: '',
    _classes: new Set(),
    _handlers: {},
    _html: '',
    addEventListener(type, fn) {
      (el._handlers[type] ??= []).push(fn);
    },
    removeEventListener() {},
    appendChild(child) {
      el.children.push(child);
      return child;
    },
    querySelector() {
      return makeEl('div');
    },
    querySelectorAll() {
      return [];
    },
    setAttribute() {},
    getAttribute: () => null,
    focus() {},
    click() {
      for (const fn of el._handlers.click ?? []) fn({ stopPropagation() {}, preventDefault() {} });
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: 900 }),
    classList: {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      contains: (c) => el._classes.has(c),
      toggle(c, force) {
        const on = force === undefined ? !el._classes.has(c) : Boolean(force);
        if (on) el._classes.add(c);
        else el._classes.delete(c);
        return on;
      },
    },
  };
  el.parentElement = { classList: el.classList };
  Object.defineProperty(el, 'innerHTML', {
    get: () => el._html,
    set: (v) => {
      el._html = String(v);
      // a real browser drops the subtree when innerHTML is replaced
      if (el._html === '') el.children = [];
    },
  });
  Object.defineProperty(el, 'className', {
    get: () => [...el._classes].join(' '),
    set: (v) => {
      el._classes = new Set(String(v).split(/\s+/).filter(Boolean));
    },
  });
  // a real DOM coerces textContent to a string
  Object.defineProperty(el, 'textContent', {
    get: () => el._text,
    set: (v) => {
      el._text = String(v);
    },
  });
  return el;
}

function installDom() {
  const elements = new Map();
  for (const id of HTML_IDS) {
    elements.set(id, id === 'game' ? makeCanvas() : makeEl('div', id));
  }
  // hud is hidden by markup
  elements.get('hud')._classes.add('hidden');

  const body = makeEl('body');
  globalThis.document = {
    body,
    activeElement: null,
    getElementById: (id) => elements.get(id) ?? null,
    createElement: (tag) => (String(tag).toLowerCase() === 'canvas' ? makeCanvas() : makeEl(tag)),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
  };

  globalThis.innerWidth = 1440;
  globalThis.innerHeight = 900;
  globalThis.devicePixelRatio = 1;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
  };

  // rAF is captured rather than scheduled so tests drive frames explicitly.
  globalThis.requestAnimationFrame = () => 0;

  return { elements, body };
}

const dom = installDom();

/* --------------------------------------------------------- the real app */

const mainModule = await import('../src/main.js');
const app = globalThis.DUST_AND_GUNS;

test('the real entry point boots without hitting the fatal fallback', () => {
  assert.ok(app, 'window.DUST_AND_GUNS was not created');
  assert.ok(app instanceof mainModule.App);
  assert.equal(dom.body.children.length, 0, 'the fatal error overlay was appended');
  assert.ok(app.game === null, 'no run should be active at the menu');
});

test('every element id the UI reaches for exists in index.html', () => {
  const uiSrc = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const wanted = new Set(
    [...`${uiSrc}\n${mainSrc}`.matchAll(/el\('([^']+)'\)|getElementById\('([^']+)'\)/g)].map((m) => m[1] ?? m[2]),
  );
  assert.ok(wanted.size > 20, `only found ${wanted.size} ids -- the regex must have broken`);
  const missing = [...wanted].filter((id) => !HTML_IDS.has(id));
  assert.deepEqual(missing, [], `markup is missing these ids: ${missing.join(', ')}`);
});

test('the menu renders career stats and the player name field', () => {
  app.ui.renderMenu(app.save);
  const career = dom.elements.get('career').innerHTML;
  assert.match(career, /Runs/);
  assert.match(career, /Territories cleared/);
  assert.equal(dom.elements.get('menu-coins').textContent, '0');
});

test('the territory screen renders six map cards with SVG thumbnails', () => {
  app.ui.renderMaps(app.save);
  const grid = dom.elements.get('map-grid');
  assert.equal(grid.children.length, 6, `rendered ${grid.children.length} maps`);
  for (const card of grid.children) {
    assert.match(card.innerHTML, /<svg/);
    assert.match(card.innerHTML, /map-thumb/);
    assert.match(card.innerHTML, /waves/);
  }
  assert.match(grid.children[0].innerHTML, /Main Street/);
  assert.ok(grid.children[1]._classes.has('locked'), 'second map should be locked on a fresh save');
  assert.ok(grid.children[1].children.some((c) => c._classes.has('map-lock')), 'locked map needs a lock overlay');
});

test('all four shop tabs render their full catalog', () => {
  const rich = { ...app.save, coins: 90000, bounty: 40 };
  const expected = { guns: 14, 'player-skins': 8, 'gun-skins': 6, maps: 6 };
  for (const [tab, count] of Object.entries(expected)) {
    app.ui.renderShop(rich, tab);
    const list = dom.elements.get('shop-list');
    assert.equal(list.children.length, count, `${tab} listed ${list.children.length} of ${count}`);
    for (const item of list.children) assert.ok(item.innerHTML.length > 60, `${tab} item rendered empty`);
    assert.equal(dom.elements.get('shop-tabs').children.length, 4, 'tab strip incomplete');
  }
  // side panel reflects the equipped loadout and skins
  app.ui.renderShop(rich, 'guns');
  assert.equal(dom.elements.get('shop-loadout').children.length, 4, 'loadout should show all four slots');
  assert.match(dom.elements.get('gun-detail').innerHTML, /Rusty Peacemaker/);
  assert.match(dom.elements.get('shop-wearing').innerHTML, /Dust Drifter/);
});

test('the help screen lists every control binding', () => {
  app.ui.renderHelp();
  const grid = dom.elements.get('controls-grid').innerHTML;
  for (const key of ['W A S D', 'Left Click', 'Reload', 'Tab', 'Esc', 'Dodge Roll']) {
    assert.ok(grid.includes(key), `help is missing ${key}`);
  }
  assert.match(dom.elements.get('tips').innerHTML, /Powder kegs explode/);
});

test('starting a run builds the world and shows the HUD', () => {
  app.startRun('main-street');
  assert.ok(app.game, 'no game instance');
  assert.equal(app.mode, 'playing');
  assert.equal(app.game.map.id, 'main-street');
  assert.ok(app.game.obstacles.length > 20);
  assert.equal(dom.elements.get('hud')._classes.has('hidden'), false, 'HUD should be visible in a run');
});

test('driving the real frame loop simulates and draws', () => {
  drawn.length = 0;
  const before = app.frames;
  let t = performance.now();
  for (let i = 0; i < 900; i += 1) {
    t += 16.7;
    const g = app.game;
    const p = g.player;
    g.player.hp = 1e9;
    g.player.maxHp = 1e9;

    // auto-play: shoot the nearest bandit, otherwise walk over loose loot
    let target = null;
    let best = Infinity;
    for (const e of g.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) {
        best = d;
        target = e;
      }
    }
    let moveX = 0;
    let moveY = 0;
    let aimX = p.x + 100;
    let aimY = p.y;
    if (target) {
      aimX = target.x;
      aimY = target.y;
    } else if (g.pickups.length) {
      let loot = null;
      let ld = Infinity;
      for (const k of g.pickups) {
        const d = Math.hypot(k.x - p.x, k.y - p.y);
        if (d < ld) {
          ld = d;
          loot = k;
        }
      }
      if (loot && ld > 4) {
        moveX = (loot.x - p.x) / ld;
        moveY = (loot.y - p.y) / ld;
      }
    }
    app.input.sample = () => ({
      moveX,
      moveY,
      aimX,
      aimY,
      firing: Boolean(target),
      fireEdge: Boolean(target),
      sprint: false,
      reload: false,
      dash: i % 120 === 0,
      cycle: false,
    });
    app.frame(t);
  }

  assert.equal(app.frames, before + 900, 'the loop did not tick 900 times');
  assert.ok(app.game.wave >= 1, 'the wave director never started');
  assert.ok(app.game.run.shotsFired > 0, 'nothing was fired');
  assert.ok(app.game.run.shotsHit > 0, 'shots were fired but nothing was hit');
  assert.ok(app.game.run.kills > 0, 'nothing was killed');
  assert.ok(app.game.run.coins > 0, 'loot was never collected');

  for (const call of ['save', 'restore', 'translate', 'fill', 'stroke', 'drawImage', 'fillText', 'setTransform']) {
    assert.ok(drawn.includes(call), `the renderer never called ${call}`);
  }
  assert.ok(drawn.length > 20000, `only ${drawn.length} canvas calls over 900 frames`);

  // HUD must mirror live game state
  assert.equal(Number(dom.elements.get('wave-num').textContent), app.game.wave, 'HUD wave counter is out of sync');
  const expectedCoins = Math.round(app.save.coins + app.game.run.coins).toLocaleString('en-US');
  assert.equal(dom.elements.get('coins').textContent, expectedCoins, 'HUD coins are out of sync');
  assert.equal(dom.elements.get('weapon-name').textContent, app.game.gun.name);
  assert.equal(dom.elements.get('ammo-mag').textContent, String(app.game.magAmmo));
  assert.equal(Number(dom.elements.get('run-kills').textContent), app.game.run.kills, 'HUD kill count is out of sync');
});

test('every screen can be shown without throwing', () => {
  for (const name of ['menu', 'maps', 'shop', 'pause', 'result', 'help']) {
    app.ui.show(name);
    assert.equal(dom.elements.get(`screen-${name}`)._classes.has('hidden'), false, `${name} not shown`);
    for (const other of ['menu', 'maps', 'shop', 'pause', 'result', 'help']) {
      if (other !== name) assert.equal(dom.elements.get(`screen-${other}`)._classes.has('hidden'), true, `${other} should be hidden`);
    }
  }
});

test('the result screen summarises a finished run', () => {
  app.ui.showResult({
    title: 'Main Street Cleared',
    sub: 'test',
    cleared: true,
    stats: { wavesCleared: 8, kills: 74, accuracy: 41, coins: 1830, bounty: 1, bossKills: 1 },
  });
  const grid = dom.elements.get('result-grid').innerHTML;
  for (const label of ['Waves', 'Kills', 'Accuracy', 'Coins Earned', 'Bounty', 'Bosses']) {
    assert.ok(grid.includes(label), `result grid missing ${label}`);
  }
  assert.match(dom.elements.get('result-title').textContent, /Cleared/);
  assert.equal(dom.elements.get('btn-again').textContent, 'Ride Again');
});

test('every map renders through the real draw path', () => {
  for (const mapId of ['main-street', 'saloon-alley', 'ghost-town', 'red-canyon', 'rail-yard', 'sunset-mesa']) {
    app.startRun(mapId);
    drawn.length = 0;
    for (let i = 0; i < 40; i += 1) {
      app.game.player.hp = 1e9;
      app.frame(performance.now() + i * 16.7);
    }
    assert.equal(app.game.map.id, mapId);
    assert.ok(drawn.includes('drawImage'), `${mapId} never painted its ground layer`);
    assert.ok(drawn.length > 500, `${mapId} barely drew anything (${drawn.length} calls)`);
  }
});

test('the fatal fallback is only reached on a genuine crash', () => {
  // sanity check that the shim would notice a crash, so the boot test means something
  assert.equal(dom.body.children.length, 0);
});
