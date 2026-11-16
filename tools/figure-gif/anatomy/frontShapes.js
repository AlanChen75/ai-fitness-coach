/**
 * Sculpted anatomical SVG geometry & 3D shading builders for front view.
 * Matches the studio-lit 3D mannequin style of side view with bone-attached
 * front-facing muscle overlays (core, hipFlexors, quadriceps, adductors,
 * gluteusMedius, glutes, deltoids, calves).
 */

const {
  add,
  sub,
  scale,
  norm,
  lerp,
  lerpVec,
  anteriorNormal,
  posteriorNormal,
  f,
  pt,
  createCylinderGradient,
  createDirectionalGradient,
} = require('./svgUtils');

function segPt(p1, p2, t, lateralOffset) {
  const axis = norm(sub(p2, p1));
  const lat = anteriorNormal(axis);
  return add(lerpVec(p1, p2, t), scale(lat, lateralOffset));
}

function buildFrontFoot(ankle, soleY, footTurnOut, proportions, palette, prefix) {
  const { front } = proportions;
  const hw = front.footHalfW;
  const heelW = hw * 0.72;
  const toeW = hw * 1.06;

  const gradId = `${prefix}_ffoot_grad`;
  const gradDef = createDirectionalGradient(
    gradId,
    { x: ankle.x - hw, y: ankle.y - 4 },
    { x: ankle.x + hw, y: soleY },
    palette
  );

  const shiftX = footTurnOut * 0.14;
  const topL = { x: ankle.x - front.ankle * 0.92, y: ankle.y - 4 };
  const topR = { x: ankle.x + front.ankle * 0.92, y: ankle.y - 4 };
  const midL = { x: ankle.x - heelW + shiftX * 0.4, y: lerp(ankle.y, soleY, 0.52) };
  const midR = { x: ankle.x + heelW + shiftX * 0.4, y: lerp(ankle.y, soleY, 0.52) };
  const toeL = { x: ankle.x - toeW + shiftX, y: soleY - 3.5 };
  const toeR = { x: ankle.x + toeW + shiftX, y: soleY - 3.5 };
  const soleL = { x: ankle.x - toeW * 0.85 + shiftX, y: soleY };
  const soleR = { x: ankle.x + toeW * 0.85 + shiftX, y: soleY };

  const d = [
    `M ${pt(topL)}`,
    `C ${pt(midL)} ${pt(toeL)} ${pt(soleL)}`,
    `Q ${pt({ x: ankle.x + shiftX, y: soleY + 1.2 })} ${pt(soleR)}`,
    `C ${pt(toeR)} ${pt(midR)} ${pt(topR)}`,
    `Z`,
  ].join(' ');

  const outerStroke = [
    `M ${pt(topL)}`,
    `C ${pt(midL)} ${pt(toeL)} ${pt(soleL)}`,
    `Q ${pt({ x: ankle.x + shiftX, y: soleY + 1.2 })} ${pt(soleR)}`,
    `C ${pt(toeR)} ${pt(midR)} ${pt(topR)}`,
  ].join(' ');

  const malleolus = `<ellipse cx="${f(ankle.x - front.ankle * 0.45)}" cy="${f(ankle.y + 1)}" rx="3.2" ry="3.6" fill="${palette.light}" opacity="0.45" />`;

  return {
    defs: [gradDef],
    svg: `<g class="front-foot">
      <path d="${d}" fill="url(#${gradId})" />
      <path d="${outerStroke}" fill="none" stroke="${palette.outline}" stroke-width="0.75" stroke-linejoin="round" stroke-linecap="round" />
      ${malleolus}
    </g>`,
  };
}

