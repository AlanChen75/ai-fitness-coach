/**
 * Sculpted anatomical SVG geometry & 3D shading builders for side view.
 * Generates smooth cubic Bezier silhouettes, seamless joint blends,
 * anatomical creases, and bone-attached target-muscle highlight overlays.
 */

const {
  add,
  sub,
  scale,
  norm,
  lerpVec,
  anteriorNormal,
  posteriorNormal,
  f,
  pt,
  createCylinderGradient,
  createDirectionalGradient,
} = require('./svgUtils');

function bonePoint(p1, p2, t, antOffset, antSign = 1) {
  const axis = norm(sub(p2, p1));
  const ant = anteriorNormal(axis);
  return add(lerpVec(p1, p2, t), scale(ant, antOffset * antSign));
}

/**
 * Draws an anatomical side-profile foot resting on groundY or rotated around a pivot.
 */
function buildFoot(
  ankle,
  groundY,
  proportions,
  palette,
  prefix,
  footAngleDeg = 0,
  footPivot = null,
  metatarsalFlat = false
) {
  const { footBack, footFront } = proportions.segments;
  const soleY = metatarsalFlat ? groundY : ankle.y + proportions.segments.ankleHeight;
  const heelBaseY = ankle.y + proportions.segments.ankleHeight;
  const heelX = ankle.x - footBack;
  const toeX = metatarsalFlat ? (footPivot ? footPivot.x + 16 : ankle.x + footFront) : ankle.x + footFront;
  const ballX = metatarsalFlat ? (footPivot ? footPivot.x : toeX - 14) : toeX - 14;

  const heelTop = { x: ankle.x - 8.2, y: ankle.y - 2 };
  const heelBack = { x: heelX, y: heelBaseY - 6.5 };
  const heelBottom = { x: heelX + 5.5, y: heelBaseY };
  const archDip = { x: lerpVec(heelBottom, { x: ballX, y: soleY }, 0.5).x, y: (heelBaseY + soleY) * 0.5 - 3.2 };
  const ball = { x: ballX, y: soleY };
  const toeTip = { x: toeX, y: soleY - 4.8 };
  const toeTop = { x: toeX - 5.5, y: soleY - 12.2 };
  const instep = { x: (ankle.x + ballX) * 0.5 + 3, y: (ankle.y + soleY) * 0.5 - 3 };
  const frontAnkle = { x: ankle.x + 8.5, y: ankle.y - 5 };

  const gradId = `${prefix}_foot_grad`;
  const gradDef = createDirectionalGradient(
    gradId,
    metatarsalFlat ? { x: ballX + 10, y: soleY - 16 } : { x: ankle.x + 16, y: ankle.y - 6 },
    metatarsalFlat ? { x: ballX - 28, y: soleY } : { x: ankle.x - 10, y: soleY },
    palette
  );

  const metaTop = { x: ballX - 2, y: soleY - 11.5 };
  const d = metatarsalFlat
    ? [
        `M ${pt(frontAnkle)}`,
        `C ${pt({ x: ankle.x + 11, y: ankle.y + 0.5 })} ${pt({ x: instep.x - 2, y: instep.y - 2 })} ${pt(instep)}`,
        `Q ${pt({ x: (instep.x + metaTop.x) * 0.5, y: (instep.y + metaTop.y) * 0.5 })} ${pt(metaTop)}`,
        `Q ${pt({ x: toeTop.x - 3, y: toeTop.y - 0.5 })} ${pt(toeTop)}`,
        `C ${pt({ x: toeX - 1, y: soleY - 10.5 })} ${pt({ x: toeX + 0.6, y: soleY - 7.5 })} ${pt(toeTip)}`,
        `C ${pt({ x: toeX, y: soleY - 1 })} ${pt({ x: ball.x + 7, y: soleY })} ${pt(ball)}`,
        `L ${pt({ x: ballX - 8, y: soleY })}`,
        `Q ${pt(archDip)} ${pt({ x: heelBottom.x + 10, y: heelBaseY })}`,
        `L ${pt(heelBottom)}`,
        `C ${pt({ x: heelX + 1, y: heelBaseY })} ${pt({ x: heelX - 0.5, y: heelBaseY - 2.8 })} ${pt(heelBack)}`,
        `C ${pt({ x: heelX + 1, y: heelBaseY - 13 })} ${pt({ x: heelTop.x - 2, y: heelTop.y + 5 })} ${pt(heelTop)}`,
        `Z`,
      ].join(' ')
    : [
        `M ${pt(frontAnkle)}`,
        `C ${pt({ x: ankle.x + 11, y: ankle.y + 0.5 })} ${pt({ x: instep.x - 2, y: instep.y - 2 })} ${pt(instep)}`,
        `C ${pt({ x: instep.x + 11, y: instep.y + 3.5 })} ${pt({ x: toeTop.x - 4, y: toeTop.y - 1 })} ${pt(toeTop)}`,
        `C ${pt({ x: toeX - 1, y: soleY - 10.5 })} ${pt({ x: toeX + 0.6, y: soleY - 7.5 })} ${pt(toeTip)}`,
        `C ${pt({ x: toeX, y: soleY - 1 })} ${pt({ x: ball.x + 7, y: soleY })} ${pt(ball)}`,
        `L ${pt({ x: ballX - 8, y: soleY })}`,
        `Q ${pt(archDip)} ${pt({ x: heelBottom.x + 10, y: heelBaseY })}`,
        `L ${pt(heelBottom)}`,
        `C ${pt({ x: heelX + 1, y: heelBaseY })} ${pt({ x: heelX - 0.5, y: heelBaseY - 2.8 })} ${pt(heelBack)}`,
        `C ${pt({ x: heelX + 1, y: heelBaseY - 13 })} ${pt({ x: heelTop.x - 2, y: heelTop.y + 5 })} ${pt(heelTop)}`,
        `Z`,
      ].join(' ');

  const outerStroke = [
    `M ${pt({ x: ankle.x + 9.2, y: ankle.y - 1 })}`,
    `C ${pt({ x: ankle.x + 12, y: ankle.y + 1.5 })} ${pt({ x: instep.x - 2, y: instep.y - 2 })} ${pt(instep)}`,
    `C ${pt({ x: instep.x + 11, y: instep.y + 3.5 })} ${pt({ x: toeTop.x - 4, y: toeTop.y - 1 })} ${pt(toeTop)}`,
    `C ${pt({ x: toeX - 1, y: soleY - 10.5 })} ${pt({ x: toeX + 0.6, y: soleY - 7.5 })} ${pt(toeTip)}`,
    `C ${pt({ x: toeX, y: soleY - 1 })} ${pt({ x: ball.x + 7, y: soleY })} ${pt(ball)}`,
    `L ${pt({ x: ballX - 8, y: soleY })}`,
    `Q ${pt(archDip)} ${pt({ x: heelBottom.x + 10, y: heelBaseY })}`,
    `L ${pt(heelBottom)}`,
    `C ${pt({ x: heelX + 1, y: heelBaseY })} ${pt({ x: heelX - 0.5, y: heelBaseY - 2.8 })} ${pt(heelBack)}`,
    `C ${pt({ x: heelX + 1, y: heelBaseY - 13 })} ${pt({ x: heelTop.x - 2, y: heelTop.y + 5 })} ${pt(heelTop)}`,
  ].join(' ');

  const malleolus = `<ellipse cx="${f(ankle.x - 1)}" cy="${f(ankle.y + 1.5)}" rx="4.4" ry="3.8" fill="${palette.light}" opacity="0.5" />`;

  const pivot = footPivot || ankle;
  const rotDeg = metatarsalFlat ? 0 : footAngleDeg;
  const wrapOpen = rotDeg ? `<g transform="rotate(${f(rotDeg)} ${f(pivot.x)} ${f(pivot.y)})">` : '';
  const wrapClose = rotDeg ? '</g>' : '';

  return {
    defs: [gradDef],
    svg: `<g class="foot">
      ${wrapOpen}
      <path d="${d}" fill="url(#${gradId})" />
      <path d="${outerStroke}" fill="none" stroke="${palette.outline}" stroke-width="0.75" stroke-linejoin="round" stroke-linecap="round" />
      ${malleolus}
      ${wrapClose}
    </g>`,
  };
}

