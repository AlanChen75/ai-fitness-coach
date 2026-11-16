/**
 * Complete SVG frame renderer for parameterized exercise configs.
 * Supports side-view and front-view 3D-shaded anatomical rigs + props.
 */

const { DEFAULT_PROPORTIONS, PALETTES } = require('./proportions');
const { interpolatePose, solveSkeleton } = require('./kinematics');
const {
  buildFoot,
  buildShin,
  buildThigh,
  buildGlutes,
  buildTorso,
  buildHeadAndNeck,
  buildArm,
} = require('./muscleShapes');
const {
  buildFrontFoot,
  buildFrontShin,
  buildFrontThigh,
  buildFrontTorsoAndPelvis,
  buildFrontHeadAndNeck,
  buildFrontArm,
} = require('./frontShapes');
const { renderProp } = require('./props');
const { clamp, f } = require('./svgUtils');

function renderSideFrame(exerciseConfig, skel, proportions, highlights) {
  const antSign = skel.supine ? -1 : 1;
  const highlightCalves = highlights.has('calves');
  const highlightGlutes = highlights.has('glutes');

  const farArm = buildArm(
    skel.far.shoulder,
    skel.far.elbow,
    skel.far.wrist,
    skel.far.handTip,
    proportions,
    PALETTES.farBody,
    PALETTES.farMuscle,
    highlights,
    'far_arm'
  );

  const farFoot = buildFoot(
    skel.far.ankle,
    skel.far.footY,
    proportions,
    PALETTES.farBody,
    'far',
    skel.far.footAngle,
    skel.far.footPivot,
    skel.metatarsalFlat
  );

  const farShin = buildShin(
    skel.far.ankle,
    skel.far.knee,
    proportions,
    PALETTES.farBody,
    PALETTES.farMuscle,
    highlightCalves,
    'far',
    antSign
  );

  const farThigh = buildThigh(
    skel.far.knee,
    skel.far.hip,
    proportions,
    PALETTES.farBody,
    PALETTES.farMuscle,
    highlights,
    'far',
    antSign
  );

  const torso = buildTorso(
    skel.near.hip,
    skel.near.shoulder,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'near',
    antSign
  );

  const headNeck = buildHeadAndNeck(
    skel.near.shoulder,
    skel.near.neckTop,
    skel.near.headCenter,
    skel.near.headPitch,
    proportions,
    PALETTES.nearBody,
    'near',
    antSign
  );

  const nearFoot = buildFoot(
    skel.near.ankle,
    skel.near.footY,
    proportions,
    PALETTES.nearBody,
    'near',
    skel.near.footAngle,
    skel.near.footPivot,
    skel.metatarsalFlat
  );

  const nearShin = buildShin(
    skel.near.ankle,
    skel.near.knee,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlightCalves,
    'near',
    antSign
  );

  const nearThigh = buildThigh(
    skel.near.knee,
    skel.near.hip,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'near',
    antSign
  );

  const nearGlutes = buildGlutes(
    skel.near.knee,
    skel.near.hip,
    skel.near.shoulder,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlightGlutes,
    'near',
    antSign
  );

  const nearArm = buildArm(
    skel.near.shoulder,
    skel.near.elbow,
    skel.near.wrist,
    skel.near.handTip,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'near_arm'
  );

  let comX =
    (skel.near.ankle.x + 18) * 0.65 + ((skel.near.hip.x + skel.near.shoulder.x) * 0.5) * 0.35;
  let shadowRx = 62 + Math.max(0, (skel.near.hip.y - 230) * 0.14);
  if (skel.seated) {
    comX = (skel.near.hip.x + skel.near.knee.x) * 0.5;
    shadowRx = 110;
  } else if (skel.supine || skel.proneFootMode) {
    comX = (skel.near.ankle.x + skel.near.wrist.x) * 0.5;
    shadowRx = 148;
  } else if (skel.footOffsetY < 0) {
    const liftFactor = clamp(1 + skel.footOffsetY / 140, 0.55, 1);
    shadowRx *= liftFactor;
  }

  return {
    defs: [
      ...farArm.defs,
      ...farFoot.defs,
      ...farShin.defs,
      ...farThigh.defs,
      ...torso.defs,
      ...headNeck.defs,
      ...nearFoot.defs,
      ...nearShin.defs,
      ...nearThigh.defs,
      ...nearGlutes.defs,
      ...nearArm.defs,
    ],
    shadow: { cx: comX, cy: skel.groundY + 2, rx: shadowRx },
    bodySvg: `
    ${farArm.svg}
    ${farFoot.svg}
    ${farShin.svg}
    ${farThigh.svg}
    ${torso.svg}
    ${headNeck.svg}
    ${nearFoot.svg}
    ${nearShin.svg}
    ${nearThigh.svg}
    ${nearGlutes.svg}
    ${nearArm.svg}`,
  };
}