function buildFrontShin(ankle, knee, sideSign, proportions, bodyPalette, musclePalette, highlights, prefix) {
  const { front } = proportions;
  const gradId = `${prefix}_fshin_grad`;
  const gradDef = createCylinderGradient(gradId, ankle, knee, front.calfPeak, bodyPalette);
  const defs = [gradDef];

  const aL = segPt(ankle, knee, -0.02, -front.ankle * 0.96);
  const aR = segPt(ankle, knee, -0.02, front.ankle * 0.96);
  const cMidL = segPt(ankle, knee, 0.56, -front.calfPeak * (sideSign < 0 ? 1.04 : 0.94));
  const cMidR = segPt(ankle, knee, 0.56, front.calfPeak * (sideSign > 0 ? 1.04 : 0.94));
  const kL = segPt(ankle, knee, 0.98, -front.knee * 0.98);
  const kR = segPt(ankle, knee, 0.98, front.knee * 0.98);
  const kTop = segPt(ankle, knee, 1.06, 0);

  const d = [
    `M ${pt(aL)}`,
    `C ${pt(segPt(ankle, knee, 0.28, -front.ankle * 1.1))} ${pt(cMidL)} ${pt(kL)}`,
    `Q ${pt(kTop)} ${pt(kR)}`,
    `C ${pt(cMidR)} ${pt(segPt(ankle, knee, 0.28, front.ankle * 1.1))} ${pt(aR)}`,
    `Z`,
  ].join(' ');

  const edgeL = `M ${pt(aL)} C ${pt(segPt(ankle, knee, 0.28, -front.ankle * 1.1))} ${pt(cMidL)} ${pt(kL)}`;
  const edgeR = `M ${pt(kR)} C ${pt(cMidR)} ${pt(segPt(ankle, knee, 0.28, front.ankle * 1.1))} ${pt(aR)}`;

  let calfSvg = '';
  if (highlights.has('calves')) {
    const cgId = `${prefix}_fcalf_grad`;
    defs.push(createCylinderGradient(cgId, ankle, knee, front.calfPeak * 0.9, musclePalette));

    // Medial and lateral gastrocnemius heads bulging on upper-mid shin
    const makeHead = (dirSign, bulgeScale) => {
      const p0 = segPt(ankle, knee, 0.36, dirSign * front.ankle * 0.72);
      const p1 = segPt(ankle, knee, 0.58, dirSign * front.calfPeak * bulgeScale);
      const p2 = segPt(ankle, knee, 0.84, dirSign * front.knee * 0.84);
      const p3 = segPt(ankle, knee, 0.88, dirSign * front.knee * 0.22);
      const p4 = segPt(ankle, knee, 0.62, dirSign * front.calfPeak * 0.28);
      const p5 = segPt(ankle, knee, 0.36, dirSign * front.ankle * 0.22);
      return [
        `M ${pt(p0)}`,
        `C ${pt(segPt(ankle, knee, 0.48, dirSign * front.calfPeak * bulgeScale))} ${pt(p1)} ${pt(p2)}`,
        `Q ${pt(segPt(ankle, knee, 0.88, dirSign * front.knee * 0.54))} ${pt(p3)}`,
        `C ${pt(p4)} ${pt(p5)} ${pt(p0)}`,
        `Z`,
      ].join(' ');
    };

    const headL = makeHead(-1, sideSign < 0 ? 1.02 : 0.92);
    const headR = makeHead(1, sideSign > 0 ? 1.02 : 0.92);
    const sL = `M ${pt(segPt(ankle, knee, 0.44, -front.calfPeak * 0.56))} Q ${pt(segPt(ankle, knee, 0.62, -front.calfPeak * 0.74))} ${pt(segPt(ankle, knee, 0.80, -front.knee * 0.52))}`;
    const sR = `M ${pt(segPt(ankle, knee, 0.44, front.calfPeak * 0.56))} Q ${pt(segPt(ankle, knee, 0.62, front.calfPeak * 0.74))} ${pt(segPt(ankle, knee, 0.80, front.knee * 0.52))}`;

    calfSvg = `<g class="muscle-calves">
      <path d="${headL}" fill="url(#${cgId})" stroke="${musclePalette.outline}" stroke-width="0.6" opacity="0.95" />
      <path d="${headR}" fill="url(#${cgId})" stroke="${musclePalette.outline}" stroke-width="0.6" opacity="0.95" />
      <path d="${sL}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="0.95" stroke-linecap="round" />
      <path d="${sR}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="0.95" stroke-linecap="round" />
    </g>`;
  }

  return {
    defs,
    svg: `<g class="front-shin">
      <path d="${d}" fill="url(#${gradId})" />
      <path d="${edgeL}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${edgeR}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      ${calfSvg}
    </g>`,
  };
}