/**
 * Draws sculpted lower leg (shin + gastrocnemius calf + optional calf highlight).
 */
function buildShin(
  ankle,
  knee,
  proportions,
  bodyPalette,
  musclePalette,
  highlightCalves,
  prefix,
  antSign = 1
) {
  const { widths } = proportions;
  const gradId = `${prefix}_shin_grad`;
  const gradDef = createCylinderGradient(gradId, ankle, knee, widths.calfPeak, bodyPalette);
  const defs = [gradDef];

  const ankAnt = bonePoint(ankle, knee, -0.02, widths.ankle * 1.02, antSign);
  const ankPost = bonePoint(ankle, knee, -0.02, -widths.ankle * 0.94, antSign);
  const shinMidAnt = bonePoint(ankle, knee, 0.52, widths.ankle * 1.18, antSign);
  const kneeAnt = bonePoint(ankle, knee, 0.97, widths.knee * 1.04, antSign);
  const kneeCap = bonePoint(ankle, knee, 1.05, widths.knee * 0.32, antSign);
  const kneePost = bonePoint(ankle, knee, 0.95, -widths.knee * 0.96, antSign);
  const calfPeak = bonePoint(ankle, knee, 0.65, -widths.calfPeak * 1.24, antSign);
  const achilles = bonePoint(ankle, knee, 0.28, -widths.ankle * 0.96, antSign);

  const d = [
    `M ${pt(ankAnt)}`,
    `C ${pt(bonePoint(ankle, knee, 0.25, widths.ankle * 1.15, antSign))} ${pt(shinMidAnt)} ${pt(bonePoint(ankle, knee, 0.78, widths.knee * 0.95, antSign))}`,
    `Q ${pt(kneeAnt)} ${pt(kneeCap)}`,
    `Q ${pt(bonePoint(ankle, knee, 1.04, -widths.knee * 0.65, antSign))} ${pt(kneePost)}`,
    `C ${pt(bonePoint(ankle, knee, 0.82, -widths.calfPeak * 1.26, antSign))} ${pt(calfPeak)} ${pt(bonePoint(ankle, knee, 0.48, -widths.calfPeak * 1.10, antSign))}`,
    `C ${pt(achilles)} ${pt(bonePoint(ankle, knee, 0.12, -widths.ankle * 0.92, antSign))} ${pt(ankPost)}`,
    `Z`,
  ].join(' ');

  const frontEdge = `M ${pt(ankAnt)} C ${pt(bonePoint(ankle, knee, 0.25, widths.ankle * 1.15, antSign))} ${pt(shinMidAnt)} ${pt(bonePoint(ankle, knee, 0.78, widths.knee * 0.95, antSign))} Q ${pt(kneeAnt)} ${pt(bonePoint(ankle, knee, 1.0, widths.knee * 0.92, antSign))}`;
  const backEdge = `M ${pt(kneePost)} C ${pt(bonePoint(ankle, knee, 0.82, -widths.calfPeak * 1.26, antSign))} ${pt(calfPeak)} ${pt(bonePoint(ankle, knee, 0.48, -widths.calfPeak * 1.10, antSign))} C ${pt(achilles)} ${pt(bonePoint(ankle, knee, 0.12, -widths.ankle * 0.92, antSign))} ${pt(ankPost)}`;
  const calfLine = `<path d="M ${pt(bonePoint(ankle, knee, 0.45, -widths.calfPeak * 0.52, antSign))} Q ${pt(bonePoint(ankle, knee, 0.65, -widths.calfPeak * 0.24, antSign))} ${pt(bonePoint(ankle, knee, 0.85, -widths.knee * 0.36, antSign))}" fill="none" stroke="${bodyPalette.crease}" stroke-width="1.1" stroke-linecap="round" />`;

  let calfSvg = '';
  if (highlightCalves) {
    const cGradId = `${prefix}_calf_grad`;
    defs.push(createCylinderGradient(cGradId, ankle, knee, widths.calfPeak * 0.85, musclePalette));

    const cStart = bonePoint(ankle, knee, 0.32, -widths.ankle * 0.72, antSign);
    const cTendon = bonePoint(ankle, knee, 0.24, -widths.ankle * 0.25, antSign);
    const cInnerLow = bonePoint(ankle, knee, 0.46, -widths.calfPeak * 0.14, antSign);
    const cInnerHigh = bonePoint(ankle, knee, 0.80, -widths.knee * 0.18, antSign);
    const cTop = bonePoint(ankle, knee, 0.91, -widths.knee * 0.58, antSign);
    const cOutHigh = bonePoint(ankle, knee, 0.80, -widths.calfPeak * 1.18, antSign);
    const cOutMid = bonePoint(ankle, knee, 0.62, -widths.calfPeak * 1.18, antSign);
    const cOutLow = bonePoint(ankle, knee, 0.45, -widths.calfPeak * 0.98, antSign);

    const calfD = [
      `M ${pt(cStart)}`,
      `C ${pt(cOutLow)} ${pt(cOutMid)} ${pt(cOutHigh)}`,
      `Q ${pt(bonePoint(ankle, knee, 0.88, -widths.knee * 0.92, antSign))} ${pt(cTop)}`,
      `Q ${pt(bonePoint(ankle, knee, 0.86, -widths.knee * 0.32, antSign))} ${pt(cInnerHigh)}`,
      `C ${pt(bonePoint(ankle, knee, 0.65, -widths.calfPeak * 0.08, antSign))} ${pt(cInnerLow)} ${pt(cTendon)}`,
      `Q ${pt(bonePoint(ankle, knee, 0.28, -widths.ankle * 0.48, antSign))} ${pt(cStart)}`,
      `Z`,
    ].join(' ');

    const s1 = `M ${pt(bonePoint(ankle, knee, 0.38, -widths.calfPeak * 0.42, antSign))} Q ${pt(bonePoint(ankle, knee, 0.62, -widths.calfPeak * 0.62, antSign))} ${pt(bonePoint(ankle, knee, 0.84, -widths.calfPeak * 0.50, antSign))}`;
    const s2 = `M ${pt(bonePoint(ankle, knee, 0.43, -widths.calfPeak * 0.72, antSign))} Q ${pt(bonePoint(ankle, knee, 0.64, -widths.calfPeak * 0.94, antSign))} ${pt(bonePoint(ankle, knee, 0.82, -widths.calfPeak * 0.82, antSign))}`;

    calfSvg = `<g class="muscle-calves">
      <path d="${calfD}" fill="url(#${cGradId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${s1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.1" stroke-linecap="round" />
      <path d="${s2}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="1.0" stroke-linecap="round" />
    </g>`;
  }

  return {
    defs,
    svg: `<g class="shin">
      <path d="${d}" fill="url(#${gradId})" />
      <path d="${frontEdge}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${backEdge}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      ${calfLine}
      ${calfSvg}
    </g>`,
  };
}

