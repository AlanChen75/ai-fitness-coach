/**
 * Simplified dark-gray gym machine silhouette renderers (R7).
 * Each renderer returns { defs, backSvg, frontSvg } so background frames/seats
 * and foreground bars/footplates/rollers layer cleanly around the mannequin.
 */

const { PALETTES } = require('./proportions');
const { add, f, lerpVec, norm, posteriorNormal, pt, scale, sub } = require('./svgUtils');

function buildMachineDefs(m) {
  return [
    `<linearGradient id="mach_frame_grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${m.frameLight}" />
      <stop offset="50%" stop-color="${m.frameMid}" />
      <stop offset="100%" stop-color="${m.frameDark}" />
    </linearGradient>`,
    `<linearGradient id="mach_pad_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${m.padLight}" />
      <stop offset="55%" stop-color="${m.padMid}" />
      <stop offset="100%" stop-color="${m.padDark}" />
    </linearGradient>`,
  ];
}

function weightStackSvg(x, y, w, h, count, m) {
  const plates = [];
  const gap = (h - 16) / count;
  for (let i = 0; i < count; i++) {
    const py = y + 8 + i * gap;
    plates.push(
      `<rect x="${f(x + 4)}" y="${f(py)}" width="${f(w - 8)}" height="${f(Math.max(4, gap - 2.5))}" rx="1.5" fill="${m.padDark}" stroke="${m.outline}" stroke-width="0.6" />`
    );
  }
  return `<g class="mach-stack">
    <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="4" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    ${plates.join('\n    ')}
  </g>`;
}

function pulleyWheelSvg(cx, cy, r, m) {
  return `<g class="mach-pulley">
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${m.frameDark}" stroke="${m.outline}" stroke-width="1" />
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.42)}" fill="${m.accent}" />
  </g>`;
}

function angledPadSvg(pStart, pEnd, thickness, normalSign, m) {
  const dir = norm(sub(pEnd, pStart));
  const n = scale(posteriorNormal(dir), normalSign);
  const a = pStart;
  const b = pEnd;
  const c = add(pEnd, scale(n, thickness));
  const d = add(pStart, scale(n, thickness));
  return `<polygon points="${pt(a)} ${pt(b)} ${pt(c)} ${pt(d)}" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" stroke-linejoin="round" />`;
}

function renderLatPulldownProp(exerciseConfig, skel) {
  const m = PALETTES.machine;
  const gY = skel.groundY;
  const seatY = skel.seatY;
  const hipX = skel.near.hip.x;
  const kneeX = skel.near.knee.x;
  const wrist = skel.near.wrist;
  const barX = exerciseConfig.pulleyX !== undefined ? exerciseConfig.pulleyX : wrist.x;

  const backSvg = `<g class="prop-machine prop-lat-pulldown">
    <rect x="${f(hipX - 42)}" y="${f(gY - 10)}" width="276" height="10" rx="4" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    ${weightStackSvg(380, 32, 36, gY - 42, 9, m)}
    <rect x="${f(barX - 18)}" y="26" width="${f(416 - (barX - 18))}" height="14" rx="5" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    ${pulleyWheelSvg(barX, 46, 8.5, m)}
    ${pulleyWheelSvg(392, 46, 8.5, m)}
    <line x1="${f(barX)}" y1="54" x2="${f(wrist.x)}" y2="${f(wrist.y - 8)}" stroke="${m.cable}" stroke-width="2.4" stroke-linecap="round" />
    <line x1="${f(wrist.x - 16)}" y1="${f(wrist.y - 3)}" x2="${f(wrist.x + 18)}" y2="${f(wrist.y + 3)}" stroke="${m.padDark}" stroke-width="5" stroke-linecap="round" />
    <rect x="${f(hipX + 14)}" y="${f(seatY + 12)}" width="14" height="${f(gY - seatY - 22)}" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <rect x="${f(hipX - 30)}" y="${f(seatY)}" width="112" height="15" rx="6" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    <rect x="${f(kneeX - 32)}" y="300" width="10" height="${f(seatY - 296)}" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="0.9" />
  </g>`;

  const frontSvg = `<g class="prop-machine-front">
    <rect x="${f(kneeX - 42)}" y="289" width="30" height="20" rx="10" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    <circle cx="${f(wrist.x + 14)}" cy="${f(wrist.y + 2)}" r="4.2" fill="${m.padDark}" stroke="${m.accent}" stroke-width="0.8" />
  </g>`;

  return { defs: buildMachineDefs(m), backSvg, frontSvg };
}