function buildFrontThigh(
  hip,
  knee,
  sideSign,
  kneeDepth,
  proportions,
  bodyPalette,
  musclePalette,
  highlights,
  prefix
) {
  const { front } = proportions;
  const gradId = `${prefix}_fthigh_grad`;
  const gradDef = createCylinderGradient(gradId, knee, hip, front.thighMid, bodyPalette);
  const defs = [gradDef];

  // Note: segment runs knee -> hip so lateral normal aligns with +x (screen right)
  const kScale = 1 + kneeDepth * 0.14;
  const kL = segPt(knee, hip, -0.02, -front.knee * 1.02 * kScale);
  const kR = segPt(knee, hip, -0.02, front.knee * 1.02 * kScale);
  const kCap = segPt(knee, hip, -0.10, 0);

  const outScale = sideSign < 0 ? -1 : 1; // outer lateral side of this leg
  const inScale = -outScale; // inner medial side of this leg

  const midOut = segPt(knee, hip, 0.56, outScale * front.thighMid * 1.06);
  const midIn = segPt(knee, hip, 0.52, inScale * front.thighMid * 0.92);
  const hOut = segPt(knee, hip, 0.96, outScale * front.thighMid * 0.90);
  const hIn = segPt(knee, hip, 0.94, inScale * front.thighMid * 0.72);
  const hTop = segPt(knee, hip, 1.04, 0);

  const kOut = outScale < 0 ? kL : kR;
  const kIn = outScale < 0 ? kR : kL;

  const d = [
    `M ${pt(kCap)}`,
    `Q ${pt(segPt(knee, hip, -0.04, outScale * front.knee * 0.98 * kScale))} ${pt(kOut)}`,
    `C ${pt(segPt(knee, hip, 0.28, outScale * front.thighMid * 0.94))} ${pt(midOut)} ${pt(hOut)}`,
    `Q ${pt(hTop)} ${pt(hIn)}`,
    `C ${pt(midIn)} ${pt(segPt(knee, hip, 0.26, inScale * front.thighMid * 0.78))} ${pt(kIn)}`,
    `Q ${pt(segPt(knee, hip, -0.04, inScale * front.knee * 0.98 * kScale))} ${pt(kCap)}`,
    `Z`,
  ].join(' ');

  const edgeOut = `M ${pt(kOut)} C ${pt(segPt(knee, hip, 0.28, outScale * front.thighMid * 0.94))} ${pt(midOut)} ${pt(hOut)}`;
  const edgeIn = `M ${pt(hIn)} C ${pt(midIn)} ${pt(segPt(knee, hip, 0.26, inScale * front.thighMid * 0.78))} ${pt(kIn)}`;
  const patella = `<ellipse cx="${f(knee.x)}" cy="${f(knee.y)}" rx="${f(front.knee * 0.56 * kScale)}" ry="${f(front.knee * 0.46 * kScale)}" fill="${bodyPalette.highlight}" opacity="${f(0.32 + kneeDepth * 0.35)}" stroke="${bodyPalette.crease}" stroke-width="0.65" />`;

  let quadSvg = '';
  if (highlights.has('quadriceps')) {
    const qgId = `${prefix}_fquad_grad`;
    defs.push(createCylinderGradient(qgId, knee, hip, front.thighMid * 0.85, musclePalette));

    const qStart = segPt(knee, hip, 0.14, 0);
    const qOutL = segPt(knee, hip, 0.32, outScale * front.thighMid * 0.80);
    const qOutH = segPt(knee, hip, 0.76, outScale * front.thighMid * 0.78);
    const qTop = segPt(knee, hip, 0.92, outScale * front.thighMid * 0.22);
    const qInH = segPt(knee, hip, 0.74, inScale * front.thighMid * 0.54);
    const qInL = segPt(knee, hip, 0.28, inScale * front.thighMid * 0.56);

    const quadD = [
      `M ${pt(qStart)}`,
      `C ${pt(qOutL)} ${pt(qOutH)} ${pt(qTop)}`,
      `C ${pt(segPt(knee, hip, 0.88, inScale * front.thighMid * 0.22))} ${pt(qInH)} ${pt(qInL)}`,
      `Q ${pt(segPt(knee, hip, 0.14, inScale * front.knee * 0.35))} ${pt(qStart)}`,
      `Z`,
    ].join(' ');

    const qs1 = `M ${pt(segPt(knee, hip, 0.22, outScale * front.thighMid * 0.32))} Q ${pt(segPt(knee, hip, 0.55, outScale * front.thighMid * 0.42))} ${pt(segPt(knee, hip, 0.82, outScale * front.thighMid * 0.26))}`;
    const qs2 = `M ${pt(segPt(knee, hip, 0.24, inScale * front.thighMid * 0.24))} Q ${pt(segPt(knee, hip, 0.55, inScale * front.thighMid * 0.22))} ${pt(segPt(knee, hip, 0.80, inScale * front.thighMid * 0.10))}`;

    quadSvg = `<g class="muscle-quads">
      <path d="${quadD}" fill="url(#${qgId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${qs1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.05" stroke-linecap="round" />
      <path d="${qs2}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="1.0" stroke-linecap="round" />
    </g>`;
  }

  let adductorSvg = '';
  if (highlights.has('adductors')) {
    const agId = `${prefix}_fadd_grad`;
    defs.push(createCylinderGradient(agId, knee, hip, front.thighMid * 0.65, musclePalette));

    const aOrigin = segPt(knee, hip, 0.94, inScale * front.thighMid * 0.66);
    const aMidIn = segPt(knee, hip, 0.60, inScale * front.thighMid * 0.88);
    const aLowIn = segPt(knee, hip, 0.28, inScale * front.thighMid * 0.66);
    const aTip = segPt(knee, hip, 0.22, inScale * front.knee * 0.32);
    const aMidLat = segPt(knee, hip, 0.56, inScale * front.thighMid * 0.24);
    const aHighLat = segPt(knee, hip, 0.86, inScale * front.thighMid * 0.14);

    const addD = [
      `M ${pt(aOrigin)}`,
      `C ${pt(segPt(knee, hip, 0.80, inScale * front.thighMid * 0.86))} ${pt(aMidIn)} ${pt(aLowIn)}`,
      `Q ${pt(segPt(knee, hip, 0.22, inScale * front.thighMid * 0.48))} ${pt(aTip)}`,
      `C ${pt(aMidLat)} ${pt(aHighLat)} ${pt(aOrigin)}`,
      `Z`,
    ].join(' ');

    const as1 = `M ${pt(segPt(knee, hip, 0.82, inScale * front.thighMid * 0.48))} Q ${pt(segPt(knee, hip, 0.55, inScale * front.thighMid * 0.58))} ${pt(segPt(knee, hip, 0.32, inScale * front.thighMid * 0.42))}`;

    adductorSvg = `<g class="muscle-adductors">
      <path d="${addD}" fill="url(#${agId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${as1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.05" stroke-linecap="round" />
    </g>`;
  }

  let hipFlexorSvg = '';
  if (highlights.has('hipFlexors')) {
    const hgId = `${prefix}_fhf_grad`;
    defs.push(createCylinderGradient(hgId, knee, hip, front.thighMid * 0.7, musclePalette));

    const hfTopOut = segPt(knee, hip, 1.01, outScale * front.thighMid * 0.58);
    const hfTopIn = segPt(knee, hip, 0.96, inScale * front.thighMid * 0.12);
    const hfMidIn = segPt(knee, hip, 0.74, inScale * front.thighMid * 0.24);
    const hfTip = segPt(knee, hip, 0.62, outScale * front.thighMid * 0.08);
    const hfMidOut = segPt(knee, hip, 0.78, outScale * front.thighMid * 0.66);

    const hfD = [
      `M ${pt(hfTopOut)}`,
      `Q ${pt(segPt(knee, hip, 1.03, outScale * front.thighMid * 0.22))} ${pt(hfTopIn)}`,
      `Q ${pt(hfMidIn)} ${pt(hfTip)}`,
      `Q ${pt(hfMidOut)} ${pt(hfTopOut)}`,
      `Z`,
    ].join(' ');

    const hs1 = `M ${pt(segPt(knee, hip, 0.96, outScale * front.thighMid * 0.34))} Q ${pt(segPt(knee, hip, 0.80, outScale * front.thighMid * 0.24))} ${pt(segPt(knee, hip, 0.68, outScale * front.thighMid * 0.14))}`;

    hipFlexorSvg = `<g class="muscle-hip-flexors">
      <path d="${hfD}" fill="url(#${hgId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${hs1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.05" stroke-linecap="round" />
    </g>`;
  }

  return {
    defs,
    svg: `<g class="front-thigh">
      <path d="${d}" fill="url(#${gradId})" />
      <path d="${edgeOut}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${edgeIn}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      ${patella}
      ${quadSvg}
      ${adductorSvg}
      ${hipFlexorSvg}
    </g>`,
  };
}