function renderFrontFrame(exerciseConfig, skel, proportions, highlights) {
  const lFoot = buildFrontFoot(
    skel.left.ankle,
    skel.left.footY,
    skel.left.footTurnOut,
    proportions,
    PALETTES.nearBody,
    'l'
  );
  const rFoot = buildFrontFoot(
    skel.right.ankle,
    skel.right.footY,
    skel.right.footTurnOut,
    proportions,
    PALETTES.nearBody,
    'r'
  );

  const lShin = buildFrontShin(
    skel.left.ankle,
    skel.left.knee,
    -1,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'l'
  );
  const rShin = buildFrontShin(
    skel.right.ankle,
    skel.right.knee,
    1,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'r'
  );

  const lThigh = buildFrontThigh(
    skel.left.hip,
    skel.left.knee,
    -1,
    skel.left.kneeDepth,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'l'
  );
  const rThigh = buildFrontThigh(
    skel.right.hip,
    skel.right.knee,
    1,
    skel.right.kneeDepth,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'r'
  );

  const activeSideSign = exerciseConfig.activeSide === 'right' ? 1 : exerciseConfig.activeSide === 'left' ? -1 : 0;
  const torso = buildFrontTorsoAndPelvis(
    skel.hipCenter,
    skel.shoulderCenter,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    activeSideSign,
    'front'
  );

  const headNeck = buildFrontHeadAndNeck(
    skel.shoulderCenter,
    skel.neckTop,
    skel.headCenter,
    proportions,
    PALETTES.nearBody,
    'front'
  );

  const lArm = buildFrontArm(
    skel.left.shoulder,
    skel.left.elbow,
    skel.left.wrist,
    skel.left.handTip,
    -1,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'l_arm'
  );
  const rArm = buildFrontArm(
    skel.right.shoulder,
    skel.right.elbow,
    skel.right.wrist,
    skel.right.handTip,
    1,
    proportions,
    PALETTES.nearBody,
    PALETTES.nearMuscle,
    highlights,
    'r_arm'
  );

  const isSumo = exerciseConfig.frontMode === 'sumo-squat';
  const lRaised = !isSumo && skel.left.kneeDepth > 0.35;
  const rRaised = !isSumo && skel.right.kneeDepth > 0.35;

  const legSvg = (foot, shin, thigh, raised) =>
    raised ? `${foot.svg}\n${thigh.svg}\n${shin.svg}` : `${foot.svg}\n${shin.svg}\n${thigh.svg}`;

  const preTorsoLegs = [
    !lRaised ? legSvg(lFoot, lShin, lThigh, false) : '',
    !rRaised ? legSvg(rFoot, rShin, rThigh, false) : '',
  ].join('\n');

  const postTorsoLegs = [
    lRaised ? legSvg(lFoot, lShin, lThigh, true) : '',
    rRaised ? legSvg(rFoot, rShin, rThigh, true) : '',
  ].join('\n');

  const spanX = Math.abs(skel.right.ankle.x - skel.left.ankle.x) * 0.5 + 38;
  const liftY = Math.max(0, skel.groundY - Math.max(skel.left.footY, skel.right.footY));
  const shadowRx = spanX * clamp(1 - liftY / 160, 0.6, 1);

  return {
    defs: [
      ...lFoot.defs,
      ...rFoot.defs,
      ...lShin.defs,
      ...rShin.defs,
      ...lThigh.defs,
      ...rThigh.defs,
      ...torso.defs,
      ...headNeck.defs,
      ...lArm.defs,
      ...rArm.defs,
    ],
    shadow: { cx: skel.hipCenter.x, cy: skel.groundY + 2, rx: shadowRx },
    bodySvg: `
    ${preTorsoLegs}
    ${torso.svg}
    ${headNeck.svg}
    ${postTorsoLegs}
    ${lArm.svg}
    ${rArm.svg}`,
  };
}

function renderExerciseFrame(exerciseConfig, phase, proportions = DEFAULT_PROPORTIONS) {
  const { logicalWidth, logicalHeight, width, height } = proportions.canvas;
  const pose = interpolatePose(exerciseConfig.keyframes, phase);
  const skel = solveSkeleton(exerciseConfig, pose, proportions);
  const highlights = new Set(exerciseConfig.highlightMuscles || []);

  const propLayer = renderProp(exerciseConfig, skel);
  const frameLayer =
    skel.view === 'front'
      ? renderFrontFrame(exerciseConfig, skel, proportions, highlights)
      : renderSideFrame(exerciseConfig, skel, proportions, highlights);

  const allDefs = [
    `<linearGradient id="bg_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${PALETTES.background.top}" />
      <stop offset="100%" stop-color="${PALETTES.background.bottom}" />
    </linearGradient>`,
    `<radialGradient id="floor_shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(25, 32, 42, 0.24)" />
      <stop offset="55%" stop-color="rgba(25, 32, 42, 0.10)" />
      <stop offset="100%" stop-color="rgba(25, 32, 42, 0)" />
    </radialGradient>`,
    ...propLayer.defs,
    ...frameLayer.defs,
  ].join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${logicalWidth} ${logicalHeight}">
  <defs>
    ${allDefs}
  </defs>
  <rect width="${logicalWidth}" height="${logicalHeight}" fill="url(#bg_grad)" />
  <ellipse cx="${f(frameLayer.shadow.cx)}" cy="${f(frameLayer.shadow.cy)}" rx="${f(frameLayer.shadow.rx)}" ry="10" fill="url(#floor_shadow)" />
  ${propLayer.backSvg || propLayer.svg || ''}
  <g class="figure">
    ${frameLayer.bodySvg}
  </g>
  ${propLayer.frontSvg || ''}
</svg>`;
}

module.exports = {
  renderExerciseFrame,
};