/**
 * Draws sculpted thigh + optional quadriceps and/or hamstrings muscle overlays.
 */
function buildThigh(
  knee,
  hip,
  proportions,
  bodyPalette,
  musclePalette,
  highlights,
  prefix,
  antSign = 1
) {
  const { widths } = proportions;
  const gradId = `${prefix}_thigh_grad`;
  const gradDef = createCylinderGradient(gradId, knee, hip, widths.thighMid, bodyPalette);
  const defs = [gradDef];

  const kAnt = bonePoint(knee, hip, 0.0, widths.knee * 1.02, antSign);
  const kTip = bonePoint(knee, hip, -0.08, widths.knee * 0.24, antSign);
  const kPost = bonePoint(knee, hip, 0.03, -widths.knee * 0.94, antSign);

  const qLower = bonePoint(knee, hip, 0.30, widths.thighMid * 0.96, antSign);
  const qMid = bonePoint(knee, hip, 0.58, widths.thighMid * 1.14, antSign);
  const qUpper = bonePoint(knee, hip, 0.88, widths.thighMid * 1.00, antSign);
  const hAnt = bonePoint(knee, hip, 1.03, widths.hip * 0.72, antSign);
  const hTop = bonePoint(knee, hip, 1.09, 0, antSign);
  const hPost = bonePoint(knee, hip, 0.96, -widths.hip * 0.86, antSign);

  const hamUpper = bonePoint(knee, hip, 0.68, -widths.thighMid * 0.95, antSign);
  const hamLower = bonePoint(knee, hip, 0.32, -widths.thighMid * 0.76, antSign);

  const thighPath = [
    `M ${pt(kTip)}`,
    `Q ${pt(bonePoint(knee, hip, -0.02, widths.knee * 1.08, antSign))} ${pt(kAnt)}`,
    `C ${pt(qLower)} ${pt(qMid)} ${pt(qUpper)}`,
    `Q ${pt(hAnt)} ${pt(hTop)}`,
    `Q ${pt(bonePoint(knee, hip, 1.04, -widths.hip * 0.78, antSign))} ${pt(hPost)}`,
    `C ${pt(hamUpper)} ${pt(hamLower)} ${pt(kPost)}`,
    `Q ${pt(bonePoint(knee, hip, -0.04, -widths.knee * 0.65, antSign))} ${pt(kTip)}`,
    `Z`,
  ].join(' ');

  const frontEdge = `M ${pt(kTip)} Q ${pt(bonePoint(knee, hip, -0.02, widths.knee * 1.08, antSign))} ${pt(kAnt)} C ${pt(qLower)} ${pt(qMid)} ${pt(qUpper)}`;
  const backEdge = `M ${pt(hPost)} C ${pt(hamUpper)} ${pt(hamLower)} ${pt(kPost)}`;

  let quadSvg = '';
  if (highlights.has('quadriceps')) {
    const qGradId = `${prefix}_quad_grad`;
    defs.push(createCylinderGradient(qGradId, knee, hip, widths.thighMid * 0.90, musclePalette));

    const qStart = bonePoint(knee, hip, 0.14, widths.knee * 0.62, antSign);
    const qTendonTip = bonePoint(knee, hip, 0.10, widths.knee * 0.12, antSign);
    const qInnerLow = bonePoint(knee, hip, 0.28, -widths.thighMid * 0.06, antSign);
    const qInnerMid = bonePoint(knee, hip, 0.58, -widths.thighMid * 0.14, antSign);
    const qInnerHigh = bonePoint(knee, hip, 0.84, -widths.thighMid * 0.02, antSign);
    const qHipApex = bonePoint(knee, hip, 0.95, widths.thighMid * 0.42, antSign);
    const qOutUpper = bonePoint(knee, hip, 0.85, widths.thighMid * 0.94, antSign);
    const qOutMid = bonePoint(knee, hip, 0.56, widths.thighMid * 1.09, antSign);
    const qOutLow = bonePoint(knee, hip, 0.29, widths.thighMid * 0.88, antSign);

    const quadD = [
      `M ${pt(qStart)}`,
      `C ${pt(qOutLow)} ${pt(qOutMid)} ${pt(qOutUpper)}`,
      `C ${pt(bonePoint(knee, hip, 0.92, widths.thighMid * 0.72, antSign))} ${pt(bonePoint(knee, hip, 0.96, widths.thighMid * 0.55, antSign))} ${pt(qHipApex)}`,
      `C ${pt(bonePoint(knee, hip, 0.93, widths.thighMid * 0.16, antSign))} ${pt(bonePoint(knee, hip, 0.88, 0, antSign))} ${pt(qInnerHigh)}`,
      `C ${pt(qInnerMid)} ${pt(qInnerLow)} ${pt(qTendonTip)}`,
      `Q ${pt(bonePoint(knee, hip, 0.11, widths.knee * 0.42, antSign))} ${pt(qStart)}`,
      `Z`,
    ].join(' ');

    const stria1 = `M ${pt(bonePoint(knee, hip, 0.22, widths.thighMid * 0.54, antSign))} Q ${pt(bonePoint(knee, hip, 0.54, widths.thighMid * 0.70, antSign))} ${pt(bonePoint(knee, hip, 0.82, widths.thighMid * 0.55, antSign))}`;
    const stria2 = `M ${pt(bonePoint(knee, hip, 0.20, widths.thighMid * 0.22, antSign))} Q ${pt(bonePoint(knee, hip, 0.54, widths.thighMid * 0.32, antSign))} ${pt(bonePoint(knee, hip, 0.84, widths.thighMid * 0.22, antSign))}`;
    const stria3 = `M ${pt(bonePoint(knee, hip, 0.27, widths.thighMid * 0.78, antSign))} Q ${pt(bonePoint(knee, hip, 0.56, widths.thighMid * 0.92, antSign))} ${pt(bonePoint(knee, hip, 0.80, widths.thighMid * 0.74, antSign))}`;

    quadSvg = `<g class="muscle-quads">
      <path d="${quadD}" fill="url(#${qGradId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${stria1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.15" stroke-linecap="round" />
      <path d="${stria2}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="1.05" stroke-linecap="round" />
      <path d="${stria3}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="0.9" stroke-linecap="round" />
    </g>`;
  }

  let hamSvg = '';
  if (highlights.has('hamstrings')) {
    const hGradId = `${prefix}_ham_grad`;
    defs.push(createCylinderGradient(hGradId, knee, hip, widths.thighMid * 0.88, musclePalette));

    const hmLow = bonePoint(knee, hip, 0.16, -widths.knee * 0.58, antSign);
    const hmOutLow = bonePoint(knee, hip, 0.34, -widths.thighMid * 0.74, antSign);
    const hmOutMid = bonePoint(knee, hip, 0.62, -widths.thighMid * 0.92, antSign);
    const hmOutHigh = bonePoint(knee, hip, 0.85, -widths.thighMid * 0.84, antSign);
    const hmTop = bonePoint(knee, hip, 0.90, -widths.thighMid * 0.44, antSign);
    const hmInHigh = bonePoint(knee, hip, 0.74, -widths.thighMid * 0.10, antSign);
    const hmInMid = bonePoint(knee, hip, 0.48, -widths.thighMid * 0.04, antSign);
    const hmInLow = bonePoint(knee, hip, 0.20, -widths.knee * 0.12, antSign);

    const hamD = [
      `M ${pt(hmLow)}`,
      `C ${pt(hmOutLow)} ${pt(hmOutMid)} ${pt(hmOutHigh)}`,
      `Q ${pt(bonePoint(knee, hip, 0.92, -widths.thighMid * 0.64, antSign))} ${pt(hmTop)}`,
      `Q ${pt(bonePoint(knee, hip, 0.84, -widths.thighMid * 0.22, antSign))} ${pt(hmInHigh)}`,
      `C ${pt(hmInMid)} ${pt(hmInLow)} ${pt(hmLow)}`,
      `Z`,
    ].join(' ');

    const hs1 = `M ${pt(bonePoint(knee, hip, 0.24, -widths.thighMid * 0.38, antSign))} Q ${pt(bonePoint(knee, hip, 0.55, -widths.thighMid * 0.48, antSign))} ${pt(bonePoint(knee, hip, 0.82, -widths.thighMid * 0.42, antSign))}`;
    const hs2 = `M ${pt(bonePoint(knee, hip, 0.28, -widths.thighMid * 0.62, antSign))} Q ${pt(bonePoint(knee, hip, 0.58, -widths.thighMid * 0.76, antSign))} ${pt(bonePoint(knee, hip, 0.80, -widths.thighMid * 0.66, antSign))}`;

    hamSvg = `<g class="muscle-hamstrings">
      <path d="${hamD}" fill="url(#${hGradId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${hs1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.1" stroke-linecap="round" />
      <path d="${hs2}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="1.0" stroke-linecap="round" />
    </g>`;
  }

  return {
    defs,
    svg: `<g class="thigh">
      <path d="${thighPath}" fill="url(#${gradId})" />
      <path d="${frontEdge}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${backEdge}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      ${quadSvg}
      ${hamSvg}
    </g>`,
  };
}