function renderChestPressProp(exerciseConfig, skel) {
  const m = PALETTES.machine;
  const gY = skel.groundY;
  const seatY = skel.seatY;
  const hip = skel.near.hip;
  const shoulder = skel.near.shoulder;
  const wrist = skel.near.wrist;

  const backBot = add(hip, { x: -24, y: 24 });
  const backTop = add(shoulder, { x: -24, y: -12 });
  const pivot = { x: 244, y: 76 };
  const armJoint = { x: wrist.x + 10, y: wrist.y - 26 };

  const backSvg = `<g class="prop-machine prop-chest-press">
    <rect x="116" y="${f(gY - 10)}" width="218" height="10" rx="4" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    ${weightStackSvg(118, 72, 32, gY - 82, 8, m)}
    <rect x="118" y="68" width="144" height="14" rx="5" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    <rect x="${f(hip.x + 14)}" y="${f(seatY + 12)}" width="14" height="${f(gY - seatY - 22)}" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="0.9" />
    ${angledPadSvg(backBot, backTop, 16, 1, m)}
    <rect x="${f(hip.x - 32)}" y="${f(seatY)}" width="114" height="15" rx="6" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    <line x1="${f(pivot.x)}" y1="${f(pivot.y)}" x2="${f(armJoint.x)}" y2="${f(armJoint.y)}" stroke="${m.frameDark}" stroke-width="10" stroke-linecap="round" />
    <line x1="${f(pivot.x)}" y1="${f(pivot.y)}" x2="${f(armJoint.x)}" y2="${f(armJoint.y)}" stroke="${m.frameLight}" stroke-width="4" stroke-linecap="round" />
    <line x1="${f(armJoint.x)}" y1="${f(armJoint.y)}" x2="${f(wrist.x + 10)}" y2="${f(wrist.y + 18)}" stroke="${m.frameDark}" stroke-width="8" stroke-linecap="round" />
    <circle cx="${f(pivot.x)}" cy="${f(pivot.y)}" r="7.5" fill="${m.padDark}" stroke="${m.accent}" stroke-width="1" />
  </g>`;

  const frontSvg = `<g class="prop-machine-front">
    <rect x="${f(wrist.x + 4)}" y="${f(wrist.y - 11)}" width="10" height="24" rx="4" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
  </g>`;

  return { defs: buildMachineDefs(m), backSvg, frontSvg };
}

function renderSeatedRowProp(exerciseConfig, skel) {
  const m = PALETTES.machine;
  const gY = skel.groundY;
  const seatY = skel.seatY;
  const hipX = skel.near.hip.x;
  const ankle = skel.near.ankle;
  const wrist = skel.near.wrist;
  const pulleyX = 414;
  const pulleyY = 224;

  const fpBot = { x: ankle.x + 18, y: ankle.y + 34 };
  const fpTop = { x: ankle.x + 48, y: ankle.y - 34 };

  const backSvg = `<g class="prop-machine prop-seated-row">
    <rect x="${f(hipX - 36)}" y="${f(gY - 10)}" width="318" height="10" rx="4" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    ${weightStackSvg(414, 176, 34, gY - 186, 7, m)}
    <rect x="${f(hipX - 18)}" y="${f(seatY + 12)}" width="12" height="${f(gY - seatY - 22)}" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <rect x="${f(hipX + 58)}" y="${f(seatY + 12)}" width="12" height="${f(gY - seatY - 22)}" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <rect x="${f(hipX - 32)}" y="${f(seatY)}" width="118" height="15" rx="6" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    ${pulleyWheelSvg(pulleyX, pulleyY, 8.5, m)}
    <line x1="${f(pulleyX)}" y1="${f(pulleyY)}" x2="${f(wrist.x + 12)}" y2="${f(wrist.y)}" stroke="${m.cable}" stroke-width="2.4" stroke-linecap="round" />
  </g>`;

  const frontSvg = `<g class="prop-machine-front">
    <line x1="${f((fpBot.x + fpTop.x) * 0.5 + 8)}" y1="${f((fpBot.y + fpTop.y) * 0.5)}" x2="418" y2="${f(gY - 10)}" stroke="${m.frameDark}" stroke-width="9" stroke-linecap="round" />
    ${angledPadSvg(fpBot, fpTop, 11, -1, m)}
    <rect x="${f(wrist.x + 5)}" y="${f(wrist.y - 9)}" width="9" height="18" rx="3.5" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="0.9" />
  </g>`;

  return { defs: buildMachineDefs(m), backSvg, frontSvg };
}

