#!/usr/bin/env python3
"""
Assembles rendered 384x384 PNG frames into an infinite-loop GIF
with <= 64-color global palette + Bayer dithering, and builds a 3-phase contact sheet.
"""

import argparse
import glob
import json
import os
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw


def build_with_ffmpeg(frames_dir: Path, out_path: Path, fps: float, tmp_dir: Path):
    ffmpeg_bin = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    if not os.path.exists(ffmpeg_bin):
        raise FileNotFoundError(f"ffmpeg not found at {ffmpeg_bin}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pattern = str(frames_dir / "frame_%03d.png")
    palette_path = tmp_dir / "palette.png"

    # Pass 1: global palette <= 64 colors covering all animation states
    subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-framerate",
            str(fps),
            "-i",
            pattern,
            "-vf",
            "palettegen=max_colors=64:stats_mode=full",
            str(palette_path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Pass 2: temporally stable ordered Bayer dithering so anchored pixels stay identical
    subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-framerate",
            str(fps),
            "-i",
            pattern,
            "-i",
            str(palette_path),
            "-lavfi",
            "paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
            "-loop",
            "0",
            str(out_path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def build_contact_sheet(frames_dir: Path, review_path: Path, meta: dict):
    frame_paths = sorted(glob.glob(str(frames_dir / "frame_*.png")))
    if not frame_paths:
        raise RuntimeError(f"No PNG frames found in {frames_dir}")

    n = len(frame_paths)
    indices = [0, n // 4, n // 2]
    labels = ["Start (0%)", "Mid (~25%)", "Peak (~50%)"]

    imgs = [Image.open(frame_paths[i]).convert("RGB") for i in indices]
    w, h = imgs[0].size
    header_h = 44
    footer_h = 28
    pad = 12

    sheet_w = w * 3 + pad * 4
    sheet_h = header_h + h + footer_h + pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), (245, 247, 250))
    draw = ImageDraw.Draw(sheet)

    muscles = ", ".join(meta.get("highlightMuscles", []))
    title = f"{meta.get('id', '')} | view={meta.get('view', '')} | muscles={muscles}"
    draw.text((pad, 14), title, fill=(30, 41, 59))

    for col, (img, idx, lbl) in enumerate(zip(imgs, indices, labels)):
        x = pad + col * (w + pad)
        y = header_h
        sheet.paste(img, (x, y))
        draw.rectangle([x, y, x + w - 1, y + h - 1], outline=(203, 213, 225), width=1)
        draw.text((x + 6, y + h + 6), f"{lbl} [frame {idx:02d}/{n}]", fill=(71, 85, 105))

    review_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(str(review_path))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-dir", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--review-out", required=False)
    args = parser.parse_args()

    build_dir = Path(args.build_dir).resolve()
    frames_dir = build_dir / "frames"
    out_path = Path(args.out).resolve()
    meta_path = build_dir / "meta.json"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    build_with_ffmpeg(frames_dir, out_path, meta["fps"], build_dir)
    if args.review_out:
        build_contact_sheet(frames_dir, Path(args.review_out).resolve(), meta)

    size_bytes = out_path.stat().st_size
    print(f"Built {out_path.name} ({size_bytes / 1024:.1f} KB, {meta['totalFrames']} frames)")


if __name__ == "__main__":
    main()
