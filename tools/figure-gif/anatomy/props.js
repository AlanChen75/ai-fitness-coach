/**
 * Architectural / bodyweight support props (chair, wall, bench, mat)
 * rendered in clean light-gray tones so they never muddy the figure.
 */

const { PALETTES } = require('./proportions');
const { f } = require('./svgUtils');
const { renderMachineProp } = require('./machineProps');

function renderProp(exerciseConfig, skel) {
  const prop = exerciseConfig.prop;
  if (!prop) return { defs: [], backSvg: '', frontSvg: '' };

  const machine = renderMachineProp(prop, exerciseConfig, skel);
  if (machine) return machine;

  const p = PALETTES.props;
  const groundY = skel.groundY;

  if (prop === 'wall') {
    const wallX = skel.wallX !== undefined ? skel.wallX : 368;
    const topY = 40;
    return {
      defs: [],
      backSvg: `<g class="prop-wall">
        <rect x="${f(wallX)}" y="${topY}" width="24" height="${f(groundY - topY)}" fill="${p.wallFill}" />
        <line x1="${f(wallX)}" y1="${topY}" x2="${f(wallX)}" y2="${f(groundY)}" stroke="${p.wallLine}" stroke-width="4" stroke-linecap="round" />
      </g>`,
      frontSvg: '',
    };
  }

  if (prop === 'chair') {
    const seatY = exerciseConfig.chairSeatY || 338;
    const seatLeft = exerciseConfig.chairLeftX || 126;
    const seatRight = exerciseConfig.chairRightX || 226;
    const backTopY = seatY - 134;
    const seatH = 12;
    return {
      defs: [
        `<linearGradient id="prop_chair_grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${p.fillLight}" />
          <stop offset="100%" stop-color="${p.fillMid}" />
        </linearGradient>`,
      ],
      backSvg: `<g class="prop-chair">
        <rect x="${seatLeft + 10}" y="${seatY + seatH}" width="10" height="${f(groundY - seatY - seatH)}" rx="3" fill="${p.fillMid}" stroke="${p.stroke}" stroke-width="0.9" />
        <rect x="${seatRight - 22}" y="${seatY + seatH}" width="10" height="${f(groundY - seatY - seatH)}" rx="3" fill="${p.fillMid}" stroke="${p.stroke}" stroke-width="0.9" />
        <rect x="${seatLeft}" y="${backTopY}" width="12" height="${f(seatY - backTopY + seatH)}" rx="5" fill="url(#prop_chair_grad)" stroke="${p.stroke}" stroke-width="0.9" />
        <rect x="${seatLeft}" y="${seatY}" width="${seatRight - seatLeft}" height="${seatH}" rx="5" fill="url(#prop_chair_grad)" stroke="${p.stroke}" stroke-width="0.9" />
      </g>`,
      frontSvg: '',
    };
  }

  if (prop === 'bench') {
    const benchY = exerciseConfig.benchTopY || 354;
    const benchLeft = exerciseConfig.benchLeftX || 106;
    const benchRight = exerciseConfig.benchRightX || 186;
    const padH = 14;
    return {
      defs: [
        `<linearGradient id="prop_bench_grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${p.fillLight}" />
          <stop offset="100%" stop-color="${p.fillMid}" />
        </linearGradient>`,
      ],
      backSvg: `<g class="prop-bench">
        <rect x="${benchLeft + 12}" y="${benchY + padH}" width="10" height="${f(groundY - benchY - padH)}" rx="3" fill="${p.fillMid}" stroke="${p.stroke}" stroke-width="0.9" />
        <rect x="${benchRight - 22}" y="${benchY + padH}" width="10" height="${f(groundY - benchY - padH)}" rx="3" fill="${p.fillMid}" stroke="${p.stroke}" stroke-width="0.9" />
        <rect x="${benchLeft}" y="${benchY}" width="${benchRight - benchLeft}" height="${padH}" rx="6" fill="url(#prop_bench_grad)" stroke="${p.stroke}" stroke-width="0.9" />
      </g>`,
      frontSvg: '',
    };
  }

  if (prop === 'mat') {
    const matLeft = exerciseConfig.matLeftX || 62;
    const matRight = exerciseConfig.matRightX || 448;
    return {
      defs: [],
      backSvg: `<g class="prop-mat">
        <rect x="${matLeft}" y="${f(groundY - 5)}" width="${matRight - matLeft}" height="6" rx="3" fill="${p.matFill}" stroke="${p.matStroke}" stroke-width="0.8" />
      </g>`,
      frontSvg: '',
    };
  }

  return { defs: [], backSvg: '', frontSvg: '' };
}

module.exports = {
  renderProp,
};