/**
 * Draws smoothly rounded pelvis & gluteus maximus wrapping the hip hinge.
 */
function buildGlutes(
  knee,
  hip,
  shoulder,
  proportions,
  bodyPalette,
  musclePalette,
  highlightGlutes,
  prefix,
  antSign = 1
) {
  const { widths } = proportions;
  const defs = [];

  const thighAxis = norm(sub(hip, knee));
  const torsoAxis = norm(sub(shoulder, hip));
  const thighPost = scale(posteriorNormal(thighAxis), antSign);
  const torsoPost = scale(posteriorNormal(torsoAxis), antSign);
  const hipPost = norm(add(thighPost, torsoPost));

  const sacrum = bonePoint(hip, shoulder, 0.21, -widths.hip * 0.78, antSign);
  const gluteDome = add(hip, scale(hipPost, widths.hip * 0.96));
  const gluteFold = bonePoint(knee, hip, 0.72, -widths.thighMid * 0.88, antSign);
  const lateralHip = bonePoint(knee, hip, 0.87, widths.thighMid * 0.06, antSign);
  const iliacTop = bonePoint(hip, shoulder, 0.14, -widths.hip * 0.10, antSign);

  const domeTangent = norm(sub(gluteFold, sacrum));
  const hSacrumOut = add(sacrum, scale(hipPost, 6.5));
  const hDomeIn = add(gluteDome, scale(domeTangent, -11));
  const hDomeOut = add(gluteDome, scale(domeTangent, 11));
  const hFoldIn = add(gluteFold, scale(thighPost, 5.5));

  const palette = highlightGlutes ? musclePalette : bodyPalette;
  const gGradId = `${prefix}_glute_grad`;
  defs.push(
    createDirectionalGradient(
      gGradId,
      add(hip, scale(hipPost, -6)),
      add(gluteDome, scale(hipPost, 6)),
      palette
    )
  );

  const gluteD = [
    `M ${pt(sacrum)}`,
    `C ${pt(hSacrumOut)} ${pt(hDomeIn)} ${pt(gluteDome)}`,
    `C ${pt(hDomeOut)} ${pt(hFoldIn)} ${pt(gluteFold)}`,
    `C ${pt(lerpVec(gluteFold, lateralHip, 0.55))} ${pt(add(lateralHip, scale(thighAxis, -6)))} ${pt(lateralHip)}`,
    `Q ${pt(lerpVec(lateralHip, iliacTop, 0.5))} ${pt(iliacTop)}`,
    `Q ${pt(lerpVec(iliacTop, sacrum, 0.55))} ${pt(sacrum)}`,
    `Z`,
  ].join(' ');

  let striations = '';
  if (highlightGlutes) {
    const s1 = `M ${pt(lerpVec(sacrum, iliacTop, 0.35))} Q ${pt(lerpVec(hip, gluteDome, 0.52))} ${pt(lerpVec(lateralHip, gluteFold, 0.34))}`;
    const s2 = `M ${pt(lerpVec(sacrum, gluteDome, 0.34))} Q ${pt(lerpVec(hip, gluteDome, 0.78))} ${pt(lerpVec(gluteFold, lateralHip, 0.18))}`;
    striations = `
      <path d="${s1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.15" stroke-linecap="round" />
      <path d="${s2}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="1.05" stroke-linecap="round" />
    `;
  }

  return {
    defs,
    svg: `<g class="glutes">
      <path d="${gluteD}" fill="url(#${gGradId})" stroke="${palette.outline}" stroke-width="0.7" stroke-linejoin="round" />
      ${striations}
    </g>`,
  };
}

/**
 * Draws sculpted torso + optional pectorals highlight.
 */
