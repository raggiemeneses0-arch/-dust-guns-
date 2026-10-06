/**
 * Minimal browser environment shim.
 *
 * Stands in for the pieces of the DOM the game touches -- elements, a
 * recording 2D canvas context, rAF, localStorage -- so the real browser
 * entry point can be imported and driven under `node --test`. It replaces
 * the browser, never any game logic.
 */

import { readFileSync } from 'node:fs';

/** Real element ids from the shipped markup, so unknown lookups return null. */
const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
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


export { makeEl, makeCanvas, installDom, HTML_IDS, drawn };