function buildFrontTorsoAndPelvis(
  hipCenter,
  shoulderCenter,
  proportions,
  bodyPalette,
  musclePalette,
  highlights,
  activeSideSign,
  prefix
) {
  const { front } = proportions;
  const gradId = `${prefix}_ftorso_grad`;
  const gradDef = createCylinderGradient(gradId, hipCenter, shoulderCenter, front.chestHalfW, bodyPalette);
  const defs = [gradDef];

  const pelvisL = segPt(hipCenter, shoulderCenter, -0.04, -front.hipHalfW * 0.98);
  const pelvisR = segPt(hipCenter, shoulderCenter, -0.04, front.hipHalfW * 0.98);
  const pelvisBot = segPt(hipCenter, shoulderCenter, -0.14, 0);

  const waistL = segPt(hipCenter, shoulderCenter, 0.32, -front.waistHalfW);
  const waistR = segPt(hipCenter, shoulderCenter, 0.32, front.waistHalfW);
  const chestL = segPt(hipCenter, shoulderCenter, 0.68, -front.chestHalfW);
  const chestR = segPt(hipCenter, shoulderCenter, 0.68, front.chestHalfW);
  const shL = segPt(hipCenter, shoulderCenter, 0.94, -front.shoulderHalfW);
  const shR = segPt(hipCenter, shoulderCenter, 0.94, front.shoulderHalfW);
  const trapL = segPt(hipCenter, shoulderCenter, 1.04, -front.neckHalfW * 1.45);
  const trapR = segPt(hipCenter, shoulderCenter, 1.04, front.neckHalfW * 1.45);
  const neckBase = segPt(hipCenter, shoulderCenter, 1.08, 0);

  const d = [
    `M ${pt(pelvisBot)}`,
    `Q ${pt(segPt(hipCenter, shoulderCenter, -0.12, -front.hipHalfW * 0.75))} ${pt(pelvisL)}`,
    `C ${pt(segPt(hipCenter, shoulderCenter, 0.14, -front.hipHalfW * 0.92))} ${pt(waistL)} ${pt(chestL)}`,
    `Q ${pt(segPt(hipCenter, shoulderCenter, 0.84, -front.shoulderHalfW * 1.02))} ${pt(shL)}`,
    `Q ${pt(trapL)} ${pt(neckBase)}`,
    `Q ${pt(trapR)} ${pt(shR)}`,
    `Q ${pt(segPt(hipCenter, shoulderCenter, 0.84, front.shoulderHalfW * 1.02))} ${pt(chestR)}`,
    `C ${pt(waistR)} ${pt(segPt(hipCenter, shoulderCenter, 0.14, front.hipHalfW * 0.92))} ${pt(pelvisR)}`,
    `Q ${pt(segPt(hipCenter, shoulderCenter, -0.12, front.hipHalfW * 0.75))} ${pt(pelvisBot)}`,
    `Z`,
  ].join(' ');

  const edgeL = `M ${pt(pelvisL)} C ${pt(segPt(hipCenter, shoulderCenter, 0.14, -front.hipHalfW * 0.92))} ${pt(waistL)} ${pt(chestL)} Q ${pt(segPt(hipCenter, shoulderCenter, 0.84, -front.shoulderHalfW * 1.02))} ${pt(shL)}`;
  const edgeR = `M ${pt(shR)} Q ${pt(segPt(hipCenter, shoulderCenter, 0.84, front.shoulderHalfW * 1.02))} ${pt(chestR)} C ${pt(waistR)} ${pt(segPt(hipCenter, shoulderCenter, 0.14, front.hipHalfW * 0.92))} ${pt(pelvisR)}`;

  const clavL = `M ${pt(segPt(hipCenter, shoulderCenter, 0.96, -3))} Q ${pt(segPt(hipCenter, shoulderCenter, 0.98, -front.shoulderHalfW * 0.45))} ${pt(segPt(hipCenter, shoulderCenter, 0.95, -front.shoulderHalfW * 0.78))}`;
  const clavR = `M ${pt(segPt(hipCenter, shoulderCenter, 0.96, 3))} Q ${pt(segPt(hipCenter, shoulderCenter, 0.98, front.shoulderHalfW * 0.45))} ${pt(segPt(hipCenter, shoulderCenter, 0.95, front.shoulderHalfW * 0.78))}`;
  const pecCrease = `M ${pt(segPt(hipCenter, shoulderCenter, 0.72, -front.chestHalfW * 0.65))} Q ${pt(segPt(hipCenter, shoulderCenter, 0.67, -front.chestHalfW * 0.25))} ${pt(segPt(hipCenter, shoulderCenter, 0.72, -3))} M ${pt(segPt(hipCenter, shoulderCenter, 0.72, 3))} Q ${pt(segPt(hipCenter, shoulderCenter, 0.67, front.chestHalfW * 0.25))} ${pt(segPt(hipCenter, shoulderCenter, 0.72, front.chestHalfW * 0.65))}`;

  let coreSvg = '';
  if (highlights.has('core')) {
    const cgId = `${prefix}_fcore_grad`;
    defs.push(createCylinderGradient(cgId, hipCenter, shoulderCenter, front.waistHalfW * 0.85, musclePalette));

    const cTopL = segPt(hipCenter, shoulderCenter, 0.60, -front.waistHalfW * 0.64);
    const cTopR = segPt(hipCenter, shoulderCenter, 0.60, front.waistHalfW * 0.64);
    const cMidL = segPt(hipCenter, shoulderCenter, 0.34, -front.waistHalfW * 0.58);
    const cMidR = segPt(hipCenter, shoulderCenter, 0.34, front.waistHalfW * 0.58);
    const cBotL = segPt(hipCenter, shoulderCenter, 0.06, -front.waistHalfW * 0.42);
    const cBotR = segPt(hipCenter, shoulderCenter, 0.06, front.waistHalfW * 0.42);
    const cBot = segPt(hipCenter, shoulderCenter, 0.00, 0);

    const coreD = [
      `M ${pt(cTopL)}`,
      `Q ${pt(segPt(hipCenter, shoulderCenter, 0.63, 0))} ${pt(cTopR)}`,
      `C ${pt(cMidR)} ${pt(segPt(hipCenter, shoulderCenter, 0.16, front.waistHalfW * 0.56))} ${pt(cBotR)}`,
      `Q ${pt(cBot)} ${pt(cBotL)}`,
      `C ${pt(segPt(hipCenter, shoulderCenter, 0.16, -front.waistHalfW * 0.56))} ${pt(cMidL)} ${pt(cTopL)}`,
      `Z`,
    ].join(' ');

    const lineaAlba = `M ${pt(segPt(hipCenter, shoulderCenter, 0.58, 0))} L ${pt(segPt(hipCenter, shoulderCenter, 0.06, 0))}`;
    const band1 = `M ${pt(segPt(hipCenter, shoulderCenter, 0.46, -front.waistHalfW * 0.46))} Q ${pt(segPt(hipCenter, shoulderCenter, 0.45, 0))} ${pt(segPt(hipCenter, shoulderCenter, 0.46, front.waistHalfW * 0.46))}`;
    const band2 = `M ${pt(segPt(hipCenter, shoulderCenter, 0.30, -front.waistHalfW * 0.42))} Q ${pt(segPt(hipCenter, shoulderCenter, 0.29, 0))} ${pt(segPt(hipCenter, shoulderCenter, 0.30, front.waistHalfW * 0.42))}`;

    coreSvg = `<g class="muscle-core">
      <path d="${coreD}" fill="url(#${cgId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${lineaAlba}" fill="none" stroke="${musclePalette.striationDark}" stroke-width="1.05" stroke-linecap="round" />
      <path d="${band1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.0" stroke-linecap="round" />
      <path d="${band2}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.0" stroke-linecap="round" />
    </g>`;
  }

  let gluteMedSvg = '';
  if (highlights.has('gluteusMedius')) {
    const gmId = `${prefix}_fgm_grad`;
    defs.push(createCylinderGradient(gmId, hipCenter, shoulderCenter, front.hipHalfW, musclePalette));
    const sides = activeSideSign ? [activeSideSign] : [-1, 1];
    const parts = sides.map((s) => {
      const topIn = segPt(hipCenter, shoulderCenter, 0.19, s * front.hipHalfW * 0.58);
      const crest = segPt(hipCenter, shoulderCenter, 0.16, s * front.hipHalfW * 0.94);
      const outer = segPt(hipCenter, shoulderCenter, 0.02, s * front.hipHalfW * 1.06);
      const troch = segPt(hipCenter, shoulderCenter, -0.09, s * front.hipHalfW * 0.94);
      const inner = segPt(hipCenter, shoulderCenter, 0.03, s * front.hipHalfW * 0.64);
      const dGm = [
        `M ${pt(topIn)}`,
        `Q ${pt(crest)} ${pt(outer)}`,
        `Q ${pt(segPt(hipCenter, shoulderCenter, -0.05, s * front.hipHalfW * 1.04))} ${pt(troch)}`,
        `Q ${pt(inner)} ${pt(topIn)}`,
        `Z`,
      ].join(' ');
      const gs = `M ${pt(segPt(hipCenter, shoulderCenter, 0.14, s * front.hipHalfW * 0.78))} Q ${pt(segPt(hipCenter, shoulderCenter, 0.03, s * front.hipHalfW * 0.90))} ${pt(segPt(hipCenter, shoulderCenter, -0.06, s * front.hipHalfW * 0.88))}`;
      return `<path d="${dGm}" fill="url(#${gmId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
              <path d="${gs}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.0" stroke-linecap="round" />`;
    });
    gluteMedSvg = `<g class="muscle-gluteus-medius">${parts.join('')}</g>`;
  }

  let gluteFrontSvg = '';
  if (highlights.has('glutes')) {
    const gfId = `${prefix}_fglute_grad`;
    defs.push(createCylinderGradient(gfId, hipCenter, shoulderCenter, front.hipHalfW, musclePalette));
    const parts = [-1, 1].map((s) => {
      const top = segPt(hipCenter, shoulderCenter, 0.12, s * front.hipHalfW * 0.84);
      const mid = segPt(hipCenter, shoulderCenter, -0.02, s * front.hipHalfW * 1.06);
      const low = segPt(hipCenter, shoulderCenter, -0.14, s * front.hipHalfW * 0.92);
      const inner = segPt(hipCenter, shoulderCenter, -0.04, s * front.hipHalfW * 0.68);
      const dGf = [
        `M ${pt(top)}`,
        `C ${pt(segPt(hipCenter, shoulderCenter, 0.06, s * front.hipHalfW * 1.04))} ${pt(mid)} ${pt(low)}`,
        `Q ${pt(inner)} ${pt(top)}`,
        `Z`,
      ].join(' ');
      const gs = `M ${pt(segPt(hipCenter, shoulderCenter, 0.07, s * front.hipHalfW * 0.86))} Q ${pt(segPt(hipCenter, shoulderCenter, -0.02, s * front.hipHalfW * 0.94))} ${pt(segPt(hipCenter, shoulderCenter, -0.10, s * front.hipHalfW * 0.86))}`;
      return `<path d="${dGf}" fill="url(#${gfId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.95" />
              <path d="${gs}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="0.95" stroke-linecap="round" />`;
    });
    gluteFrontSvg = `<g class="muscle-glutes-front">${parts.join('')}</g>`;
  }

  return {
    defs,
    svg: `<g class="front-torso">
      <path d="${d}" fill="url(#${gradId})" />
      <path d="${edgeL}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${edgeR}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${clavL}" fill="none" stroke="${bodyPalette.crease}" stroke-width="1.0" stroke-linecap="round" />
      <path d="${clavR}" fill="none" stroke="${bodyPalette.crease}" stroke-width="1.0" stroke-linecap="round" />
      <path d="${pecCrease}" fill="none" stroke="${bodyPalette.crease}" stroke-width="1.0" stroke-linecap="round" />
      ${coreSvg}
      ${gluteMedSvg}
      ${gluteFrontSvg}
    </g>`,
  };
}