function buildTorso(
  hip,
  shoulder,
  proportions,
  bodyPalette,
  musclePalette,
  highlights,
  prefix,
  antSign = 1
) {
  const { widths } = proportions;
  const gradId = `${prefix}_torso_grad`;
  const gradDef = createCylinderGradient(gradId, hip, shoulder, widths.chest, bodyPalette);
  const defs = [gradDef];

  const pAnt = bonePoint(hip, shoulder, -0.02, widths.hip * 0.70, antSign);
  const waistAnt = bonePoint(hip, shoulder, 0.36, widths.waist * 0.94, antSign);
  const ribAnt = bonePoint(hip, shoulder, 0.62, widths.chest * 0.94, antSign);
  const pecPeak = bonePoint(hip, shoulder, 0.79, widths.chest * 1.07, antSign);
  const clavAnt = bonePoint(hip, shoulder, 0.97, widths.shoulder * 0.84, antSign);

  const neckBase = bonePoint(hip, shoulder, 1.08, -2, antSign);
  const upperBack = bonePoint(hip, shoulder, 0.90, -widths.shoulder * 1.12, antSign);
  const latMid = bonePoint(hip, shoulder, 0.62, -widths.chest * 0.92, antSign);
  const lumbar = bonePoint(hip, shoulder, 0.30, -widths.waist * 0.84, antSign);
  const pPost = bonePoint(hip, shoulder, -0.03, -widths.hip * 0.84, antSign);

  const d = [
    `M ${pt(pAnt)}`,
    `C ${pt(bonePoint(hip, shoulder, 0.18, widths.waist * 0.92, antSign))} ${pt(waistAnt)} ${pt(ribAnt)}`,
    `C ${pt(bonePoint(hip, shoulder, 0.72, widths.chest * 1.07, antSign))} ${pt(pecPeak)} ${pt(clavAnt)}`,
    `Q ${pt(bonePoint(hip, shoulder, 1.07, widths.neck * 0.92, antSign))} ${pt(neckBase)}`,
    `Q ${pt(bonePoint(hip, shoulder, 1.03, -widths.neck * 1.2, antSign))} ${pt(upperBack)}`,
    `C ${pt(bonePoint(hip, shoulder, 0.76, -widths.chest * 1.04, antSign))} ${pt(latMid)} ${pt(lumbar)}`,
    `C ${pt(bonePoint(hip, shoulder, 0.12, -widths.hip * 0.84, antSign))} ${pt(pPost)} ${pt(pPost)}`,
    `Q ${pt(bonePoint(hip, shoulder, -0.08, 0, antSign))} ${pt(pAnt)}`,
    `Z`,
  ].join(' ');

  const frontEdge = `M ${pt(pAnt)} C ${pt(bonePoint(hip, shoulder, 0.18, widths.waist * 0.92, antSign))} ${pt(waistAnt)} ${pt(ribAnt)} C ${pt(bonePoint(hip, shoulder, 0.72, widths.chest * 1.07, antSign))} ${pt(pecPeak)} ${pt(clavAnt)}`;
  const backEdge = `M ${pt(upperBack)} C ${pt(bonePoint(hip, shoulder, 0.76, -widths.chest * 1.04, antSign))} ${pt(latMid)} ${pt(lumbar)} C ${pt(bonePoint(hip, shoulder, 0.12, -widths.hip * 0.84, antSign))} ${pt(pPost)} ${pt(pPost)}`;

  const pecLine = `<path d="M ${pt(bonePoint(hip, shoulder, 0.72, widths.chest * 0.25, antSign))} Q ${pt(bonePoint(hip, shoulder, 0.70, widths.chest * 0.72, antSign))} ${pt(bonePoint(hip, shoulder, 0.74, widths.chest * 1.0, antSign))}" fill="none" stroke="${bodyPalette.crease}" stroke-width="1.1" stroke-linecap="round" />`;
  const ribLine = `<path d="M ${pt(bonePoint(hip, shoulder, 0.48, widths.waist * 0.18, antSign))} Q ${pt(bonePoint(hip, shoulder, 0.56, widths.chest * 0.42, antSign))} ${pt(bonePoint(hip, shoulder, 0.66, widths.chest * 0.38, antSign))}" fill="none" stroke="${bodyPalette.crease}" stroke-width="1.0" stroke-linecap="round" />`;

  let pecSvg = '';
  if (highlights.has('pectorals')) {
    const pGradId = `${prefix}_pec_grad`;
    defs.push(
      createDirectionalGradient(
        pGradId,
        bonePoint(hip, shoulder, 0.90, widths.chest * 0.95, antSign),
        bonePoint(hip, shoulder, 0.68, widths.chest * 0.12, antSign),
        musclePalette
      )
    );

    const pecClav = bonePoint(hip, shoulder, 0.95, widths.shoulder * 0.74, antSign);
    const pecBulge = bonePoint(hip, shoulder, 0.79, widths.chest * 1.05, antSign);
    const pecLowerFront = bonePoint(hip, shoulder, 0.65, widths.chest * 0.86, antSign);
    const pecLowerInner = bonePoint(hip, shoulder, 0.69, widths.chest * 0.20, antSign);
    const pecShoulderInsert = bonePoint(hip, shoulder, 0.87, widths.chest * 0.08, antSign);

    const pecD = [
      `M ${pt(pecClav)}`,
      `C ${pt(bonePoint(hip, shoulder, 0.89, widths.chest * 1.02, antSign))} ${pt(pecBulge)} ${pt(pecLowerFront)}`,
      `Q ${pt(bonePoint(hip, shoulder, 0.63, widths.chest * 0.52, antSign))} ${pt(pecLowerInner)}`,
      `Q ${pt(bonePoint(hip, shoulder, 0.78, widths.chest * 0.04, antSign))} ${pt(pecShoulderInsert)}`,
      `Q ${pt(bonePoint(hip, shoulder, 0.94, widths.chest * 0.38, antSign))} ${pt(pecClav)}`,
      `Z`,
    ].join(' ');

    const ps1 = `M ${pt(bonePoint(hip, shoulder, 0.86, widths.chest * 0.78, antSign))} Q ${pt(bonePoint(hip, shoulder, 0.82, widths.chest * 0.45, antSign))} ${pt(bonePoint(hip, shoulder, 0.84, widths.chest * 0.16, antSign))}`;
    const ps2 = `M ${pt(bonePoint(hip, shoulder, 0.74, widths.chest * 0.86, antSign))} Q ${pt(bonePoint(hip, shoulder, 0.74, widths.chest * 0.52, antSign))} ${pt(bonePoint(hip, shoulder, 0.80, widths.chest * 0.22, antSign))}`;

    pecSvg = `<g class="muscle-pectorals">
      <path d="${pecD}" fill="url(#${pGradId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${ps1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.1" stroke-linecap="round" />
      <path d="${ps2}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="1.0" stroke-linecap="round" />
    </g>`;
  }

  let latsSvg = '';
  if (highlights.has('lats')) {
    const lGradId = `${prefix}_lats_grad`;
    defs.push(
      createDirectionalGradient(
        lGradId,
        bonePoint(hip, shoulder, 0.78, -widths.chest * 0.18, antSign),
        bonePoint(hip, shoulder, 0.28, -widths.waist * 0.82, antSign),
        musclePalette
      )
    );

    const latBot = bonePoint(hip, shoulder, 0.22, -widths.waist * 0.76, antSign);
    const latBackLow = bonePoint(hip, shoulder, 0.42, -widths.waist * 0.86, antSign);
    const latBackHigh = bonePoint(hip, shoulder, 0.66, -widths.chest * 0.94, antSign);
    const latUpperBack = bonePoint(hip, shoulder, 0.79, -widths.chest * 0.74, antSign);
    const latAxilla = bonePoint(hip, shoulder, 0.83, -widths.chest * 0.10, antSign);
    const latLatMid = bonePoint(hip, shoulder, 0.56, -widths.chest * 0.14, antSign);
    const latLatLow = bonePoint(hip, shoulder, 0.34, -widths.waist * 0.34, antSign);

    const latsD = [
      `M ${pt(latBot)}`,
      `C ${pt(latBackLow)} ${pt(latBackHigh)} ${pt(latUpperBack)}`,
      `Q ${pt(bonePoint(hip, shoulder, 0.85, -widths.chest * 0.42, antSign))} ${pt(latAxilla)}`,
      `C ${pt(bonePoint(hip, shoulder, 0.72, -widths.chest * 0.06, antSign))} ${pt(latLatMid)} ${pt(latLatLow)}`,
      `Q ${pt(bonePoint(hip, shoulder, 0.25, -widths.waist * 0.52, antSign))} ${pt(latBot)}`,
      `Z`,
    ].join(' ');

    const ls1 = `M ${pt(bonePoint(hip, shoulder, 0.34, -widths.waist * 0.64, antSign))} Q ${pt(bonePoint(hip, shoulder, 0.58, -widths.chest * 0.52, antSign))} ${pt(bonePoint(hip, shoulder, 0.78, -widths.chest * 0.22, antSign))}`;
    const ls2 = `M ${pt(bonePoint(hip, shoulder, 0.46, -widths.chest * 0.74, antSign))} Q ${pt(bonePoint(hip, shoulder, 0.66, -widths.chest * 0.58, antSign))} ${pt(bonePoint(hip, shoulder, 0.80, -widths.chest * 0.32, antSign))}`;

    latsSvg = `<g class="muscle-lats">
      <path d="${latsD}" fill="url(#${lGradId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${ls1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.1" stroke-linecap="round" />
      <path d="${ls2}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="1.0" stroke-linecap="round" />
    </g>`;
  }

  let rhomboidsSvg = '';
  if (highlights.has('rhomboids')) {
    const rGradId = `${prefix}_rhomb_grad`;
    defs.push(
      createDirectionalGradient(
        rGradId,
        bonePoint(hip, shoulder, 0.90, -widths.chest * 0.48, antSign),
        bonePoint(hip, shoulder, 0.70, -widths.chest * 0.92, antSign),
        musclePalette
      )
    );

    const rhBotPost = bonePoint(hip, shoulder, 0.68, -widths.chest * 0.90, antSign);
    const rhTopPost = bonePoint(hip, shoulder, 0.92, -widths.shoulder * 1.06, antSign);
    const rhTopAnt = bonePoint(hip, shoulder, 0.90, -widths.chest * 0.44, antSign);
    const rhBotAnt = bonePoint(hip, shoulder, 0.72, -widths.chest * 0.34, antSign);

    const rhD = [
      `M ${pt(rhBotPost)}`,
      `C ${pt(bonePoint(hip, shoulder, 0.78, -widths.chest * 1.02, antSign))} ${pt(bonePoint(hip, shoulder, 0.86, -widths.shoulder * 1.12, antSign))} ${pt(rhTopPost)}`,
      `Q ${pt(bonePoint(hip, shoulder, 0.94, -widths.chest * 0.72, antSign))} ${pt(rhTopAnt)}`,
      `Q ${pt(bonePoint(hip, shoulder, 0.80, -widths.chest * 0.30, antSign))} ${pt(rhBotAnt)}`,
      `Q ${pt(bonePoint(hip, shoulder, 0.68, -widths.chest * 0.64, antSign))} ${pt(rhBotPost)}`,
      `Z`,
    ].join(' ');

    const rs1 = `M ${pt(bonePoint(hip, shoulder, 0.87, -widths.chest * 0.88, antSign))} Q ${pt(bonePoint(hip, shoulder, 0.84, -widths.chest * 0.68, antSign))} ${pt(bonePoint(hip, shoulder, 0.80, -widths.chest * 0.48, antSign))}`;
    const rs2 = `M ${pt(bonePoint(hip, shoulder, 0.77, -widths.chest * 0.88, antSign))} Q ${pt(bonePoint(hip, shoulder, 0.75, -widths.chest * 0.66, antSign))} ${pt(bonePoint(hip, shoulder, 0.73, -widths.chest * 0.46, antSign))}`;

    rhomboidsSvg = `<g class="muscle-rhomboids">
      <path d="${rhD}" fill="url(#${rGradId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${rs1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.05" stroke-linecap="round" />
      <path d="${rs2}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="0.95" stroke-linecap="round" />
    </g>`;
  }

  return {
    defs,
    svg: `<g class="torso">
      <path d="${d}" fill="url(#${gradId})" />
      <path d="${frontEdge}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${backEdge}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      ${pecLine}
      ${ribLine}
      ${pecSvg}
      ${latsSvg}
      ${rhomboidsSvg}
    </g>`,
  };
}

