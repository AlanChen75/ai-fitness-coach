#!/usr/bin/env node
/**
 * Renders parameterized exercise JSON into 384x384 PNG frames using Playwright Chromium.
 * Exports renderExercise() for batch execution with a shared browser instance.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('../../../node_modules/playwright');
const { renderExerciseFrame } = require('../anatomy/renderer');
const { solveSkeleton } = require('../anatomy/kinematics');
const { DEFAULT_PROPORTIONS } = require('../anatomy/proportions');

function scaleBox(box, factor) {
  return box.map((v) => Math.round(v * factor));
}

function computeAnchorMeta(exerciseConfig, proportions) {
  const factor = proportions.canvas.width / proportions.canvas.logicalWidth;
  const groundY =
    exerciseConfig.groundY !== undefined
      ? exerciseConfig.groundY
      : proportions.canvas.groundY;
  const pose0 = exerciseConfig.keyframes[0].pose;
  const skel0 = solveSkeleton(exerciseConfig, pose0, proportions);

  const anchorMode = exerciseConfig.anchor || 'feet';
  let anchorCategory = exerciseConfig.anchorCategory;
  if (!anchorCategory) {
    if (anchorMode === 'pushup' || anchorMode === 'knee-pushup') {
      anchorCategory = 'prone';
    } else if (anchorMode === 'glute-bridge') {
      anchorCategory = 'supine';
    } else if (anchorMode === 'wall-pushup') {
      anchorCategory = 'wall';
    } else if (anchorMode === 'seated' || anchorMode === 'leg-press') {
      anchorCategory = 'seated';
    } else {
      anchorCategory = 'standing';
    }
  }

  let anchorBox = null;
  let contactBox = null;
  let contactLabel = null;

  if (anchorMode === 'seated' || anchorMode === 'leg-press') {
    const seatY = skel0.seatY;
    if (exerciseConfig.view === 'front') {
      const hip = skel0.hipCenter;
      contactBox = scaleBox([hip.x - 16, seatY - 3, hip.x + 16, seatY + 4], factor);
    } else if (anchorMode === 'leg-press') {
      const hip = skel0.near.hip;
      contactBox = scaleBox([hip.x - 56, hip.y - 54, hip.x - 36, hip.y - 24], factor);
    } else {
      const hip = skel0.near.hip;
      contactBox = scaleBox([hip.x + 34, seatY - 2, hip.x + 68, seatY + 4], factor);
    }
    contactLabel = 'seat_hip';
  } else if (exerciseConfig.view === 'front') {
    const lAnk = skel0.left.ankle;
    anchorBox = scaleBox([lAnk.x - 6, groundY - 10, lAnk.x + 6, groundY - 3], factor);
    contactBox = anchorBox;
    contactLabel = 'left_foot';
  } else if (anchorMode === 'feet') {
    const ank = skel0.near.ankle;
    if (exerciseConfig.anchorPivot === 'metatarsal') {
      const ballX = ank.x + proportions.segments.footFront - 14;
      anchorBox = scaleBox([ballX - 2, groundY - 6, ballX + 10, groundY - 1], factor);
      contactLabel = 'forefoot';
    } else {
      anchorBox = scaleBox([ank.x - 10, groundY - 10, ank.x + 34, groundY - 2], factor);
      contactLabel = 'near_foot';
    }
    contactBox = anchorBox;
  } else if (anchorMode === 'wall-pushup') {
    const ank = skel0.near.ankle;
    anchorBox = scaleBox([ank.x - 10, groundY - 10, ank.x + 34, groundY - 2], factor);
    const wr = skel0.near.wrist;
    contactBox = scaleBox([wr.x + 1, wr.y - 16, wr.x + 6, wr.y - 6], factor);
    contactLabel = 'wall_palm';
  } else if (anchorMode === 'pushup') {
    const wr = skel0.near.wrist;
    contactBox = scaleBox([wr.x + 10, groundY - 5, wr.x + 20, groundY - 2], factor);
    contactLabel = 'floor_palm';
  } else if (anchorMode === 'knee-pushup') {
    const wr = skel0.near.wrist;
    contactBox = scaleBox([wr.x + 10, groundY - 5, wr.x + 20, groundY - 2], factor);
    contactLabel = 'floor_palm';
  } else if (anchorMode === 'glute-bridge') {
    const ank = skel0.near.ankle;
    contactBox = scaleBox([ank.x - 10, groundY - 10, ank.x + 34, groundY - 2], factor);
    contactLabel = 'supine_foot';
  }

  return {
    anchorCategory,
    anchorMode,
    anchorBox,
    contactBox,
    contactLabel,
  };
}

async function renderExerciseWithPage(page, exercisePath, outDir, proportions = DEFAULT_PROPORTIONS) {
  const exerciseConfig = JSON.parse(fs.readFileSync(exercisePath, 'utf8'));
  const framesDir = path.join(outDir, 'frames');
  const svgDir = path.join(outDir, 'svg');
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(svgDir, { recursive: true });

  const durationMs = exerciseConfig.durationMs || 2000;
  const fps = exerciseConfig.fps || 12.5;
  const totalFrames =
    exerciseConfig.totalFrames || Math.min(32, Math.max(24, Math.round((durationMs / 1000) * fps)));
  const effectiveFps = totalFrames / (durationMs / 1000);
  const { width, height } = proportions.canvas;

  for (let i = 0; i < totalFrames; i++) {
    const phase = i / totalFrames;
    const svgMarkup = renderExerciseFrame(exerciseConfig, phase, proportions);
    const svgPath = path.join(svgDir, `frame_${String(i).padStart(3, '0')}.svg`);
    fs.writeFileSync(svgPath, svgMarkup, 'utf8');

    await page.evaluate((markup) => {
      document.getElementById('stage').innerHTML = markup;
    }, svgMarkup);

    const pngPath = path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
    await page.screenshot({
      path: pngPath,
      clip: { x: 0, y: 0, width, height },
      omitBackground: false,
    });
  }

  const anchorMeta = computeAnchorMeta(exerciseConfig, proportions);
  const meta = {
    id: exerciseConfig.id,
    name: exerciseConfig.name,
    view: exerciseConfig.view || 'side',
    highlightMuscles: exerciseConfig.highlightMuscles || [],
    width,
    height,
    logicalWidth: proportions.canvas.logicalWidth,
    logicalHeight: proportions.canvas.logicalHeight,
    totalFrames,
    durationMs,
    fps: effectiveFps,
    frameDelayMs: Math.round(durationMs / totalFrames),
    anchorX: exerciseConfig.anchorX,
    groundY: exerciseConfig.groundY || proportions.canvas.groundY,
    ...anchorMeta,
  };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

async function createRenderPage(proportions = DEFAULT_PROPORTIONS) {
  const { width, height } = proportions.canvas;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(
    `<!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: transparent; }
          #stage { width: ${width}px; height: ${height}px; }
        </style>
      </head>
      <body><div id="stage"></div></body>
    </html>`,
    { waitUntil: 'load' }
  );
  return { browser, page };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv);
    const exerciseArg = args.exercise || path.join(__dirname, '..', 'exercises', 'squat.json');
    const exercisePath = path.resolve(exerciseArg);
    const cfg = JSON.parse(fs.readFileSync(exercisePath, 'utf8'));
    const outDir = path.resolve(args.out || path.join(__dirname, '..', 'build', cfg.id));

    const { browser, page } = await createRenderPage(DEFAULT_PROPORTIONS);
    try {
      const meta = await renderExerciseWithPage(page, exercisePath, outDir, DEFAULT_PROPORTIONS);
      console.log(`Rendered ${meta.totalFrames} frames (${meta.width}x${meta.height}) for ${meta.id}`);
    } finally {
      await browser.close();
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  createRenderPage,
  renderExerciseWithPage,
};
