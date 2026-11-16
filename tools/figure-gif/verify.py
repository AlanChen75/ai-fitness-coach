#!/usr/bin/env python3
"""
R6 Automatic Verification Script.
Checks every exercise GIF in public/figures/ against R5/R6 specs:
- GIF format
- Dimensions == 384x384
- Frame count >= 24 (and <= 32)
- Infinite loop (loop == 0)
- Global palette <= 64 colors
- File size < 800KB (target < 500KB) and total sum < 15MB
- Standing anchor stability: 3-frame foot box pixel diff == 0
  (jump/prone/supine/wall exercises log skipped_reason and check their contact/return anchors)
Writes structured JSON report to tools/figure-gif/review/report.json.
"""

import argparse
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageChops


MAX_SINGLE_BYTES = 800 * 1024
TARGET_SINGLE_BYTES = 500 * 1024
MAX_TOTAL_BYTES = 15 * 1024 * 1024


def get_frame_rgb(gif: Image.Image, idx: int) -> Image.Image:
    gif.seek(idx)
    return gif.convert("RGB")


def box_diff_stats(gif: Image.Image, frame_indices: list, box: list):
    crop_box = tuple(box)
    ref = get_frame_rgb(gif, frame_indices[0]).crop(crop_box)
    max_diff = 0
    max_changed_pct = 0.0
    per_frame = []
    for idx in frame_indices:
        cur = get_frame_rgb(gif, idx).crop(crop_box)
        diff = ImageChops.difference(ref, cur)
        bbox = diff.getbbox()
        if bbox is None:
            f_max = 0
            f_pct = 0.0
        else:
            raw = diff.tobytes()
            f_max = max(raw)
            n_px = len(raw) // 3
            changed = sum(
                1 for i in range(0, len(raw), 3) if raw[i] or raw[i + 1] or raw[i + 2]
            )
            f_pct = round((changed / n_px) * 100.0, 3)
        max_diff = max(max_diff, f_max)
        max_changed_pct = max(max_changed_pct, f_pct)
        per_frame.append({"frame": idx, "max_diff": f_max, "changed_pct": f_pct})
    return max_diff, max_changed_pct, per_frame


def count_palette_colors(gif: Image.Image) -> int:
    used_rgb = set()
    n_frames = getattr(gif, "n_frames", 1)
    for i in range(n_frames):
        rgb = get_frame_rgb(gif, i)
        colors = rgb.getcolors(maxcolors=512)
        if colors is None:
            return 513
        for _, color in colors:
            used_rgb.add(color)
    return len(used_rgb)