/**
 * Draws sculpted neck and side-profile head.
 */
function buildHeadAndNeck(shoulder, neckTop, headCenter, headPitch, proportions, palette, prefix, antSign = 1) {
  const { widths, segments } = proportions;
  const r = segments.headRadius;

  const neckGradId = `${prefix}_neck_grad`;
  const neckGrad = createCylinderGradient(neckGradId, shoulder, neckTop, widths.neck, palette);

  const nAntBase = bonePoint(shoulder, neckTop, -0.35, widths.neck * 1.02, antSign);
  const nAntTop = bonePoint(shoulder, neckTop, 1.35, widths.neck * 0.76, antSign);
  const nPostTop = bonePoint(shoulder, neckTop, 1.35, -widths.neck * 0.90, antSign);
  const nPostBase = bonePoint(shoulder, neckTop, -0.20, -widths.neck * 1.32, antSign);

  const neckD = `M ${pt(nAntBase)} Q ${pt(bonePoint(shoulder, neckTop, 0.55, widths.neck * 0.80, antSign))} ${pt(nAntTop)} L ${pt(nPostTop)} Q ${pt(bonePoint(shoulder, neckTop, 0.45, -widths.neck * 1.02, antSign))} ${pt(nPostBase)} Z`;
  const neckFront = `M ${pt(bonePoint(shoulder, neckTop, 0.12, widths.neck * 0.95, antSign))} Q ${pt(bonePoint(shoulder, neckTop, 0.65, widths.neck * 0.78, antSign))} ${pt(bonePoint(shoulder, neckTop, 1.05, widths.neck * 0.76, antSign))}`;
  const neckBack = `M ${pt(bonePoint(shoulder, neckTop, 0.0, -widths.neck * 1.18, antSign))} Q ${pt(bonePoint(shoulder, neckTop, 0.55, -widths.neck * 0.98, antSign))} ${pt(bonePoint(shoulder, neckTop, 1.05, -widths.neck * 0.88, antSign))}`;

  const headGradId = `${prefix}_head_grad`;
  const headGrad = createDirectionalGradient(
    headGradId,
    { x: headCenter.x + r * 0.7, y: headCenter.y - r * 0.9 },
    { x: headCenter.x - r * 0.9, y: headCenter.y + r * 0.9 },
    palette
  );

  const cx = headCenter.x;
  const cy = headCenter.y;
  const headD = [
    `M ${f(cx - r * 0.42)},${f(cy + r * 0.88)}`,
    `C ${f(cx - r * 0.95)},${f(cy + r * 0.60)} ${f(cx - r * 1.00)},${f(cy - r * 0.22)} ${f(cx - r * 0.76)},${f(cy - r * 0.72)}`,
    `C ${f(cx - r * 0.44)},${f(cy - r * 1.15)} ${f(cx + r * 0.38)},${f(cy - r * 1.14)} ${f(cx + r * 0.76)},${f(cy - r * 0.70)}`,
    `C ${f(cx + r * 0.90)},${f(cy - r * 0.46)} ${f(cx + r * 0.88)},${f(cy - r * 0.26)} ${f(cx + r * 0.86)},${f(cy - r * 0.16)}`,
    `L ${f(cx + r * 1.08)},${f(cy + r * 0.14)}`,
    `C ${f(cx + r * 1.10)},${f(cy + r * 0.22)} ${f(cx + r * 0.98)},${f(cy + r * 0.27)} ${f(cx + r * 0.88)},${f(cy + r * 0.29)}`,
    `L ${f(cx + r * 0.91)},${f(cy + r * 0.46)}`,
    `L ${f(cx + r * 0.82)},${f(cy + r * 0.54)}`,
    `C ${f(cx + r * 0.88)},${f(cy + r * 0.68)} ${f(cx + r * 0.80)},${f(cy + r * 0.84)} ${f(cx + r * 0.62)},${f(cy + r * 0.88)}`,
    `C ${f(cx + r * 0.28)},${f(cy + r * 0.94)} ${f(cx - r * 0.12)},${f(cy + r * 0.94)} ${f(cx - r * 0.42)},${f(cy + r * 0.88)}`,
    `Z`,
  ].join(' ');

  const jawShadow = `<path d="M ${f(cx - r * 0.16)},${f(cy + r * 0.28)} Q ${f(cx + r * 0.06)},${f(cy + r * 0.68)} ${f(cx - r * 0.30)},${f(cy + r * 0.80)}" fill="none" stroke="${palette.crease}" stroke-width="0.95" stroke-linecap="round" />`;
  const earHint = `<ellipse cx="${f(cx - r * 0.24)}" cy="${f(cy + r * 0.16)}" rx="3.3" ry="5.4" fill="${palette.mid}" stroke="${palette.crease}" stroke-width="0.65" />`;

  return {
    defs: [neckGrad, headGrad],
    svg: `<g class="head-neck">
      <path d="${neckD}" fill="url(#${neckGradId})" />
      <path d="${neckFront}" fill="none" stroke="${palette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${neckBack}" fill="none" stroke="${palette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <g transform="rotate(${f(headPitch)} ${f(cx)} ${f(cy)})">
        <path d="${headD}" fill="url(#${headGradId})" stroke="${palette.outline}" stroke-width="0.75" stroke-linejoin="round" />
        ${jawShadow}
        ${earHint}
      </g>
    </g>`,
  };
}

