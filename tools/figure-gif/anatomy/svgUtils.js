/**
 * Pure 2D vector math and SVG path/gradient construction helpers.
 * All functions return new objects/strings without mutating inputs.
 */

const DEG_TO_RAD = Math.PI / 180;

function degToRad(deg) {
  return deg * DEG_TO_RAD;
}

function vec(x, y) {
  return { x, y };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

function len(v) {
  return Math.hypot(v.x, v.y);
}

function norm(v) {
  const l = len(v);
  if (l < 1e-6) return { x: 1, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpVec(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/**
 * Returns unit vector from standard math angle in degrees
 * (0 = +x right, 90 = -y up, 180 = -x left, -90 = +y down).
 */
function dirFromDeg(deg) {
  const r = degToRad(deg);
  return { x: Math.cos(r), y: -Math.sin(r) };
}

/**
 * Computes endpoint from origin, length, and angle in degrees.
 */
function stepFromDeg(origin, length, deg) {
  const d = dirFromDeg(deg);
  return {
    x: origin.x + length * d.x,
    y: origin.y + length * d.y,
  };
}

/**
 * 90-degree clockwise in screen coords (+x right, +y down).
 * For an upward vector (0, -1), returns (+1, 0) = anatomical anterior (facing right).
 */
function anteriorNormal(dir) {
  return { x: -dir.y, y: dir.x };
}

/**
 * 90-degree counter-clockwise in screen coords (+x right, +y down).
 * For an upward vector (0, -1), returns (-1, 0) = anatomical posterior (back).
 * For a rightward vector (+1, 0), returns (0, -1) = top.
 */
function posteriorNormal(dir) {
  return { x: dir.y, y: -dir.x };
}

/**
 * Formats a number concisely for clean SVG output.
 */
function f(n) {
  return Number(n.toFixed(2));
}

function pt(p) {
  return `${f(p.x)},${f(p.y)}`;
}

/**
 * Builds a 5-stop 3D cylindrical linearGradient oriented from the lit front/top
 * side of a segment to its shadowed back/bottom side, including subtle rim light.
 */
function createCylinderGradient(id, p1, p2, halfWidth, palette, flipLight = false) {
  const mid = lerpVec(p1, p2, 0.5);
  const axis = norm(sub(p2, p1));
  let n = anteriorNormal(axis);
  const lightDir = { x: 0.45, y: -0.89 };
  const dot = n.x * lightDir.x + n.y * lightDir.y;
  if ((dot < 0 && !flipLight) || (dot > 0 && flipLight)) {
    n = scale(n, -1);
  }
  const g1 = add(mid, scale(n, halfWidth * 1.05));
  const g2 = add(mid, scale(n, -halfWidth * 1.05));

  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(g1.x)}" y1="${f(g1.y)}" x2="${f(g2.x)}" y2="${f(g2.y)}">
      <stop offset="0%" stop-color="${palette.highlight}" />
      <stop offset="22%" stop-color="${palette.light}" />
      <stop offset="56%" stop-color="${palette.mid}" />
      <stop offset="86%" stop-color="${palette.shadow}" />
      <stop offset="100%" stop-color="${palette.rim}" />
    </linearGradient>`;
}

/**
 * Builds an anatomical directional gradient between two points.
 */
function createDirectionalGradient(id, startPt, endPt, palette) {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(startPt.x)}" y1="${f(startPt.y)}" x2="${f(endPt.x)}" y2="${f(endPt.y)}">
      <stop offset="0%" stop-color="${palette.highlight}" />
      <stop offset="26%" stop-color="${palette.light}" />
      <stop offset="60%" stop-color="${palette.mid}" />
      <stop offset="88%" stop-color="${palette.shadow}" />
      <stop offset="100%" stop-color="${palette.rim}" />
    </linearGradient>`;
}

module.exports = {
  degToRad,
  vec,
  add,
  sub,
  scale,
  len,
  norm,
  clamp,
  lerp,
  lerpVec,
  dirFromDeg,
  stepFromDeg,
  anteriorNormal,
  posteriorNormal,
  f,
  pt,
  createCylinderGradient,
  createDirectionalGradient,
};
