/**
 * Keyboard + mouse input. Produces a plain object each frame that the
 * simulation consumes, and raises "action" events for one-shot commands
 * (open shop, pause, weapon slot) that the UI layer cares about.
 */

import { CONTROLS } from '../config.js';

export class Input {
  constructor(canvas, onAction = () => {}) {
    this.canvas = canvas;
    this.onAction = onAction;
    this.keys = new Set();
    this.mouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.firedThisFrame = false;
    this.reloadPressed = false;
    this.dashPressed = false;
    this.cyclePressed = false;
    this.enabled = true;
    this.pointerLocked = false;
    this._bind();
  }

  has(list) {
    return list.some((code) => this.keys.has(code));
  }

  _bind() {
    this._onKeyDown = (e) => {
      // These stay live while input is disabled so the shop/pause can be dismissed.
      const alwaysLive = ['Escape', 'Enter', 'Tab', 'KeyB'];
      if (!this.enabled && !alwaysLive.includes(e.code)) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);

      if (this.has(CONTROLS.reload)) this.reloadPressed = true;
      if (this.has(CONTROLS.dash)) this.dashPressed = true;
      if (this.has(CONTROLS.cycleWeapon)) this.cyclePressed = true;
      if (this.has(CONTROLS.shop)) this.onAction('shop');
      if (this.has(CONTROLS.pause)) this.onAction('pause');
      if (e.code === 'Enter') this.onAction('confirm');
      if (/^Digit[1-4]$/.test(e.code)) this.onAction('slot', Number(e.code.slice(5)) - 1);
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };

    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    };

    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.firedThisFrame = true;
      }
      if (e.button === 2) this.dashPressed = true;
    };

    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };

    this._onContext = (e) => e.preventDefault();

    globalThis.addEventListener('keydown', this._onKeyDown);
    globalThis.addEventListener('keyup', this._onKeyUp);
    globalThis.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    globalThis.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('contextmenu', this._onContext);
  }

  /** Build the per-frame input object. Call once per frame. */
  sample() {
    const moveX = (this.has(CONTROLS.right) ? 1 : 0) - (this.has(CONTROLS.left) ? 1 : 0);
    const moveY = (this.has(CONTROLS.down) ? 1 : 0) - (this.has(CONTROLS.up) ? 1 : 0);
    return {
      moveX,
      moveY,
      firing: this.mouseDown,
      fireEdge: this.firedThisFrame,
      sprint: this.has(CONTROLS.sprint),
      reload: this.reloadPressed,
      dash: this.dashPressed,
      cycle: this.cyclePressed,
    };
  }

  /** Clear one-shot flags. Call after the frame's update. */
  endFrame() {
    this.firedThisFrame = false;
    this.reloadPressed = false;
    this.dashPressed = false;
    this.cyclePressed = false;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.mouseDown = false;
      this.endFrame();
    }
  }

  destroy() {
    globalThis.removeEventListener('keydown', this._onKeyDown);
    globalThis.removeEventListener('keyup', this._onKeyUp);
    globalThis.removeEventListener('blur', this._onBlur);
    globalThis.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('contextmenu', this._onContext);
  }
}
