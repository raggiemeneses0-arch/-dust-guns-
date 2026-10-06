/**
 * Boot + main loop. Glues the save file, the simulation, the renderer and
 * the DOM together, and runs the requestAnimationFrame loop.
 */

import { Game, PHASE } from './game/game.js';
import { Renderer } from './game/render.js';
import { Input } from './game/input.js';
import { AudioKit } from './game/audio.js';
import { UI } from './ui/ui.js';
import { createDefaultSave, loadSave, persistSave } from './core/save.js';
import { FIRST_MAP_ID } from './data/maps.js';
import { buyGun, buyGunSkin, buyMap, buyPlayerSkin, equipGun, equipGunSkin, equipPlayerSkin, sellGun } from './core/store.js';
import { summariseRun } from './core/economy.js';

const MODE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', SHOP: 'shop', RESULT: 'result' };

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.audio = new AudioKit();
    const loaded = loadSave();
    this.save = loaded.save;
    this.game = null;
    this.mode = MODE.MENU;
    this.pendingMap = FIRST_MAP_ID;
    this.lastTime = 0;
    this.frames = 0;

    this.ui = new UI({
      getSave: () => this.save,
      play: (mapId) => this.startRun(mapId ?? this.pendingMap),
      buyGun: (id) => this.purchase((s) => buyGun(s, id)),
      sellGun: (id) => this.purchase((s) => sellGun(s, id)),
      equipGun: (id) => this.purchase((s) => equipGun(s, id), true),
      buyPlayerSkin: (id) => this.purchase((s) => buyPlayerSkin(s, id)),
      equipPlayerSkin: (id) => this.purchase((s) => equipPlayerSkin(s, id), true),
      buyGunSkin: (id) => this.purchase((s) => buyGunSkin(s, id)),
      equipGunSkin: (id) => this.purchase((s) => equipGunSkin(s, id), true),
      buyMap: (id) => this.purchase((s) => buyMap(s, id)),
      rename: (name) => {
        this.save = { ...this.save, name: name.trim() || 'Stranger' };
        this.persist();
      },
      wipe: () => this.wipe(),
      resume: () => this.setMode(MODE.PLAYING),
      quit: () => this.abandon(),
      again: () => this.startRun(this.game ? this.game.map.id : this.pendingMap),
      toMenu: () => this.toMenu(),
      closeShop: () => this.closeShop(),
      onScreenChange: (name) => {
        if (name === 'maps') this.ui.renderMaps(this.save);
        if (name === 'menu') this.ui.renderMenu(this.save);
      },
    });

    this.input = new Input(this.canvas, (action, arg) => this.onAction(action, arg));

    this.renderer = new Renderer(this.canvas);
    this.resize();
    globalThis.addEventListener('resize', () => this.resize());

    // audio needs a user gesture in every modern browser
    const unlock = () => {
      this.audio.unlock();
      this.audio.setEnabled(this.save.settings.sfx);
      globalThis.removeEventListener('pointerdown', unlock);
      globalThis.removeEventListener('keydown', unlock);
    };
    globalThis.addEventListener('pointerdown', unlock);
    globalThis.addEventListener('keydown', unlock);

    this.ui.renderMenu(this.save);
    this.ui.show('menu');
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  /* --------------------------------------------------------- lifecycle */

  resize() {
    const w = globalThis.innerWidth;
    const h = globalThis.innerHeight;
    this.renderer.resize(w, h);
  }

  persist() {
    persistSave(this.save);
  }

  setMode(mode) {
    this.mode = mode;
    const playing = mode === MODE.PLAYING;
    this.input.setEnabled(playing);

    if (playing) {
      this.ui.showHud();
      return;
    }
    if (mode === MODE.PAUSED) {
      this.ui.show('pause');
    } else if (mode === MODE.SHOP) {
      this.ui.renderShop(this.save);
      this.ui.show('shop');
    } else if (mode === MODE.MENU) {
      this.ui.renderMenu(this.save);
      this.ui.renderMaps(this.save);
      this.ui.show('menu');
    } else if (mode === MODE.RESULT) {
      this.ui.show('result');
    }
  }

  startRun(mapId) {
    this.pendingMap = mapId;
    this.game = new Game({
      save: this.save,
      mapId,
      audio: this.audio,
    });
    this.deathAt = 0;
    this.renderer.buildGround(this.game);
    this.setMode(MODE.PLAYING);
    this.audio.waveStart();
    if (!this.save.tutorialSeen) {
      this.save = { ...this.save, tutorialSeen: true };
      this.persist();
    }
  }

  abandon() {
    if (this.game && this.game.phase !== PHASE.DEAD && this.game.phase !== PHASE.CLEARED) {
      this.finishRun(false);
    }
    this.toMenu();
  }

  toMenu() {
    this.game = null;
    this.setMode(MODE.MENU);
  }

  closeShop() {
    if (this.game && this.game.phase !== PHASE.CLEARED && this.game.phase !== PHASE.DEAD) {
      this.setMode(MODE.PLAYING);
    } else {
      this.setMode(MODE.MENU);
    }
  }

  purchase(fn, silent = false) {
    // The game owns the live save while a run is on (weapon cycling mutates it).
    if (this.game) this.save = this.game.save;
    const result = fn(this.save);
    if (result.ok) {
      this.save = result.save;
      if (this.game) this.game.setSave(this.save);
      this.persist();
      this.audio.buy();
      if (!silent && result.message) this.ui.toast(result.message);
    } else {
      this.audio.error();
      if (!silent && result.message) this.ui.toast(result.message, true);
    }
    this.ui.renderShop(this.save, this.ui.tab);
    this.ui.renderMenu(this.save);
    this.ui.renderMaps(this.save);
    return result;
  }

  wipe() {
    this.save = createDefaultSave();
    this.persist();
    this.ui.renderMenu(this.save);
    this.ui.renderMaps(this.save);
    this.ui.toast('Save wiped. Fresh start, stranger.', true);
  }

  finishRun(won) {
    const game = this.game;
    if (!game) return;
    const summary = summariseRun({
      kills: game.run.kills,
      wavesCleared: game.run.wavesCleared,
      coins: game.run.coins,
      bounty: game.run.bounty,
      shotsFired: game.run.shotsFired,
      shotsHit: game.run.shotsHit,
      bossKills: game.run.bossKills,
    });
    this.save = game.bankRun(this.save);
    if (this.game) this.game.save = this.save;
    this.persist();
    this.ui.showResult({
      title: won ? `${game.map.name} Cleared` : 'You Bit the Dust',
      sub: won
        ? `${this.save.name} rode out of ${game.map.name} with the deed in hand.`
        : `${this.save.name} fell on wave ${game.wave} of ${game.map.waves} in ${game.map.name}. Your coin stays in your pocket.`,
      stats: summary,
      cleared: won,
    });
    this.setMode(MODE.RESULT);
    if (won) this.audio.victory();
    else this.audio.defeat();
  }

  /* ------------------------------------------------------------ events */

  onAction(action, arg) {
    if (action === 'shop') {
      if (this.mode === MODE.PLAYING) this.setMode(MODE.SHOP);
      else if (this.mode === MODE.SHOP) this.closeShop();
      return;
    }
    if (action === 'pause') {
      if (this.mode === MODE.PLAYING) this.setMode(MODE.PAUSED);
      else if (this.mode === MODE.PAUSED) this.setMode(MODE.PLAYING);
      return;
    }
    if (this.mode !== MODE.PLAYING || !this.game) return;
    if (action === 'slot') this.game.selectSlot(arg);
    if (action === 'confirm' && this.game.phase === PHASE.INTERMISSION) this.game.skipIntermission();
  }

  handleGameEvents(events) {
    for (const e of events) {
      switch (e.type) {
        case 'shot': this.audio.shot(e.gunId); break;
        case 'enemyshot': this.audio.enemyShot(); break;
        case 'dryfire': this.audio.dryFire(); break;
        case 'reload': this.audio.reload(); break;
        case 'hit': this.audio.hit(); break;
        case 'crit': this.audio.crit(); break;
        case 'kill': this.audio.kill(); break;
        case 'explosion': this.audio.explosion(); break;
        case 'coin': this.audio.coin(); break;
        case 'bounty': this.audio.pickup(); break;
        case 'heal':
        case 'ammo': this.audio.pickup(); break;
        case 'hurt': this.audio.hurt(); break;
        case 'dash': this.audio.dash(); break;
        case 'wavestart': this.audio.waveStart(); break;
        case 'swap': this.audio.reload(); break;
        default: break;
      }
    }
  }

  /* -------------------------------------------------------------- loop */

  frame(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.frames += 1;

    if (this.game) {
      if (this.mode === MODE.PLAYING) {
        const input = this.input.sample();
        this.game.update(dt, input);
        this.input.endFrame();
        this.handleGameEvents(this.game.drainEvents());

        // Linger a beat on death so the player sees what got them.
        if (this.game.phase === PHASE.DEAD) {
          this.deathAt = (this.deathAt || 0) + dt;
          if (this.deathAt > 1.15) this.finishRun(false);
        } else if (this.game.phase === PHASE.CLEARED) {
          this.deathAt = (this.deathAt || 0) + dt;
          if (this.deathAt > 1.6) this.finishRun(true);
        }
      }
      // the minimap is drawn top-right, where the HUD purse sits on small screens
      this.renderer.draw(this.game, this.mode === MODE.PLAYING ? dt : dt * 0.15, {
        minimap: this.renderer.cssWidth > 900,
      });
      if (this.mode === MODE.PLAYING || this.mode === MODE.PAUSED || this.mode === MODE.SHOP) {
        this.ui.updateHud(this.game);
      }
    }

    requestAnimationFrame((t) => this.frame(t));
  }
}

/** Fallback so a broken import surface never leaves a blank screen. */
function fatal(err) {
  const node = document.createElement('div');
  node.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1b120c;color:#e8c789;font-family:Georgia,serif;padding:32px;text-align:center;z-index:999';
  node.innerHTML = `<div><h1 style="font-size:28px;letter-spacing:.08em">Dust &amp; Guns could not start</h1><p style="opacity:.7">${String(err && err.message ? err.message : err)}</p></div>`;
  document.body.appendChild(node);
}

try {
  globalThis.DUST_AND_GUNS = new App();
} catch (err) {
  fatal(err);
}

export { App, MODE };
