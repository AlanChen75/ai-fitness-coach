#!/usr/bin/env node
/**
 * Orchestrates rendering frames, assembling GIFs, and generating contact sheets.
 * Usage:
 *   npm run figures
 *   npm run figures -- --exercise squat
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createRenderPage, renderExerciseWithPage } = require('./render_frames');
const { DEFAULT_PROPORTIONS } = require('../anatomy/proportions');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const cur = argv[i];
    if (cur.startsWith('--') && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args[cur.slice(2)] = argv[i + 1];
      i++;
    } else if (cur.startsWith('--')) {
      args[cur.slice(2)] = 'true';
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const rootDir = path.resolve(__dirname, '..', '..', '..');
  const toolDir = path.resolve(__dirname, '..');
  const exercisesDir = path.join(toolDir, 'exercises');
  const buildRoot = path.join(toolDir, 'build');
  const reviewDir = path.join(toolDir, 'review');
  const outRoot = path.join(rootDir, 'public', 'figures');

  fs.mkdirSync(buildRoot, { recursive: true });
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.mkdirSync(outRoot, { recursive: true });

  let exerciseFiles;
  if (args.exercise) {
    const candidate = path.join(exercisesDir, `${args.exercise}.json`);
    if (!fs.existsSync(candidate)) {
      console.error(`Exercise not found: ${candidate}`);
      process.exit(1);
    }
    exerciseFiles = [candidate];
  } else {
    exerciseFiles = fs
      .readdirSync(exercisesDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => path.join(exercisesDir, f));
  }

  if (exerciseFiles.length === 0) {
    console.error(`No exercise JSON files found in ${exercisesDir}`);
    process.exit(1);
  }

  const buildGifPy = path.join(__dirname, 'build_gif.py');
  const { browser, page } = await createRenderPage(DEFAULT_PROPORTIONS);

  try {
    for (const exPath of exerciseFiles) {
      const cfg = JSON.parse(fs.readFileSync(exPath, 'utf8'));
      const id = cfg.id;
      const exBuildDir = path.join(buildRoot, id);
      const gifOut = path.join(outRoot, `${id}.gif`);
      const reviewOut = path.join(reviewDir, `${id}.png`);

      const meta = await renderExerciseWithPage(page, exPath, exBuildDir, DEFAULT_PROPORTIONS);
      execFileSync(
        'python3',
        [
          buildGifPy,
          '--build-dir',
          exBuildDir,
          '--out',
          gifOut,
          '--review-out',
          reviewOut,
        ],
        { stdio: 'inherit' }
      );
      console.log(`Completed ${id} -> ${path.relative(rootDir, gifOut)} + ${path.relative(rootDir, reviewOut)} (${meta.totalFrames} frames)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