function buildFrontHeadAndNeck(shoulderCenter, neckTop, headCenter, proportions, palette, prefix) {
  const { front } = proportions;
  const rx = front.headRx;
  const ry = front.headRy;

  const neckGradId = `${prefix}_fneck_grad`;
  const neckGrad = createCylinderGradient(neckGradId, shoulderCenter, neckTop, front.neckHalfW, palette);

  const nLBase = segPt(shoulderCenter, neckTop, -0.25, -front.neckHalfW * 1.15);
  const nLTop = segPt(shoulderCenter, neckTop, 1.30, -front.neckHalfW * 0.88);
  const nRTop = segPt(shoulderCenter, neckTop, 1.30, front.neckHalfW * 0.88);
  const nRBase = segPt(shoulderCenter, neckTop, -0.25, front.neckHalfW * 1.15);

  const neckD = `M ${pt(nLBase)} Q ${pt(segPt(shoulderCenter, neckTop, 0.55, -front.neckHalfW * 0.92))} ${pt(nLTop)} L ${pt(nRTop)} Q ${pt(segPt(shoulderCenter, neckTop, 0.55, front.neckHalfW * 0.92))} ${pt(nRBase)} Z`;
  const neckLeft = `M ${pt(segPt(shoulderCenter, neckTop, 0.1, -front.neckHalfW * 1.05))} Q ${pt(segPt(shoulderCenter, neckTop, 0.6, -front.neckHalfW * 0.9))} ${pt(segPt(shoulderCenter, neckTop, 1.05, -front.neckHalfW * 0.88))}`;
  const neckRight = `M ${pt(segPt(shoulderCenter, neckTop, 0.1, front.neckHalfW * 1.05))} Q ${pt(segPt(shoulderCenter, neckTop, 0.6, front.neckHalfW * 0.9))} ${pt(segPt(shoulderCenter, neckTop, 1.05, front.neckHalfW * 0.88))}`;

  const headGradId = `${prefix}_fhead_grad`;
  const headGrad = createDirectionalGradient(
    headGradId,
    { x: headCenter.x - rx * 0.8, y: headCenter.y - ry * 0.8 },
    { x: headCenter.x + rx * 0.9, y: headCenter.y + ry * 0.8 },
    palette
  );

  const cx = headCenter.x;
  const cy = headCenter.y;
  const headD = [
    `M ${f(cx)},${f(cy - ry)}`,
    `C ${f(cx + rx * 0.72)},${f(cy - ry)} ${f(cx + rx)},${f(cy - ry * 0.52)} ${f(cx + rx * 0.94)},${f(cy + ry * 0.08)}`,
    `C ${f(cx + rx * 0.88)},${f(cy + ry * 0.58)} ${f(cx + rx * 0.48)},${f(cy + ry * 0.95)} ${f(cx)},${f(cy + ry)}`,
    `C ${f(cx - rx * 0.48)},${f(cy + ry * 0.95)} ${f(cx - rx * 0.88)},${f(cy + ry * 0.58)} ${f(cx - rx * 0.94)},${f(cy + ry * 0.08)}`,
    `C ${f(cx - rx)},${f(cy - ry * 0.52)} ${f(cx - rx * 0.72)},${f(cy - ry)} ${f(cx)},${f(cy - ry)}`,
    `Z`,
  ].join(' ');

  const earL = `<ellipse cx="${f(cx - rx * 0.98)}" cy="${f(cy + ry * 0.08)}" rx="3.0" ry="5.6" fill="${palette.light}" stroke="${palette.outline}" stroke-width="0.65" />`;
  const earR = `<ellipse cx="${f(cx + rx * 0.98)}" cy="${f(cy + ry * 0.08)}" rx="3.0" ry="5.6" fill="${palette.shadow}" stroke="${palette.outline}" stroke-width="0.65" />`;
  const jawHint = `<path d="M ${f(cx - rx * 0.56)},${f(cy + ry * 0.58)} Q ${f(cx)},${f(cy + ry * 0.88)} ${f(cx + rx * 0.56)},${f(cy + ry * 0.58)}" fill="none" stroke="${palette.crease}" stroke-width="0.85" stroke-linecap="round" />`;

  return {
    defs: [neckGrad, headGrad],
    svg: `<g class="front-head-neck">
      <path d="${neckD}" fill="url(#${neckGradId})" />
      <path d="${neckLeft}" fill="none" stroke="${palette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="${neckRight}" fill="none" stroke="${palette.outline}" stroke-width="0.75" stroke-linecap="round" />
      ${earL}
      ${earR}
      <path d="${headD}" fill="url(#${headGradId})" stroke="${palette.outline}" stroke-width="0.75" stroke-linejoin="round" />
      ${jawHint}
    </g>`,
  };
}