function renderLegPressProp(exerciseConfig, skel) {
  const m = PALETTES.machine;
  const gY = skel.groundY;
  const hip = skel.near.hip;
  const shoulder = skel.near.shoulder;
  const ankle = skel.near.ankle;

  const backBot = add(hip, { x: -16, y: 18 });
  const backTop = add(shoulder, { x: -18, y: -12 });

  // Sled footplate stays perpendicular to the 34-deg push axis, right in front of the soles
  const plateBot = { x: ankle.x + 31, y: ankle.y + 8 };
  const plateTop = { x: ankle.x - 11, y: ankle.y - 54 };
  const plateMid = lerpVec(plateBot, plateTop, 0.5);

  const railStart = { x: 242, y: 356 };
  const railEnd = { x: 420, y: 234 };
  const railProj = { x: plateMid.x + 22, y: plateMid.y + 18 };

  const backSvg = `<g class="prop-machine prop-leg-press">
    <rect x="64" y="${f(gY - 12)}" width="364" height="12" rx="4" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    <line x1="94" y1="316" x2="94" y2="${f(gY - 12)}" stroke="${m.frameDark}" stroke-width="12" stroke-linecap="round" />
    <line x1="154" y1="404" x2="154" y2="${f(gY - 12)}" stroke="${m.frameDark}" stroke-width="12" stroke-linecap="round" />
    <line x1="406" y1="242" x2="406" y2="${f(gY - 12)}" stroke="${m.frameDark}" stroke-width="14" stroke-linecap="round" />
    <line x1="${f(railStart.x)}" y1="${f(railStart.y)}" x2="${f(railEnd.x)}" y2="${f(railEnd.y)}" stroke="${m.frameMid}" stroke-width="11" stroke-linecap="round" />
    <line x1="${f(railStart.x)}" y1="${f(railStart.y)}" x2="${f(railEnd.x)}" y2="${f(railEnd.y)}" stroke="${m.frameLight}" stroke-width="3" stroke-linecap="round" />
    ${angledPadSvg(backBot, backTop, 17, 1, m)}
    <rect x="${f(hip.x - 24)}" y="${f(hip.y + 18)}" width="68" height="15" rx="6" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    <line x1="${f(hip.x - 10)}" y1="${f(hip.y + 18)}" x2="${f(hip.x - 10)}" y2="${f(hip.y - 6)}" stroke="${m.frameDark}" stroke-width="6" stroke-linecap="round" />
    <line x1="${f(hip.x - 22)}" y1="${f(hip.y - 6)}" x2="${f(hip.x + 8)}" y2="${f(hip.y - 6)}" stroke="${m.padDark}" stroke-width="7" stroke-linecap="round" />
  </g>`;

  const frontSvg = `<g class="prop-machine-front">
    <line x1="${f(plateMid.x + 6)}" y1="${f(plateMid.y - 4)}" x2="${f(railProj.x)}" y2="${f(railProj.y)}" stroke="${m.frameDark}" stroke-width="10" stroke-linecap="round" />
    ${angledPadSvg(plateBot, plateTop, 14, -1, m)}
    <circle cx="${f(railProj.x)}" cy="${f(railProj.y)}" r="6" fill="${m.padDark}" stroke="${m.accent}" stroke-width="1" />
  </g>`;

  return { defs: buildMachineDefs(m), backSvg, frontSvg };
}