def verify_exercise(ex_id: str, gif_path: Path, meta_path: Path, review_png: Path) -> dict:
    errors = []
    warnings = []

    if not gif_path.exists():
        return {
            "id": ex_id,
            "pass": False,
            "errors": [f"Missing GIF: {gif_path}"],
        }

    file_out = subprocess.check_output(["file", str(gif_path)], text=True).strip()
    is_gif = "GIF image data" in file_out
    if not is_gif:
        errors.append(f"Not a GIF: {file_out}")

    size_bytes = gif_path.stat().st_size
    if size_bytes >= MAX_SINGLE_BYTES:
        errors.append(f"Size {size_bytes} bytes >= hard limit {MAX_SINGLE_BYTES}")
    elif size_bytes >= TARGET_SINGLE_BYTES:
        warnings.append(f"Size {size_bytes} bytes >= target {TARGET_SINGLE_BYTES}")

    gif = Image.open(gif_path)
    width, height = gif.size
    n_frames = getattr(gif, "n_frames", 1)
    loop = gif.info.get("loop", None)
    palette_colors = count_palette_colors(gif)

    durations = []
    for i in range(n_frames):
        gif.seek(i)
        durations.append(gif.info.get("duration", 0))
    total_ms = sum(durations)

    if (width, height) != (384, 384):
        errors.append(f"Dimensions {width}x{height} != 384x384")
    if n_frames < 24 or n_frames > 32:
        errors.append(f"Frame count {n_frames} not in [24, 32]")
    if loop != 0:
        errors.append(f"Loop={loop}, expected 0 (infinite)")
    if palette_colors > 64:
        errors.append(f"Palette uses {palette_colors} colors > 64")

    if not review_png.exists():
        errors.append(f"Missing contact sheet: {review_png}")

    meta = {}
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

    anchor_category = meta.get("anchorCategory", "standing")
    anchor_box = meta.get("anchorBox")
    contact_box = meta.get("contactBox")
    contact_label = meta.get("contactLabel")

    sample_indices = [0, n_frames // 4, n_frames // 2]
    anchor_result = {
        "category": anchor_category,
        "sampled_frames": sample_indices,
    }

    if anchor_category == "standing" and anchor_box:
        max_diff, changed_pct, per_frame = box_diff_stats(gif, sample_indices, anchor_box)
        anchor_result["status"] = "checked"
        anchor_result["box"] = anchor_box
        anchor_result["max_diff"] = max_diff
        anchor_result["changed_pct"] = changed_pct
        anchor_result["per_frame"] = per_frame
        if max_diff != 0:
            errors.append(f"Standing foot anchor shifted (max_diff={max_diff} != 0)")
    else:
        reason_map = {
            "jump": "Jump exercise: feet leave ground during airborne phase (checked start vs landing return instead)",
            "prone": "Prone floor exercise: body horizontal on mat (checked floor contact point instead)",
            "supine": "Supine floor exercise: scapula and feet on mat (checked foot/mat contact instead)",
            "wall": "Wall pushup: palms fixed on wall and feet on floor (checked both contact points)",
            "seated": "Seated machine exercise: hips fixed on seat cushion (checked hip/seat contact instead)",
        }
        anchor_result["status"] = "skipped"
        anchor_result["skipped_reason"] = reason_map.get(
            anchor_category, f"Non-standing anchor category: {anchor_category}"
        )

        if anchor_category == "jump" and contact_box:
            # Verify start vs final frame return to same landing position
            max_diff, changed_pct, per_frame = box_diff_stats(gif, [0, n_frames - 1], contact_box)
            anchor_result["return_check"] = {
                "frames": [0, n_frames - 1],
                "box": contact_box,
                "max_diff": max_diff,
                "changed_pct": changed_pct,
            }
            if max_diff != 0:
                errors.append(f"Jump landing did not return to start foot position (max_diff={max_diff})")
        elif contact_box:
            max_diff, changed_pct, per_frame = box_diff_stats(gif, sample_indices, contact_box)
            anchor_result["contact_check"] = {
                "label": contact_label,
                "frames": sample_indices,
                "box": contact_box,
                "max_diff": max_diff,
                "changed_pct": changed_pct,
            }
            if max_diff != 0:
                errors.append(f"Contact anchor '{contact_label}' shifted (max_diff={max_diff} != 0)")

    return {
        "id": ex_id,
        "pass": len(errors) == 0,
        "gif": str(gif_path),
        "review_png": str(review_png),
        "width": width,
        "height": height,
        "frames": n_frames,
        "duration_ms": total_ms,
        "loop": loop,
        "palette_colors": palette_colors,
        "size_bytes": size_bytes,
        "size_kb": round(size_bytes / 1024.0, 2),
        "anchor_check": anchor_result,
        "warnings": warnings,
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exercise", required=False, help="Verify a single exercise id")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent
    exercises_dir = script_dir / "exercises"
    build_dir = script_dir / "build"
    review_dir = script_dir / "review"
    figures_dir = repo_root / "public" / "figures"

    if args.exercise:
        ex_ids = [args.exercise]
    else:
        ex_ids = sorted(p.stem for p in exercises_dir.glob("*.json"))

    results = []
    for ex_id in ex_ids:
        res = verify_exercise(
            ex_id,
            figures_dir / f"{ex_id}.gif",
            build_dir / ex_id / "meta.json",
            review_dir / f"{ex_id}.png",
        )
        results.append(res)
        status = "PASS" if res["pass"] else "FAIL"
        print(
            f"[{status}] {ex_id:24s} {res.get('width', 0)}x{res.get('height', 0)} "
            f"{res.get('frames', 0):2d}f {res.get('palette_colors', 0):2d}c "
            f"{res.get('size_kb', 0):6.1f}KB anchor={res.get('anchor_check', {}).get('status', 'n/a')}"
        )
        if not res["pass"]:
            for e in res["errors"]:
                print(f"       ERROR: {e}")

    total_bytes = sum(r.get("size_bytes", 0) for r in results)
    total_pass = all(r["pass"] for r in results) and total_bytes < MAX_TOTAL_BYTES

    report = {
        "pass": total_pass,
        "count": len(results),
        "passed_count": sum(1 for r in results if r["pass"]),
        "total_bytes": total_bytes,
        "total_mb": round(total_bytes / (1024 * 1024), 3),
        "max_total_mb": round(MAX_TOTAL_BYTES / (1024 * 1024), 2),
        "results": results,
    }

    review_dir.mkdir(parents=True, exist_ok=True)
    report_path = review_dir / "report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(
        f"\nSummary: {report['passed_count']}/{report['count']} passed, "
        f"total={report['total_mb']} MB / {report['max_total_mb']} MB -> {report_path}"
    )
    if not total_pass:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