/**
 * Draws sculpted arm (deltoid cap, upper arm, forearm, hand) + optional triceps/deltoid highlight.
 */
function buildArm(
  shoulder,
  elbow,
  wrist,
  handTip,
  proportions,
  bodyPalette,
  musclePalette,
  highlights,
  prefix
) {
  const { widths } = proportions;
  const uaGradId = `${prefix}_ua_grad`;
  const faGradId = `${prefix}_fa_grad`;
  const handGradId = `${prefix}_hand_grad`;

  const uaGrad = createCylinderGradient(uaGradId, shoulder, elbow, widths.bicep, bodyPalette);
  const faGrad = createCylinderGradient(faGradId, elbow, wrist, widths.forearmPeak, bodyPalette);
  const handGrad = createCylinderGradient(handGradId, wrist, handTip, widths.wrist, bodyPalette);
  const defs = [uaGrad, faGrad, handGrad];

  const uaDir = norm(sub(elbow, shoulder));
  const uaBi = posteriorNormal(uaDir);
  const uaTri = anteriorNormal(uaDir);

  const shCap = add(shoulder, scale(uaDir, -widths.shoulder * 0.58));
  const shBi = add(shoulder, scale(uaBi, widths.shoulder * 0.84));
  const shTri = add(shoulder, scale(uaTri, widths.shoulder * 0.86));
  const biMid = add(lerpVec(shoulder, elbow, 0.48), scale(uaBi, widths.bicep * 1.08));
  const triMid = add(lerpVec(shoulder, elbow, 0.45), scale(uaTri, widths.bicep * 1.00));
  const elBi = add(elbow, scale(uaBi, widths.elbow * 0.95));
  const elTri = add(elbow, scale(uaTri, widths.elbow * 0.98));
  const elTip = add(elbow, scale(uaDir, widths.elbow * 0.72));

  const upperArmD = [
    `M ${pt(shCap)}`,
    `C ${pt(add(shCap, scale(uaBi, widths.shoulder * 0.78)))} ${pt(shBi)} ${pt(biMid)}`,
    `Q ${pt(lerpVec(biMid, elBi, 0.65))} ${pt(elBi)}`,
    `Q ${pt(add(elTip, scale(uaBi, widths.elbow * 0.45)))} ${pt(elTip)}`,
    `Q ${pt(add(elTip, scale(uaTri, widths.elbow * 0.45)))} ${pt(elTri)}`,
    `Q ${pt(lerpVec(elTri, triMid, 0.5))} ${pt(triMid)}`,
    `C ${pt(shTri)} ${pt(add(shCap, scale(uaTri, widths.shoulder * 0.78)))} ${pt(shCap)}`,
    `Z`,
  ].join(' ');

  const faDir = norm(sub(wrist, elbow));
  const faTop = posteriorNormal(faDir);
  const faBot = anteriorNormal(faDir);

  const faElbowCap = add(elbow, scale(faDir, -widths.elbow * 0.72));
  const faTopStart = add(elbow, scale(faTop, widths.elbow * 0.95));
  const faTopPeak = add(lerpVec(elbow, wrist, 0.30), scale(faTop, widths.forearmPeak * 1.12));
  const faWristTop = add(wrist, scale(faTop, widths.wrist * 0.92));
  const faWristBot = add(wrist, scale(faBot, widths.wrist * 0.92));
  const faBotPeak = add(lerpVec(elbow, wrist, 0.32), scale(faBot, widths.forearmPeak * 0.98));
  const faBotStart = add(elbow, scale(faBot, widths.elbow * 0.95));

  const forearmD = [
    `M ${pt(faElbowCap)}`,
    `Q ${pt(add(faElbowCap, scale(faTop, widths.elbow * 0.8)))} ${pt(faTopStart)}`,
    `C ${pt(faTopPeak)} ${pt(lerpVec(faTopPeak, faWristTop, 0.6))} ${pt(faWristTop)}`,
    `L ${pt(faWristBot)}`,
    `C ${pt(lerpVec(faWristBot, faBotPeak, 0.45))} ${pt(faBotPeak)} ${pt(faBotStart)}`,
    `Q ${pt(add(faElbowCap, scale(faBot, widths.elbow * 0.8)))} ${pt(faElbowCap)}`,
    `Z`,
  ].join(' ');

  const hDir = norm(sub(handTip, wrist));
  const hTop = posteriorNormal(hDir);
  const hBot = anteriorNormal(hDir);

  const hWristTop = add(wrist, scale(hTop, widths.wrist * 0.88));
  const hWristBot = add(wrist, scale(hBot, widths.wrist * 0.88));
  const hKnuckle = add(lerpVec(wrist, handTip, 0.56), scale(hTop, widths.wrist * 1.15));
  const hTipTop = add(handTip, scale(hTop, widths.wrist * 0.65));
  const hTipBot = add(handTip, scale(hBot, widths.wrist * 0.72));
  const hPalm = add(lerpVec(wrist, handTip, 0.5), scale(hBot, widths.wrist * 1.05));

  const handD = [
    `M ${pt(hWristTop)}`,
    `Q ${pt(hKnuckle)} ${pt(hTipTop)}`,
    `Q ${pt(add(handTip, scale(hDir, 3.5)))} ${pt(hTipBot)}`,
    `Q ${pt(hPalm)} ${pt(hWristBot)}`,
    `Z`,
  ].join(' ');

  const uaOuter = `M ${pt(shCap)} C ${pt(add(shCap, scale(uaBi, widths.shoulder * 0.78)))} ${pt(shBi)} ${pt(biMid)} Q ${pt(lerpVec(biMid, elBi, 0.65))} ${pt(elBi)}`;
  const uaBack = `M ${pt(elTri)} Q ${pt(lerpVec(elTri, triMid, 0.5))} ${pt(triMid)} C ${pt(shTri)} ${pt(add(shCap, scale(uaTri, widths.shoulder * 0.78)))} ${pt(shCap)}`;
  const faOuter = `M ${pt(faTopStart)} C ${pt(faTopPeak)} ${pt(lerpVec(faTopPeak, faWristTop, 0.6))} ${pt(faWristTop)}`;
  const faBack = `M ${pt(faWristBot)} C ${pt(lerpVec(faWristBot, faBotPeak, 0.45))} ${pt(faBotPeak)} ${pt(faBotStart)}`;

  const deltoidCurve = `<path d="M ${pt(add(shoulder, scale(uaBi, widths.shoulder * 0.55)))} Q ${pt(add(shoulder, scale(uaDir, widths.shoulder * 0.82)))} ${pt(add(shoulder, scale(uaTri, widths.shoulder * 0.65)))}" fill="none" stroke="${bodyPalette.crease}" stroke-width="1.0" stroke-linecap="round" />`;
  const elbowCrease = `<path d="M ${pt(add(elbow, scale(uaBi, widths.elbow * 0.55)))} Q ${pt(elbow)} ${pt(add(elbow, scale(uaTri, widths.elbow * 0.15)))}" fill="none" stroke="${bodyPalette.crease}" stroke-width="0.9" stroke-linecap="round" />`;

  let triSvg = '';
  if (highlights && highlights.has('triceps')) {
    const tGradId = `${prefix}_triceps_grad`;
    defs.push(createCylinderGradient(tGradId, shoulder, elbow, widths.bicep * 0.88, musclePalette));

    const tTop = add(lerpVec(shoulder, elbow, 0.16), scale(uaTri, widths.shoulder * 0.62));
    const tMid = add(lerpVec(shoulder, elbow, 0.46), scale(uaTri, widths.bicep * 0.94));
    const tLow = add(lerpVec(shoulder, elbow, 0.80), scale(uaTri, widths.elbow * 0.74));
    const tInLow = add(lerpVec(shoulder, elbow, 0.76), scale(uaTri, widths.elbow * 0.08));
    const tInMid = add(lerpVec(shoulder, elbow, 0.48), scale(uaBi, widths.bicep * 0.06));
    const tInTop = add(lerpVec(shoulder, elbow, 0.22), scale(uaTri, widths.shoulder * 0.14));

    const triD = [
      `M ${pt(tTop)}`,
      `C ${pt(add(lerpVec(shoulder, elbow, 0.28), scale(uaTri, widths.bicep * 0.92)))} ${pt(tMid)} ${pt(tLow)}`,
      `Q ${pt(add(lerpVec(shoulder, elbow, 0.84), scale(uaTri, widths.elbow * 0.35)))} ${pt(tInLow)}`,
      `C ${pt(tInMid)} ${pt(tInTop)} ${pt(tTop)}`,
      `Z`,
    ].join(' ');

    const ts1 = `M ${pt(add(lerpVec(shoulder, elbow, 0.24), scale(uaTri, widths.bicep * 0.42)))} Q ${pt(add(lerpVec(shoulder, elbow, 0.48), scale(uaTri, widths.bicep * 0.56)))} ${pt(add(lerpVec(shoulder, elbow, 0.74), scale(uaTri, widths.elbow * 0.40)))}`;

    triSvg = `<g class="muscle-triceps">
      <path d="${triD}" fill="url(#${tGradId})" stroke="${musclePalette.outline}" stroke-width="0.6" opacity="0.96" />
      <path d="${ts1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.0" stroke-linecap="round" />
    </g>`;
  }

  return {
    defs,
    svg: `<g class="arm">
      <path d="${upperArmD}" fill="url(#${uaGradId})" />
      <path d="${forearmD}" fill="url(#${faGradId})" />
      <path d="${handD}" fill="url(#${handGradId})" stroke="${bodyPalette.outline}" stroke-width="0.7" stroke-linejoin="round" />
      <path d="${uaOuter}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${uaBack}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${faOuter}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${faBack}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      ${deltoidCurve}
      ${elbowCrease}
      ${triSvg}
    </g>`,
  };
}

module.exports = {
  buildFoot,
  buildShin,
  buildThigh,
  buildGlutes,
  buildTorso,
  buildHeadAndNeck,
  buildArm,
};
