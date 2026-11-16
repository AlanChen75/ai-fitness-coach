/**
 * Anatomical proportions, palettes, and rendering constants for 3D-shaded
 * side-view and front-view mannequin rigs.
 * Logical coordinate space is 512x512, rasterized at 384x384 output size.
 */

const DEFAULT_PROPORTIONS = {
  canvas: {
    logicalWidth: 512,
    logicalHeight: 512,
    width: 384,
    height: 384,
    groundY: 454,
  },
  // Segment lengths in logical pixels (512x512 coordinate space)
  segments: {
    ankleHeight: 20,
    shin: 108,
    thigh: 112,
    torso: 124,
    neck: 22,
    headRadius: 23,
    upperArm: 68,
    forearm: 64,
    hand: 27,
    footBack: 21,
    footFront: 51,
  },
  // Anatomical half-widths / radii for side-view silhouettes
  widths: {
    ankle: 8.2,
    calfPeak: 16.0,
    knee: 13.5,
    thighMid: 22.5,
    hip: 23.5,
    waist: 18.0,
    chest: 24.5,
    shoulder: 15.2,
    neck: 9.8,
    bicep: 11.4,
    elbow: 9.2,
    forearmPeak: 10.4,
    wrist: 6.8,
  },
  // Front-view bilateral widths and socket offsets
  front: {
    shoulderHalfW: 41,
    chestHalfW: 35,
    waistHalfW: 25,
    hipHalfW: 36,
    legSocketX: 19,
    headRx: 19.5,
    headRy: 24.5,
    neckHalfW: 11.0,
    thighMid: 18.5,
    knee: 12.8,
    calfPeak: 14.0,
    ankle: 8.0,
    footHalfW: 11.5,
    footDrop: 20,
  },
  // Perspective offset for far-side limbs in side view
  farOffset: {
    foot: { x: 12, y: -4 },
    knee: { x: 13, y: -4 },
    hip: { x: 5, y: -2 },
    shoulder: { x: 6, y: 1 },
    elbow: { x: 9, y: -1 },
    wrist: { x: 11, y: -3 },
  },
};

const PALETTES = {
  background: {
    top: '#EEF1F4',
    bottom: '#DDE2E8',
    floorShadow: 'rgba(28, 35, 45, 0.22)',
  },
  props: {
    stroke: '#8D98A8',
    fillLight: '#CBD2DC',
    fillMid: '#AEB7C4',
    fillDark: '#8B95A5',
    wallLine: '#BAC3CF',
    wallFill: 'rgba(186, 195, 207, 0.24)',
    matFill: '#C5CDD8',
    matStroke: '#9BA6B6',
  },
  machine: {
    frameDark: '#333C4A',
    frameMid: '#444F60',
    frameLight: '#566275',
    padDark: '#28303C',
    padMid: '#3A4352',
    padLight: '#4C5667',
    cable: '#4A5566',
    accent: '#637083',
    outline: '#202630',
  },
  nearBody: {
    highlight: '#F9FBFD',
    light: '#E7EBF1',
    mid: '#CCD3DD',
    shadow: '#9AA4B4',
    deep: '#7D8798',
    rim: '#B8C1CF',
    outline: 'rgba(105, 116, 134, 0.28)',
    crease: 'rgba(82, 92, 110, 0.24)',
  },
  farBody: {
    highlight: '#CFD6E0',
    light: '#BCC4D0',
    mid: '#A1ABB9',
    shadow: '#7D8798',
    deep: '#667082',
    rim: '#909AA9',
    outline: 'rgba(80, 90, 108, 0.24)',
    crease: 'rgba(70, 80, 96, 0.20)',
  },
  nearMuscle: {
    highlight: '#FF8A6B',
    light: '#FF603B',
    mid: '#E73E1B',
    shadow: '#B5240A',
    deep: '#8C1804',
    rim: '#EE5D3D',
    striationLight: 'rgba(255, 228, 215, 0.36)',
    striationDark: 'rgba(130, 20, 4, 0.24)',
    outline: 'rgba(165, 34, 10, 0.30)',
  },
  farMuscle: {
    highlight: '#E26145',
    light: '#D04628',
    mid: '#B42E14',
    shadow: '#8A1C07',
    deep: '#681103',
    rim: '#BD4228',
    striationLight: 'rgba(255, 205, 185, 0.22)',
    striationDark: 'rgba(100, 15, 3, 0.20)',
    outline: 'rgba(120, 24, 8, 0.26)',
  },
};

module.exports = {
  DEFAULT_PROPORTIONS,
  PALETTES,
};
