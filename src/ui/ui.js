/**
 * DOM layer. Everything the player clicks lives here; nothing in here
 * touches the simulation. It renders from the same `shopCatalog()` and
 * `mapUnlockStatus()` functions the rest of the game uses.
 */

import { RARITY, dpsOf, getGun, gunDamagePerShot, shotPellets } from '../data/guns.js';
import { SKIN_RARITY, getPlayerSkin, getGunSkin } from '../data/skins.js';
import { MAPS, mapUnlockStatus } from '../data/maps.js';
import { MAX_LOADOUT, shopCatalog } from '../core/store.js';
import { formatCoins } from '../core/utils.js';
import { mapPurchaseStatus } from '../core/economy.js';

const el = (id) => document.getElementById(id);

const CONTROLS_HELP = [
  ['Move', 'W A S D'],
  ['Aim', 'Mouse'],
  ['Fire', 'Left Click'],
  ['Reload', 'R'],
  ['Sprint', 'Shift'],
  ['Dodge Roll', 'Space / RMB'],
  ['Swap Weapon', 'Q'],
  ['Weapon Slot', '1 – 4'],
  ['Shop', 'Tab / B'],
  ['Pause', 'Esc'],
];

const TIPS = [
  '<b>Powder kegs explode.</b> Shoot them into a crowd and let the desert do the work.',
  '<b>A red dashed line</b> is a ridge sniper lining up. Break line of sight behind cover.',
  '<b>Cover blocks bullets both ways</b> — crates and barrels can be shot to pieces.',
  '<b>Dodge rolls give you a moment of invulnerability.</b> Use them, they are cheap.',
  '<b>Reload during the intermission</b> — the shop timer waits for nobody, but ammo crates refill everything.',
  '<b>Bounty stars</b> only come from bosses and clearing territories. They buy the legendary gear.',
];

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.tab = 'guns';
    this.screens = {
      menu: el('screen-menu'),
      maps: el('screen-maps'),
      shop: el('screen-shop'),
      pause: el('screen-pause'),
      result: el('screen-result'),
      help: el('screen-help'),
    };
    this.hud = el('hud');
    this.cache = {};
    this.currentScreen = 'menu';
    this.bindStatic();
    this.renderHelp();
  }

  /* ------------------------------------------------------------ wiring */

  bindStatic() {
    el('btn-play').addEventListener('click', () => this.h.play());
    el('btn-armoury').addEventListener('click', () => this.openShop());
    el('btn-territory').addEventListener('click', () => this.show('maps'));
    el('btn-help').addEventListener('click', () => this.show('help'));
    el('btn-wipe').addEventListener('click', () => this.h.wipe());
    el('btn-resume').addEventListener('click', () => this.h.resume());
    el('btn-pause-shop').addEventListener('click', () => this.openShop());
    el('btn-quit').addEventListener('click', () => this.h.quit());
    el('btn-again').addEventListener('click', () => this.h.again());
    el('btn-result-shop').addEventListener('click', () => this.openShop());
    el('btn-menu').addEventListener('click', () => this.h.toMenu());
    el('shop-close').addEventListener('click', () => this.closeShop());
    el('hud-shop').addEventListener('click', () => this.openShop());

    const nameInput = el('player-name');
    nameInput.addEventListener('input', () => this.h.rename(nameInput.value));
    this.nameInput = nameInput;

    for (const btn of document.querySelectorAll('[data-back]')) {
      btn.addEventListener('click', () => this.show(this.currentScreen === 'help' ? 'menu' : 'menu'));
    }
  }

  show(name) {
    for (const [key, node] of Object.entries(this.screens)) {
      node.classList.toggle('hidden', key !== name);
    }
    this.hud.classList.toggle('hidden', name !== null && name !== undefined);
    if (name) this.currentScreen = name;
    this.h.onScreenChange?.(name);
  }

  showHud() {
    for (const node of Object.values(this.screens)) node.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.hud.setAttribute('aria-hidden', 'false');
  }

  /* ------------------------------------------------------------- menu */

  renderMenu(save) {
    el('menu-coins').textContent = formatCoins(save.coins);
    el('menu-bounty').textContent = save.bounty;
    if (document.activeElement !== this.nameInput) this.nameInput.value = save.name === 'Stranger' ? '' : save.name;

    const s = save.stats;
    const acc = s.shotsFired ? Math.round((s.shotsHit / s.shotsFired) * 100) : 0;
    el('career').innerHTML = [
      `<div>Runs <b>${s.runs}</b> &middot; Bandits downed <b>${s.kills}</b> &middot; Bosses <b>${s.bossKills}</b></div>`,
      `<div>Territories cleared <b>${save.clearedMaps.length}</b>/${MAPS.length} &middot; Best wave <b>${s.highestWave}</b> &middot; Accuracy <b>${acc}%</b></div>`,
      `<div>Lifetime coin <b>$${formatCoins(s.coinsEarned)}</b> &middot; Guns owned <b>${save.ownedGuns.length}</b> &middot; Outfits <b>${save.ownedPlayerSkins.length}</b></div>`,
    ].join('');

    const playBtn = el('btn-play');
    playBtn.textContent = save.clearedMaps.length >= MAPS.length ? 'Ride Out (All Cleared)' : 'Ride Out';
  }

  /* ------------------------------------------------------------- maps */

  renderMaps(save) {
    const grid = el('map-grid');
    grid.innerHTML = '';
    for (const coinEl of document.querySelectorAll('#screen-maps .purse-coins')) {
      coinEl.textContent = formatCoins(save.coins);
    }

    for (const map of MAPS) {
      const status = mapUnlockStatus(map, save);
      const purchase = mapPurchaseStatus(map, save);
      const best = save.best?.[map.id];
      const card = document.createElement('div');
      card.className = `map-card${status.unlocked ? '' : ' locked'}`;
      card.innerHTML = `
        <div class="map-thumb">
          ${this.mapThumb(map)}
          <div class="veil"></div>
          ${save.clearedMaps.includes(map.id) ? '<div class="cleared-badge">Cleared</div>' : ''}
          ${best ? `<div class="best-badge">Best: wave ${best.wave}</div>` : ''}
        </div>
        <div class="map-body">
          <div class="sub">${map.subtitle}</div>
          <h3>${map.name}</h3>
          <p>${map.blurb}</p>
          <div class="map-meta">
            <span class="stars">${this.stars(map.difficulty)}</span>
            <span><b>${map.waves}</b> waves</span>
            <span>Enemy <b>&times;${map.enemyScale}</b></span>
            <span>Payout <b>&times;${map.rewardScale}</b></span>
          </div>
        </div>
      `;

      if (status.unlocked) {
        card.addEventListener('click', () => this.h.play(map.id));
      } else {
        const lock = document.createElement('div');
        lock.className = 'map-lock';
        const req = MAPS.find((m) => m.id === map.unlock.mapId);
        lock.innerHTML = `<div class="inner">
          <p>Clear <b>${req ? req.name : 'the last territory'}</b> to open this range<br />— or buy the deed —</p>
          <button class="btn ${purchase.affordable ? 'primary' : ''}" ${purchase.affordable ? '' : 'disabled'}>
            $${formatCoins(map.unlock.cost)}
          </button>
        </div>`;
        const btn = lock.querySelector('button');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.h.buyMap(map.id);
        });
        card.appendChild(lock);
      }
      grid.appendChild(card);
    }
  }

  stars(n) {
    let out = '';
    for (let i = 0; i < 5; i += 1) out += i < n ? '★' : '<span class="off">★</span>';
    return out;
  }

  /** Procedural top-down thumbnail from the map's own structure data. */
  mapThumb(map) {
    const W = 300;
    const H = 118;
    const pal = map.palette;
    const rects = map.structures
      .map(
        (s) =>
          `<rect x="${(s.x * W).toFixed(1)}" y="${(s.y * H).toFixed(1)}" width="${(s.w * W).toFixed(1)}" height="${(s.h * H).toFixed(1)}" rx="1.5" fill="${pal.obstacleTop}" opacity="0.92"/>`,
      )
      .join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <rect width="${W}" height="${H}" fill="${pal.ground}"/>
      <rect width="${W}" height="${H}" fill="${pal.groundAlt}" opacity="0.35"/>
      <path d="M0 ${H * 0.62} C ${W * 0.3} ${H * 0.5}, ${W * 0.6} ${H * 0.72}, ${W} ${H * 0.58}" stroke="${pal.dirt}" stroke-width="9" fill="none" opacity="0.5"/>
      ${rects}
    </svg>`;
  }

  /* ------------------------------------------------------------- shop */

  openShop() {
    this.show('shop');
    this.renderShop(this.h.getSave());
  }

  closeShop() {
    this.h.closeShop();
  }

  renderShop(save, tab = this.tab) {
    this.tab = tab;
    for (const c of document.querySelectorAll('#screen-shop .purse-coins')) c.textContent = formatCoins(save.coins);
    for (const b of document.querySelectorAll('#screen-shop .purse-bounty')) b.textContent = save.bounty;

    const catalog = shopCatalog(save);

    // tabs
    const tabs = el('shop-tabs');
    tabs.innerHTML = '';
    for (const c of catalog) {
      const b = document.createElement('button');
      b.className = `tab${c.id === tab ? ' active' : ''}`;
      b.textContent = c.label;
      b.addEventListener('click', () => this.renderShop(save, c.id));
      tabs.appendChild(b);
    }

    const active = catalog.find((c) => c.id === tab) ?? catalog[0];
    const list = el('shop-list');
    list.innerHTML = '';
    for (const item of active.items) {
      list.appendChild(this.renderItem(active.id, item, save));
    }

    this.renderSide(save);
  }

  renderItem(tabId, item, save) {
    const node = document.createElement('div');
    const rarity = tabId === 'maps' ? null : tabId === 'guns' ? RARITY[item.rarity] : SKIN_RARITY[item.rarity];
    node.className = `item${item.state.owned ? ' owned' : ''}${item.state.equipped ? ' equipped' : ''}`;
    node.style.setProperty('--rarity', rarity ? rarity.color : '#b9b0a2');

    if (tabId === 'guns') {
      const pellets = shotPellets(item);
      node.innerHTML = `
        <div class="item-head">
          <span class="item-name">${item.name}</span>
          <span class="item-rarity">${rarity.label}</span>
        </div>
        <div class="item-blurb">${item.blurb}</div>
        <div class="item-stats">
          <span class="chip">DMG ${gunDamagePerShot(item)}${pellets > 1 ? ` (${item.damage}×${pellets})` : ''}</span>
          <span class="chip">DPS ${dpsOf(item)}</span>
          <span class="chip">MAG ${item.mag}</span>
          <span class="chip">${(item.fireRate / 1000).toFixed(2)}s</span>
          ${item.splash ? '<span class="chip">EXPLOSIVE</span>' : ''}
          ${item.pierce ? `<span class="chip">PIERCE ${item.pierce}</span>` : ''}
          ${item.auto ? '<span class="chip">AUTO</span>' : ''}
          ${item.critChance > 0.15 ? `<span class="chip">CRIT ${Math.round(item.critChance * 100)}%</span>` : ''}
        </div>
        ${this.itemFoot('gun', item, save)}
      `;
    } else if (tabId === 'player-skins' || tabId === 'gun-skins') {
      const cols = tabId === 'player-skins'
        ? [item.colours.hat, item.colours.coat, item.colours.shirt, item.colours.bandana]
        : [item.colours.body, item.colours.trim, item.colours.grip];
      node.innerHTML = `
        <div class="item-head">
          <span class="item-name">${item.name}</span>
          <span class="item-rarity">${rarity.label}</span>
        </div>
        <div class="swatches">${cols.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
        <div class="item-blurb">${item.blurb}</div>
        ${this.itemFoot(tabId === 'player-skins' ? 'player-skin' : 'gun-skin', item, save)}
      `;
    } else {
      const unlocked = item.state.owned;
      node.innerHTML = `
        <div class="item-head">
          <span class="item-name">${item.name}</span>
          <span class="item-rarity">${this.stars(item.difficulty)}</span>
        </div>
        <div class="item-blurb">${item.blurb}</div>
        <div class="item-stats">
          <span class="chip">${item.waves} WAVES</span>
          <span class="chip">ENEMY ×${item.enemyScale}</span>
          <span class="chip">PAYOUT ×${item.rewardScale}</span>
          ${save.best?.[item.id] ? `<span class="chip">BEST WAVE ${save.best[item.id].wave}</span>` : ''}
        </div>
        <div class="item-foot">
          <span class="state-label${unlocked ? '' : ' gold'}">${unlocked ? (save.clearedMaps.includes(item.id) ? 'Cleared' : 'Open range') : `$${formatCoins(item.unlock.cost)}`}</span>
          ${unlocked
            ? `<button class="btn primary" data-act="play-map" data-id="${item.id}">Ride</button>`
            : `<button class="btn ${save.coins >= item.unlock.cost ? 'primary' : ''}" data-act="buy-map" data-id="${item.id}" ${save.coins >= item.unlock.cost ? '' : 'disabled'}>Buy Deed</button>`}
        </div>
      `;
    }

    for (const btn of node.querySelectorAll('[data-act]')) {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        if (act === 'buy-gun') this.h.buyGun(id);
        else if (act === 'sell-gun') this.h.sellGun(id);
        else if (act === 'equip-gun') this.h.equipGun(id);
        else if (act === 'buy-player-skin') this.h.buyPlayerSkin(id);
        else if (act === 'equip-player-skin') this.h.equipPlayerSkin(id);
        else if (act === 'buy-gun-skin') this.h.buyGunSkin(id);
        else if (act === 'equip-gun-skin') this.h.equipGunSkin(id);
        else if (act === 'buy-map') this.h.buyMap(id);
        else if (act === 'play-map') this.h.play(id);
      });
    }
    return node;
  }

  itemFoot(kind, item, save) {
    const owned = item.state.owned;
    const equipped = item.state.equipped;
    const price = item.bounty
      ? `<span class="price bounty"><i class="ico star"></i>${item.bounty}</span>`
      : item.price
        ? `<span class="price${this.affordable(item, save) ? '' : ' cant'}"><i class="ico coin"></i>${formatCoins(item.price)}</span>`
        : `<span class="price">Starter kit</span>`;

    let action = '';
    if (!owned) {
      const can = this.affordable(item, save);
      action = `<button class="btn ${can ? 'primary' : ''}" data-act="buy-${kind}" data-id="${item.id}" ${can ? '' : 'disabled'}>Buy</button>`;
    } else if (equipped) {
      action = `<span class="state-label gold">Equipped</span>`;
    } else {
      action = `<button class="btn" data-act="equip-${kind}" data-id="${item.id}">Equip</button>`;
    }

    let extra = '';
    if (kind === 'gun' && owned) {
      const value = Math.round((item.price || 0) * 0.45);
      if (value > 0 && save.ownedGuns.length > 1) {
        extra = `<button class="btn ghost tiny" data-act="sell-gun" data-id="${item.id}">Sell $${formatCoins(value)}</button>`;
      }
    }

    return `<div class="item-foot">${price}<span style="display:flex;gap:6px">${extra}${action}</span></div>`;
  }

  affordable(item, save) {
    if (item.bounty) return save.bounty >= item.bounty;
    return save.coins >= (item.price ?? 0);
  }

  renderSide(save) {
    const slots = el('shop-loadout');
    slots.innerHTML = '';
    for (let i = 0; i < MAX_LOADOUT; i += 1) {
      const id = save.equipped.loadout[i];
      const gun = id ? getGun(id) : null;
      const node = document.createElement('div');
      node.className = `slot${i === save.equipped.activeSlot ? ' active' : ''}`;
      node.innerHTML = `<i>${i + 1}</i>${gun ? gun.name : '— empty —'}`;
      if (gun) node.addEventListener('click', () => this.h.equipGun(gun.id));
      slots.appendChild(node);
    }

    const activeId = save.equipped.loadout[save.equipped.activeSlot];
    const gun = getGun(activeId);
    const gs = getGunSkin(save.equipped.gunSkin);
    el('gun-detail').innerHTML = gun
      ? `<b>${gun.name}</b> — ${gun.blurb}<br />
         Damage <b>${gunDamagePerShot(gun)}</b> &middot; DPS <b>${dpsOf(gun)}</b> &middot; Mag <b>${gun.mag}</b><br />
         Reload <b>${(gun.reload / 1000).toFixed(2)}s</b> &middot; Range <b>${gun.range}</b> &middot; Finish <b>${gs.name}</b>`
      : 'No weapon equipped.';

    const ps = getPlayerSkin(save.equipped.playerSkin);
    el('shop-wearing').innerHTML = `
      <div class="who"><b>${ps.name}</b>
        <div class="swatches">${[ps.colours.hat, ps.colours.coat, ps.colours.shirt, ps.colours.bandana].map((c) => `<i style="background:${c}"></i>`).join('')}</div>
        Outfit
      </div>
      <div class="who"><b>${gs.name}</b>
        <div class="swatches">${[gs.colours.body, gs.colours.trim, gs.colours.grip].map((c) => `<i style="background:${c}"></i>`).join('')}</div>
        Gun finish
      </div>`;
  }

  toast(msg, bad = false) {
    const t = el('toast');
    t.textContent = msg;
    t.classList.toggle('bad', bad);
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
  }

  /* -------------------------------------------------------------- hud */

  updateHud(game) {
    const p = game.player;
    const gun = game.gun;
    const mag = game.magAmmo;

    const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
    this.cache.hpFill ??= el('hp-fill');
    this.cache.hpFill.style.width = `${hpPct}%`;
    this.cache.hpFill.parentElement.classList.toggle('low', hpPct < 30);
    el('hp-text').textContent = Math.ceil(p.hp);

    el('stamina-fill').style.width = `${(p.stamina / 100) * 100}%`;
    el('weapon-name').textContent = gun.name;
    el('ammo-mag').textContent = mag;
    el('ammo-reserve').textContent = gun.mag;
    el('ammo-mag').parentElement.classList.toggle('empty', mag === 0);
    el('reload-hint').textContent = p.reloading
      ? 'Reloading…'
      : mag === 0
        ? 'Press R'
        : mag < gun.mag
          ? 'R to reload'
          : '';

    el('wave-num').textContent = game.wave || 1;
    el('wave-max').textContent = game.map.waves;
    el('enemies-left').textContent = game.enemies.length + game.waveQueue.filter((q) => !q.spawned).length;

    el('coins').textContent = formatCoins(Math.round(game.save.coins + game.run.coins));
    el('bounty').textContent = Math.round(game.save.bounty + game.run.bounty);
    el('run-kills').textContent = game.run.kills;
    el('run-acc').textContent = game.run.shotsFired ? Math.round((game.run.shotsHit / game.run.shotsFired) * 100) : 0;

    // loadout chips
    const slots = el('loadout');
    if (this._loadoutKey !== game.save.equipped.loadout.join(',')) {
      this._loadoutKey = game.save.equipped.loadout.join(',');
      slots.innerHTML = '';
      game.save.equipped.loadout.forEach((id, i) => {
        const g = getGun(id);
        const node = document.createElement('div');
        node.className = 'slot';
        node.dataset.slot = String(i);
        node.innerHTML = `<i>${i + 1}</i>${g ? g.name.split(' ')[0] : '—'}`;
        slots.appendChild(node);
      });
    }
    slots.querySelectorAll('.slot').forEach((node) => {
      node.classList.toggle('active', Number(node.dataset.slot) === game.save.equipped.activeSlot);
    });

    // announce banner
    const ann = el('announce');
    if (game.announce) {
      if (this._announceKey !== `${game.announce.title}|${game.announce.sub}`) {
        this._announceKey = `${game.announce.title}|${game.announce.sub}`;
        ann.innerHTML = `${game.announce.title}${game.announce.sub ? `<small>${game.announce.sub}</small>` : ''}`;
        ann.classList.add('show');
      }
    } else if (this._announceKey) {
      this._announceKey = null;
      ann.classList.remove('show');
    }

    if (game.phase === 'intermission') {
      const t = Math.ceil(game.intermissionTime);
      if (this._inter !== t) {
        this._inter = t;
        el('reload-hint').textContent = `Next wave in ${t}s`;
      }
    }
  }

  showResult({ title, sub, stats, cleared }) {
    el('result-title').textContent = title;
    el('result-sub').textContent = sub;
    el('result-grid').innerHTML = [
      ['Waves', stats.wavesCleared],
      ['Kills', stats.kills],
      ['Accuracy', `${stats.accuracy}%`],
      ['Coins Earned', `$${formatCoins(stats.coins)}`],
      ['Bounty', stats.bounty],
      ['Bosses', stats.bossKills],
    ]
      .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('');
    el('btn-again').textContent = cleared ? 'Ride Again' : 'Try Again';
    this.show('result');
  }

  renderHelp() {
    el('controls-grid').innerHTML = CONTROLS_HELP.map(
      ([label, keys]) => `<div><span>${label}</span><b>${keys}</b></div>`,
    ).join('');
    el('tips').innerHTML = `<ul>${TIPS.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  }
}