function renderShoulderPressProp(exerciseConfig, skel) {
  const m = PALETTES.machine;
  const gY = skel.groundY;
  const seatY = skel.seatY;
  const cx = skel.hipCenter.x;
  const lw = skel.left.wrist;
  const rw = skel.right.wrist;

  const backSvg = `<g class="prop-machine prop-shoulder-press">
    <rect x="${f(cx - 86)}" y="${f(gY - 10)}" width="172" height="10" rx="4" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    <rect x="${f(cx - 26)}" y="88" width="52" height="${f(gY - 98)}" rx="5" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    ${weightStackSvg(cx - 48, 134, 96, 178, 8, m)}
    <rect x="${f(cx - 28)}" y="190" width="56" height="122" rx="8" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    <rect x="${f(cx - 50)}" y="${f(seatY)}" width="100" height="16" rx="6" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    <rect x="${f(cx - 14)}" y="${f(seatY + 16)}" width="28" height="${f(gY - seatY - 26)}" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <path d="M ${f(cx - 26)},124 L ${f(lw.x - 16)},124 L ${f(lw.x - 16)},${f(lw.y)}" fill="none" stroke="${m.frameDark}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M ${f(cx + 26)},124 L ${f(rw.x + 16)},124 L ${f(rw.x + 16)},${f(rw.y)}" fill="none" stroke="${m.frameDark}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" />
    <rect x="${f(lw.x - 20)}" y="${f(lw.y - 5)}" width="30" height="10" rx="4" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <rect x="${f(rw.x - 10)}" y="${f(rw.y - 5)}" width="30" height="10" rx="4" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <circle cx="${f(cx - 26)}" cy="124" r="6" fill="${m.padDark}" stroke="${m.accent}" stroke-width="0.9" />
    <circle cx="${f(cx + 26)}" cy="124" r="6" fill="${m.padDark}" stroke="${m.accent}" stroke-width="0.9" />
  </g>`;

  const frontSvg = `<g class="prop-machine-front">
    <rect x="${f(lw.x - 21)}" y="${f(lw.y - 5)}" width="11" height="10" rx="3" fill="${m.padDark}" stroke="${m.outline}" stroke-width="0.8" />
    <rect x="${f(rw.x + 10)}" y="${f(rw.y - 5)}" width="11" height="10" rx="3" fill="${m.padDark}" stroke="${m.outline}" stroke-width="0.8" />
  </g>`;

  return { defs: buildMachineDefs(m), backSvg, frontSvg };
}

function renderMachineRowProp(exerciseConfig, skel) {
  const m = PALETTES.machine;
  const gY = skel.groundY;
  const seatY = skel.seatY;
  const hipX = skel.near.hip.x;
  const shoulder = skel.near.shoulder;
  const wrist = skel.near.wrist;

  const padX = shoulder.x + 25;
  const padTopY = shoulder.y + 12;
  const padH = 62;
  const trackY = 244;
  const towerX = 398;

  const backSvg = `<g class="prop-machine prop-machine-row">
    <rect x="${f(hipX - 36)}" y="${f(gY - 10)}" width="308" height="10" rx="4" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    ${weightStackSvg(towerX, 148, 34, gY - 158, 8, m)}
    <rect x="${f(hipX + 14)}" y="${f(seatY + 12)}" width="14" height="${f(gY - seatY - 22)}" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <rect x="${f(hipX - 32)}" y="${f(seatY)}" width="118" height="15" rx="6" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    <rect x="${f(padX + 6)}" y="${f(padTopY + 10)}" width="12" height="${f(gY - padTopY - 20)}" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="1" />
    <rect x="${f(padX)}" y="${f(padTopY)}" width="15" height="${f(padH)}" rx="6" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="1" />
    <rect x="${f(padX + 6)}" y="${f(trackY - 4)}" width="${f(towerX - (padX + 6))}" height="8" rx="3" fill="url(#mach_frame_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <line x1="${f(wrist.x + 8)}" y1="${f(trackY)}" x2="${f(towerX)}" y2="${f(trackY)}" stroke="${m.frameLight}" stroke-width="3.2" stroke-linecap="round" />
    <circle cx="${f(towerX)}" cy="${f(trackY)}" r="7" fill="${m.frameDark}" stroke="${m.outline}" stroke-width="1" />
    <circle cx="${f(towerX)}" cy="${f(trackY)}" r="3" fill="${m.accent}" />
  </g>`;

  const frontSvg = `<g class="prop-machine-front">
    <rect x="${f(wrist.x + 3)}" y="${f(wrist.y - 12)}" width="9" height="24" rx="4" fill="url(#mach_pad_grad)" stroke="${m.outline}" stroke-width="0.9" />
    <rect x="${f(wrist.x + 10)}" y="${f(trackY - 5)}" width="10" height="10" rx="2.5" fill="${m.frameMid}" stroke="${m.outline}" stroke-width="0.9" />
  </g>`;

  return { defs: buildMachineDefs(m), backSvg, frontSvg };
}

function renderMachineProp(prop, exerciseConfig, skel) {
  if (prop === 'machine-lat-pulldown') return renderLatPulldownProp(exerciseConfig, skel);
  if (prop === 'machine-chest-press') return renderChestPressProp(exerciseConfig, skel);
  if (prop === 'machine-seated-row') return renderSeatedRowProp(exerciseConfig, skel);
  if (prop === 'machine-row') return renderMachineRowProp(exerciseConfig, skel);
  if (prop === 'machine-leg-press') return renderLegPressProp(exerciseConfig, skel);
  if (prop === 'machine-shoulder-press') return renderShoulderPressProp(exerciseConfig, skel);
  return null;
}

module.exports = {
  renderMachineProp,
};
