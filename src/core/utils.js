/** Small math / geometry helpers shared by the sim, the renderer and the tests. */

export const TAU = Math.PI * 2;

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function distSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Shortest signed delta between two angles, in [-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function rotateToward(from, to, maxStep) {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

export function normalizeAngle(a) {
  let v = a % TAU;
  if (v > Math.PI) v -= TAU;
  if (v < -Math.PI) v += TAU;
  return v;
}

export function rectOverlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Circle vs axis-aligned rect: closest point on the rect to the circle centre. */
export function circleRectOverlap(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return distSq(cx, cy, nx, ny) <= r * r;
}

/** Push a circle fully out of a rect. Returns the corrected position. */
export function resolveCircleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  let dx = cx - nx;
  let dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return { x: cx, y: cy, hit: false };

  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    dx /= d;
    dy /= d;
    return { x: nx + dx * r, y: ny + dy * r, hit: true };
  }

  // Centre is inside the rect: eject along the shallowest axis.
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: rect.x - r, y: cy, hit: true };
  if (min === right) return { x: rect.x + rect.w + r, y: cy, hit: true };
  if (min === top) return { x: cx, y: rect.y - r, hit: true };
  return { x: cx, y: rect.y + rect.h + r, hit: true };
}

/** Segment vs circle test -- used for fast bullet hits. */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / lenSq : 0;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return distSq(px, py, cx, cy) <= r * r;
}

/** Segment vs rect -- bullets stop on cover. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  // Sample along the segment; bullets never move more than a few px per frame.
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil(len / 6));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
      return true;
    }
  }
  return false;
}

export function formatCoins(n) {
  return Math.round(n).toLocaleString('en-US');
}