function buildFrontArm(
  shoulder,
  elbow,
  wrist,
  handTip,
  sideSign,
  proportions,
  bodyPalette,
  musclePalette,
  highlights,
  prefix
) {
  const { widths } = proportions;
  const uaGradId = `${prefix}_fua_grad`;
  const faGradId = `${prefix}_ffa_grad`;
  const handGradId = `${prefix}_fhand_grad`;

  const uaGrad = createCylinderGradient(uaGradId, shoulder, elbow, widths.bicep, bodyPalette);
  const faGrad = createCylinderGradient(faGradId, elbow, wrist, widths.forearmPeak, bodyPalette);
  const handGrad = createCylinderGradient(handGradId, wrist, handTip, widths.wrist, bodyPalette);
  const defs = [uaGrad, faGrad, handGrad];

  const uaDir = norm(sub(elbow, shoulder));
  const uaOut = sideSign < 0 ? anteriorNormal(uaDir) : posteriorNormal(uaDir);
  const uaIn = scale(uaOut, -1);

  const shCap = add(shoulder, scale(uaDir, -widths.shoulder * 0.52));
  const shOut = add(shoulder, scale(uaOut, widths.shoulder * 0.88));
  const shIn = add(shoulder, scale(uaIn, widths.shoulder * 0.78));
  const midOut = add(lerpVec(shoulder, elbow, 0.45), scale(uaOut, widths.bicep * 1.06));
  const midIn = add(lerpVec(shoulder, elbow, 0.48), scale(uaIn, widths.bicep * 0.94));
  const elOut = add(elbow, scale(uaOut, widths.elbow * 0.92));
  const elIn = add(elbow, scale(uaIn, widths.elbow * 0.92));
  const elTip = add(elbow, scale(uaDir, widths.elbow * 0.68));

  const upperArmD = [
    `M ${pt(shCap)}`,
    `C ${pt(add(shCap, scale(uaOut, widths.shoulder * 0.78)))} ${pt(shOut)} ${pt(midOut)}`,
    `Q ${pt(lerpVec(midOut, elOut, 0.65))} ${pt(elOut)}`,
    `Q ${pt(add(elTip, scale(uaOut, widths.elbow * 0.42)))} ${pt(elTip)}`,
    `Q ${pt(add(elTip, scale(uaIn, widths.elbow * 0.42)))} ${pt(elIn)}`,
    `Q ${pt(lerpVec(elIn, midIn, 0.5))} ${pt(midIn)}`,
    `C ${pt(shIn)} ${pt(add(shCap, scale(uaIn, widths.shoulder * 0.72)))} ${pt(shCap)}`,
    `Z`,
  ].join(' ');

  const faDir = norm(sub(wrist, elbow));
  const faOut = sideSign < 0 ? anteriorNormal(faDir) : posteriorNormal(faDir);
  const faIn = scale(faOut, -1);

  const faCap = add(elbow, scale(faDir, -widths.elbow * 0.68));
  const faOutS = add(elbow, scale(faOut, widths.elbow * 0.92));
  const faOutP = add(lerpVec(elbow, wrist, 0.30), scale(faOut, widths.forearmPeak * 1.06));
  const faWrOut = add(wrist, scale(faOut, widths.wrist * 0.88));
  const faWrIn = add(wrist, scale(faIn, widths.wrist * 0.88));
  const faInP = add(lerpVec(elbow, wrist, 0.32), scale(faIn, widths.forearmPeak * 0.96));
  const faInS = add(elbow, scale(faIn, widths.elbow * 0.92));

  const forearmD = [
    `M ${pt(faCap)}`,
    `Q ${pt(add(faCap, scale(faOut, widths.elbow * 0.78)))} ${pt(faOutS)}`,
    `C ${pt(faOutP)} ${pt(lerpVec(faOutP, faWrOut, 0.6))} ${pt(faWrOut)}`,
    `L ${pt(faWrIn)}`,
    `C ${pt(lerpVec(faWrIn, faInP, 0.45))} ${pt(faInP)} ${pt(faInS)}`,
    `Q ${pt(add(faCap, scale(faIn, widths.elbow * 0.78)))} ${pt(faCap)}`,
    `Z`,
  ].join(' ');

  const hDir = norm(sub(handTip, wrist));
  const hOut = sideSign < 0 ? anteriorNormal(hDir) : posteriorNormal(hDir);
  const hIn = scale(hOut, -1);

  const handD = [
    `M ${pt(add(wrist, scale(hOut, widths.wrist * 0.84)))}`,
    `Q ${pt(add(lerpVec(wrist, handTip, 0.56), scale(hOut, widths.wrist * 1.08)))} ${pt(add(handTip, scale(hOut, widths.wrist * 0.58)))}`,
    `Q ${pt(add(handTip, scale(hDir, 3.2)))} ${pt(add(handTip, scale(hIn, widths.wrist * 0.62)))}`,
    `Q ${pt(add(lerpVec(wrist, handTip, 0.52), scale(hIn, widths.wrist * 0.98)))} ${pt(add(wrist, scale(hIn, widths.wrist * 0.84)))}`,
    `Z`,
  ].join(' ');

  let deltSvg = '';
  if (highlights.has('deltoids')) {
    const dgId = `${prefix}_fdelt_grad`;
    defs.push(createCylinderGradient(dgId, shoulder, elbow, widths.shoulder * 0.95, musclePalette));

    const dTop = add(shoulder, scale(uaDir, -widths.shoulder * 0.55));
    const dOutTop = add(shoulder, scale(uaOut, widths.shoulder * 0.92));
    const dOutMid = add(lerpVec(shoulder, elbow, 0.22), scale(uaOut, widths.shoulder * 0.96));
    const dInsert = add(lerpVec(shoulder, elbow, 0.42), scale(uaOut, widths.bicep * 0.14));
    const dInMid = add(lerpVec(shoulder, elbow, 0.16), scale(uaIn, widths.shoulder * 0.54));

    const deltD = [
      `M ${pt(dTop)}`,
      `C ${pt(add(dTop, scale(uaOut, widths.shoulder * 0.78)))} ${pt(dOutTop)} ${pt(dOutMid)}`,
      `Q ${pt(add(lerpVec(shoulder, elbow, 0.34), scale(uaOut, widths.bicep * 0.64)))} ${pt(dInsert)}`,
      `Q ${pt(dInMid)} ${pt(add(shoulder, scale(uaIn, widths.shoulder * 0.42)))}`,
      `Q ${pt(add(dTop, scale(uaIn, widths.shoulder * 0.48)))} ${pt(dTop)}`,
      `Z`,
    ].join(' ');

    const ds1 = `M ${pt(add(shoulder, scale(uaOut, widths.shoulder * 0.45)))} Q ${pt(add(lerpVec(shoulder, elbow, 0.20), scale(uaOut, widths.shoulder * 0.52)))} ${pt(add(lerpVec(shoulder, elbow, 0.36), scale(uaOut, widths.bicep * 0.22)))}`;

    deltSvg = `<g class="muscle-deltoids">
      <path d="${deltD}" fill="url(#${dgId})" stroke="${musclePalette.outline}" stroke-width="0.65" opacity="0.96" />
      <path d="${ds1}" fill="none" stroke="${musclePalette.striationLight}" stroke-width="1.05" stroke-linecap="round" />
    </g>`;
  }

  return {
    defs,
    svg: `<g class="front-arm">
      <path d="${upperArmD}" fill="url(#${uaGradId})" />
      <path d="${forearmD}" fill="url(#${faGradId})" />
      <path d="${handD}" fill="url(#${handGradId})" stroke="${bodyPalette.outline}" stroke-width="0.7" stroke-linejoin="round" />
      <path d="M ${pt(shCap)} C ${pt(add(shCap, scale(uaOut, widths.shoulder * 0.78)))} ${pt(shOut)} ${pt(midOut)} Q ${pt(lerpVec(midOut, elOut, 0.65))} ${pt(elOut)}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="M ${pt(elIn)} Q ${pt(lerpVec(elIn, midIn, 0.5))} ${pt(midIn)} C ${pt(shIn)} ${pt(add(shCap, scale(uaIn, widths.shoulder * 0.72)))} ${pt(shCap)}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="M ${pt(faOutS)} C ${pt(faOutP)} ${pt(lerpVec(faOutP, faWrOut, 0.6))} ${pt(faWrOut)}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      <path d="M ${pt(faWrIn)} C ${pt(lerpVec(faWrIn, faInP, 0.45))} ${pt(faInP)} ${pt(faInS)}" fill="none" stroke="${bodyPalette.outline}" stroke-width="0.75" stroke-linecap="round" />
      ${deltSvg}
    </g>`,
  };
}

module.exports = {
  buildFrontFoot,
  buildFrontShin,
  buildFrontThigh,
  buildFrontTorsoAndPelvis,
  buildFrontHeadAndNeck,
  buildFrontArm,
};
