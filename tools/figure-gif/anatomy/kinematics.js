/**
 * Parameterized skeletal kinematics solver and cyclic keyframe interpolator.
 * Supports side-view and front-view rigs with exact anchor modes and 2-bone IK.
 *
 * Angle convention (degrees, standard math orientation mapped to screen coords):
 *   0   = +x (right / forward)
 *   90  = -y (straight up)
 *   180 = -x (left / backward)
 *   -90 = +y (straight down)
 */

const { add, clamp, lerp, stepFromDeg } = require('./svgUtils');

/**
 * Monotonic piecewise cubic Hermite interpolation (Fritsch-Carlson / PCHIP)
 * for a single scalar channel across sorted keyframes. Guarantees C1 continuity
 * without overshoot across flat holds.
 */
function pchipScalar(times, values, t) {
  const n = times.length;
  if (n === 1) return values[0];
  if (t <= times[0]) return values[0];
  if (t >= times[n - 1]) return values[n - 1];

  const h = [];
  const delta = [];
  for (let i = 0; i < n - 1; i++) {
    const dt = Math.max(1e-6, times[i + 1] - times[i]);
    h.push(dt);
    delta.push((values[i + 1] - values[i]) / dt);
  }

  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const d0 = delta[i - 1];
    const d1 = delta[i];
    if (d0 === 0 || d1 === 0 || (d0 > 0) !== (d1 > 0)) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d0 + w2 / d1);
    }
  }

  m[0] = 0;
  m[n - 1] = 0;

  let idx = 0;
  for (let i = 0; i < n - 1; i++) {
    if (t >= times[i] && t <= times[i + 1]) {
      idx = i;
      break;
    }
  }

  const s = (t - times[idx]) / h[idx];
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;

  return (
    h00 * values[idx] +
    h10 * h[idx] * m[idx] +
    h01 * values[idx + 1] +
    h11 * h[idx] * m[idx + 1]
  );
}

/**
 * Interpolates a pose dictionary at normalized cycle phase t in [0, 1).
 */
function interpolatePose(keyframes, phase) {
  const t = ((phase % 1) + 1) % 1;
  const times = keyframes.map((k) => k.t);
  const keySet = new Set();
  for (const kf of keyframes) {
    for (const k of Object.keys(kf.pose)) keySet.add(k);
  }
  const result = {};

  for (const k of keySet) {
    let values = keyframes.map((kf) =>
      kf.pose[k] !== undefined ? kf.pose[k] : keyframes[0].pose[k] || 0
    );
    // 角度通道走最短旋轉路徑：連續 keyframe 差超過 180 度時 unwrap（加減 360），
    // 否則 -156 -> +154 這種跨 ±180 的對稱姿勢會被數值直線內插成反向大迴旋
    // （肢體掃過身體中線）。旋轉渲染對 360 週期不敏感，unwrap 後畫面等價。
    if (k.endsWith('Angle')) {
      values = values.reduce((acc, v) => {
        if (acc.length === 0) return [v];
        const prev = acc[acc.length - 1];
        let adjusted = v;
        while (adjusted - prev > 180) adjusted -= 360;
        while (adjusted - prev < -180) adjusted += 360;
        return [...acc, adjusted];
      }, []);
    }
    result[k] = pchipScalar(times, values, t);
  }
  return result;
}

/**
 * Analytical 2-bone IK in screen coords (+x right, +y down).
 * Returns joint position between pStart and pEnd with exact lengths len1, len2.
 */
function solveTwoBoneIK(pStart, pEnd, len1, len2, bendSign = 1) {
  const dx = pEnd.x - pStart.x;
  const dy = pEnd.y - pStart.y;
  const minD = Math.abs(len1 - len2) + 0.5;
  const maxD = len1 + len2 - 0.5;
  const rawD = Math.hypot(dx, dy);
  const d = clamp(rawD, minD, maxD);

  const cosA = clamp((len1 * len1 + d * d - len2 * len2) / (2 * len1 * d), -1, 1);
  const baseAngle = Math.atan2(dy, dx);
  const offset = Math.acos(cosA);
  const theta = baseAngle + bendSign * offset;

  return {
    x: pStart.x + len1 * Math.cos(theta),
    y: pStart.y + len1 * Math.sin(theta),
  };
}

/**
 * Computes ankle position when pivoting around ball of foot (for calf-raise / lean).
 */
function solveBallPivotAnkle(anchorX, groundY, proportions, heelRaise, footAngleDeg) {
  const { segments } = proportions;
  const defaultAnkle = { x: anchorX, y: groundY - segments.ankleHeight };
  if (!heelRaise && !footAngleDeg) {
    return { ankle: defaultAnkle, footPivot: null, footAngle: 0 };
  }
  const ballPos = { x: anchorX + segments.footFront - 14, y: groundY };
  const angleRad = ((footAngleDeg || heelRaise * 1.4) * Math.PI) / 180;
  const dx = defaultAnkle.x - ballPos.x;
  const dy = defaultAnkle.y - ballPos.y;
  // Clockwise rotation lifts the heel (left side) upward (-y) while keeping ball fixed
  const cosR = Math.cos(angleRad);
  const sinR = Math.sin(angleRad);
  const ankle = {
    x: ballPos.x + dx * cosR - dy * sinR,
    y: ballPos.y + dx * sinR + dy * cosR,
  };
  return {
    ankle,
    footPivot: ballPos,
    footAngle: (angleRad * 180) / Math.PI,
  };
}

function solveSideSkeleton(exerciseConfig, pose, proportions) {
  const { segments, farOffset, canvas } = proportions;
  const anchorMode = exerciseConfig.anchor || 'feet';
  const anchorX = exerciseConfig.anchorX !== undefined ? exerciseConfig.anchorX : 224;
  const groundY = exerciseConfig.groundY !== undefined ? exerciseConfig.groundY : canvas.groundY;

  if (anchorMode === 'feet') {
    const footOffsetY = pose.footOffsetY || 0;
    const nearFootOffsetX = pose.nearFootOffsetX || 0;
    const heelRaise = pose.heelRaise || 0;
    const footAngle = pose.footAngle || 0;

    let nearAnkle;
    let footPivot = null;
    let effectiveFootAngle = footAngle;

    if (exerciseConfig.anchorPivot === 'metatarsal') {
      const ballPos = { x: anchorX + nearFootOffsetX + segments.footFront - 14, y: groundY };
      nearAnkle = {
        x: anchorX + nearFootOffsetX + heelRaise * 0.25,
        y: groundY - segments.ankleHeight + footOffsetY - heelRaise,
      };
      footPivot = ballPos;
    } else if (exerciseConfig.anchorPivot === 'ball' && (heelRaise > 0 || footAngle > 0)) {
      const pivoted = solveBallPivotAnkle(
        anchorX + nearFootOffsetX,
        groundY + footOffsetY,
        proportions,
        heelRaise,
        footAngle
      );
      nearAnkle = pivoted.ankle;
      footPivot = pivoted.footPivot;
      effectiveFootAngle = pivoted.footAngle;
    } else {
      nearAnkle = {
        x: anchorX + nearFootOffsetX,
        y: groundY - segments.ankleHeight + footOffsetY - heelRaise,
      };
    }

    const nearKnee = stepFromDeg(nearAnkle, segments.shin, pose.shinAngle);
    const nearHip = stepFromDeg(nearKnee, segments.thigh, pose.thighAngle);
    const nearShoulder = stepFromDeg(nearHip, segments.torso, pose.torsoAngle);

    const neckAngle =
      pose.neckAngle !== undefined ? pose.neckAngle : lerp(pose.torsoAngle, 90, 0.45);
    const neckTop = stepFromDeg(nearShoulder, segments.neck, neckAngle);
    const headPitch = pose.headPitch !== undefined ? pose.headPitch : 0;
    const headCenter = {
      x: neckTop.x + 2,
      y: neckTop.y - segments.headRadius * 0.72,
    };

    const nearElbow = stepFromDeg(nearShoulder, segments.upperArm, pose.upperArmAngle);
    const nearWrist = stepFromDeg(nearElbow, segments.forearm, pose.forearmAngle);
    const handAngle = pose.handAngle !== undefined ? pose.handAngle : pose.forearmAngle;
    const nearHandTip = stepFromDeg(nearWrist, segments.hand, handAngle);

    const farHip = add(nearHip, farOffset.hip);
    const farShoulder = add(nearShoulder, farOffset.shoulder);
    const farUpperArmAngle =
      pose.farUpperArmAngle !== undefined ? pose.farUpperArmAngle : pose.upperArmAngle;
    const farForearmAngle =
      pose.farForearmAngle !== undefined ? pose.farForearmAngle : pose.forearmAngle;
    const farElbow = stepFromDeg(farShoulder, segments.upperArm, farUpperArmAngle);
    const farWrist = stepFromDeg(farElbow, segments.forearm, farForearmAngle);
    const farHandTip = stepFromDeg(
      farWrist,
      segments.hand,
      pose.farHandAngle !== undefined ? pose.farHandAngle : farForearmAngle
    );

    let farAnkle;
    let farKnee;
    let farFootAngle = pose.farFootAngle || 0;
    let farFootY = groundY + farOffset.foot.y + footOffsetY;

    const backLegMode = exerciseConfig.backLegMode || 'mirror';
    if (backLegMode === 'free') {
      const fThigh = pose.farThighAngle !== undefined ? pose.farThighAngle : -90;
      const fShin = pose.farShinAngle !== undefined ? pose.farShinAngle : -90;
      farKnee = stepFromDeg(farHip, segments.thigh, fThigh);
      farAnkle = stepFromDeg(farKnee, segments.shin, fShin);
      farFootY = farAnkle.y + segments.ankleHeight;
    } else if (backLegMode === 'split-ik') {
      const baseBackX =
        exerciseConfig.backAnkleX !== undefined ? exerciseConfig.backAnkleX : anchorX - 110;
      const baseBackY =
        exerciseConfig.backAnkleY !== undefined
          ? exerciseConfig.backAnkleY
          : groundY - segments.ankleHeight;
      farAnkle = {
        x: baseBackX + (pose.farFootOffsetX || 0),
        y: baseBackY + (pose.farFootOffsetY !== undefined ? pose.farFootOffsetY : footOffsetY),
      };
      farKnee = solveTwoBoneIK(farHip, farAnkle, segments.thigh, segments.shin, -1);
      farFootY = farAnkle.y + segments.ankleHeight;
    } else {
      const farShinAngle = pose.farShinAngle !== undefined ? pose.farShinAngle : pose.shinAngle;
      if (exerciseConfig.anchorPivot === 'metatarsal') {
        farAnkle = {
          x: anchorX + farOffset.foot.x + nearFootOffsetX + heelRaise * 0.25,
          y: groundY + farOffset.foot.y - segments.ankleHeight + footOffsetY - heelRaise,
        };
      } else if (exerciseConfig.anchorPivot === 'ball' && (heelRaise > 0 || footAngle > 0)) {
        const farPivoted = solveBallPivotAnkle(
          anchorX + farOffset.foot.x + nearFootOffsetX,
          groundY + farOffset.foot.y + footOffsetY,
          proportions,
          heelRaise,
          footAngle
        );
        farAnkle = farPivoted.ankle;
        farFootAngle = farPivoted.footAngle;
      } else {
        farAnkle = add(nearAnkle, farOffset.foot);
      }
      farKnee = stepFromDeg(farAnkle, segments.shin, farShinAngle);
    }

    return {
      view: 'side',
      groundY,
      footOffsetY,
      metatarsalFlat: exerciseConfig.anchorPivot === 'metatarsal',
      near: {
        ankle: nearAnkle,
        knee: nearKnee,
        hip: nearHip,
        shoulder: nearShoulder,
        neckTop,
        headCenter,
        headPitch,
        elbow: nearElbow,
        wrist: nearWrist,
        handTip: nearHandTip,
        footAngle: effectiveFootAngle,
        footPivot,
        footY: groundY + footOffsetY,
      },
      far: {
        ankle: farAnkle,
        knee: farKnee,
        hip: farHip,
        shoulder: farShoulder,
        elbow: farElbow,
        wrist: farWrist,
        handTip: farHandTip,
        footAngle: farFootAngle,
        footPivot:
          exerciseConfig.anchorPivot === 'metatarsal'
            ? {
                x: anchorX + farOffset.foot.x + nearFootOffsetX + segments.footFront - 14,
                y: groundY + farOffset.foot.y,
              }
            : null,
        footY: farFootY,
      },
      angles: { ...pose },
    };
  }

  if (anchorMode === 'wall-pushup') {
    const wallX = exerciseConfig.wallX !== undefined ? exerciseConfig.wallX : 368;
    const wristY = exerciseConfig.wristY !== undefined ? exerciseConfig.wristY : 120;
    const nearAnkle = { x: anchorX, y: groundY - segments.ankleHeight };

    const nearKnee = stepFromDeg(nearAnkle, segments.shin, pose.shinAngle);
    const nearHip = stepFromDeg(nearKnee, segments.thigh, pose.thighAngle);
    const nearShoulder = stepFromDeg(nearHip, segments.torso, pose.torsoAngle);
    const neckAngle =
      pose.neckAngle !== undefined ? pose.neckAngle : lerp(pose.torsoAngle, 90, 0.3);
    const neckTop = stepFromDeg(nearShoulder, segments.neck, neckAngle);
    const headCenter = {
      x: neckTop.x + 4,
      y: neckTop.y - segments.headRadius * 0.72,
    };

    const nearWrist = { x: wallX - 7, y: wristY };
    const nearElbow = solveTwoBoneIK(nearShoulder, nearWrist, segments.upperArm, segments.forearm, 1);
    const nearHandTip = stepFromDeg(nearWrist, segments.hand * 0.85, 90);

    const farAnkle = add(nearAnkle, farOffset.foot);
    const farKnee = add(nearKnee, farOffset.knee);
    const farHip = add(nearHip, farOffset.hip);
    const farShoulder = add(nearShoulder, farOffset.shoulder);
    const farWrist = add(nearWrist, { x: 0, y: -4 });
    const farElbow = solveTwoBoneIK(farShoulder, farWrist, segments.upperArm, segments.forearm, 1);
    const farHandTip = stepFromDeg(farWrist, segments.hand * 0.85, 90);

    return {
      view: 'side',
      groundY,
      wallX,
      near: {
        ankle: nearAnkle,
        knee: nearKnee,
        hip: nearHip,
        shoulder: nearShoulder,
        neckTop,
        headCenter,
        headPitch: pose.headPitch || 0,
        elbow: nearElbow,
        wrist: nearWrist,
        handTip: nearHandTip,
        footAngle: pose.footAngle || 0,
        footY: groundY,
      },
      far: {
        ankle: farAnkle,
        knee: farKnee,
        hip: farHip,
        shoulder: farShoulder,
        elbow: farElbow,
        wrist: farWrist,
        handTip: farHandTip,
        footAngle: pose.farFootAngle || 0,
        footY: groundY + farOffset.foot.y,
      },
      angles: { ...pose },
    };
  }

  if (anchorMode === 'pushup') {
    const wristX = exerciseConfig.wristAnchorX !== undefined ? exerciseConfig.wristAnchorX : 394;
    const nearAnkle = { x: anchorX, y: groundY - 48 };
    const nearKnee = stepFromDeg(nearAnkle, segments.shin, pose.plankAngle);
    const nearHip = stepFromDeg(nearKnee, segments.thigh, pose.plankAngle);
    const nearShoulder = stepFromDeg(nearHip, segments.torso, pose.plankAngle);
    const neckTop = stepFromDeg(nearShoulder, segments.neck, pose.plankAngle + 10);
    const headCenter = {
      x: neckTop.x + 12,
      y: neckTop.y - 4,
    };

    const nearWrist = { x: wristX, y: groundY - 7 };
    const nearElbow = solveTwoBoneIK(nearShoulder, nearWrist, segments.upperArm, segments.forearm, 1);
    const nearHandTip = stepFromDeg(nearWrist, segments.hand * 0.9, 0);

    const farAnkle = add(nearAnkle, farOffset.foot);
    const farKnee = add(nearKnee, farOffset.knee);
    const farHip = add(nearHip, farOffset.hip);
    const farShoulder = add(nearShoulder, farOffset.shoulder);
    const farWrist = add(nearWrist, { x: 8, y: -4 });
    const farElbow = solveTwoBoneIK(farShoulder, farWrist, segments.upperArm, segments.forearm, 1);
    const farHandTip = stepFromDeg(farWrist, segments.hand * 0.9, 0);

    return {
      view: 'side',
      groundY,
      proneFootMode: 'toes',
      near: {
        ankle: nearAnkle,
        knee: nearKnee,
        hip: nearHip,
        shoulder: nearShoulder,
        neckTop,
        headCenter,
        headPitch: pose.headPitch !== undefined ? pose.headPitch : 42,
        elbow: nearElbow,
        wrist: nearWrist,
        handTip: nearHandTip,
        footAngle: 72,
        footPivot: nearAnkle,
        footY: groundY,
      },
      far: {
        ankle: farAnkle,
        knee: farKnee,
        hip: farHip,
        shoulder: farShoulder,
        elbow: farElbow,
        wrist: farWrist,
        handTip: farHandTip,
        footAngle: 72,
        footPivot: farAnkle,
        footY: groundY + farOffset.foot.y,
      },
      angles: { ...pose },
    };
  }

  if (anchorMode === 'knee-pushup') {
    const wristX = exerciseConfig.wristAnchorX !== undefined ? exerciseConfig.wristAnchorX : 368;
    const nearKnee = { x: anchorX, y: groundY - 12 };
    const nearAnkle = stepFromDeg(nearKnee, segments.shin, pose.shinAngle || 142);
    const nearHip = stepFromDeg(nearKnee, segments.thigh, pose.plankAngle);
    const nearShoulder = stepFromDeg(nearHip, segments.torso, pose.plankAngle);
    const neckTop = stepFromDeg(nearShoulder, segments.neck, pose.plankAngle + 10);
    const headCenter = {
      x: neckTop.x + 12,
      y: neckTop.y - 4,
    };

    const nearWrist = { x: wristX, y: groundY - 7 };
    const nearElbow = solveTwoBoneIK(nearShoulder, nearWrist, segments.upperArm, segments.forearm, 1);
    const nearHandTip = stepFromDeg(nearWrist, segments.hand * 0.9, 0);

    const farKnee = add(nearKnee, { x: 8, y: -4 });
    const farAnkle = add(nearAnkle, { x: 8, y: -4 });
    const farHip = add(nearHip, farOffset.hip);
    const farShoulder = add(nearShoulder, farOffset.shoulder);
    const farWrist = add(nearWrist, { x: 8, y: -4 });
    const farElbow = solveTwoBoneIK(farShoulder, farWrist, segments.upperArm, segments.forearm, 1);
    const farHandTip = stepFromDeg(farWrist, segments.hand * 0.9, 0);

    return {
      view: 'side',
      groundY,
      proneFootMode: 'lifted',
      near: {
        ankle: nearAnkle,
        knee: nearKnee,
        hip: nearHip,
        shoulder: nearShoulder,
        neckTop,
        headCenter,
        headPitch: pose.headPitch !== undefined ? pose.headPitch : 38,
        elbow: nearElbow,
        wrist: nearWrist,
        handTip: nearHandTip,
        footAngle: 42,
        footPivot: nearAnkle,
        footY: nearAnkle.y + segments.ankleHeight,
      },
      far: {
        ankle: farAnkle,
        knee: farKnee,
        hip: farHip,
        shoulder: farShoulder,
        elbow: farElbow,
        wrist: farWrist,
        handTip: farHandTip,
        footAngle: 42,
        footPivot: farAnkle,
        footY: farAnkle.y + segments.ankleHeight,
      },
      angles: { ...pose },
    };
  }

  if (anchorMode === 'glute-bridge') {
    const shoulderX =
      exerciseConfig.shoulderAnchorX !== undefined ? exerciseConfig.shoulderAnchorX : 156;
    const footX = exerciseConfig.anchorX !== undefined ? exerciseConfig.anchorX : 390;

    const nearShoulder = { x: shoulderX, y: groundY - 21 };
    const nearHip = stepFromDeg(nearShoulder, segments.torso, pose.torsoAngle);
    const nearAnkle = { x: footX, y: groundY - segments.ankleHeight };
    const nearKnee = solveTwoBoneIK(nearHip, nearAnkle, segments.thigh, segments.shin, -1);

    const neckTop = { x: nearShoulder.x - 16, y: groundY - 19 };
    const headCenter = { x: nearShoulder.x - 36, y: groundY - 24 };

    // Arms flat along the floor mat beside the body
    const nearElbow = { x: nearShoulder.x + 62, y: groundY - 10 };
    const nearWrist = { x: nearShoulder.x + 122, y: groundY - 8 };
    const nearHandTip = { x: nearWrist.x + 24, y: groundY - 7 };

    const farAnkle = add(nearAnkle, farOffset.foot);
    const farHip = add(nearHip, farOffset.hip);
    const farKnee = solveTwoBoneIK(farHip, farAnkle, segments.thigh, segments.shin, -1);
    const farShoulder = add(nearShoulder, farOffset.shoulder);
    const farElbow = add(nearElbow, { x: 4, y: -3 });
    const farWrist = add(nearWrist, { x: 4, y: -3 });
    const farHandTip = add(nearHandTip, { x: 4, y: -3 });

    return {
      view: 'side',
      groundY,
      supine: true,
      near: {
        ankle: nearAnkle,
        knee: nearKnee,
        hip: nearHip,
        shoulder: nearShoulder,
        neckTop,
        headCenter,
        headPitch: pose.headPitch !== undefined ? pose.headPitch : -72,
        elbow: nearElbow,
        wrist: nearWrist,
        handTip: nearHandTip,
        footAngle: 0,
        footY: groundY,
      },
      far: {
        ankle: farAnkle,
        knee: farKnee,
        hip: farHip,
        shoulder: farShoulder,
        elbow: farElbow,
        wrist: farWrist,
        handTip: farHandTip,
        footAngle: 0,
        footY: groundY + farOffset.foot.y,
      },
      angles: { ...pose },
    };
  }

  if (anchorMode === 'seated') {
    const hipY =
      exerciseConfig.hipY !== undefined
        ? exerciseConfig.hipY
        : groundY - segments.ankleHeight - segments.shin;
    const seatY = exerciseConfig.seatY !== undefined ? exerciseConfig.seatY : hipY + 22;
    const nearHip = { x: anchorX, y: hipY };
    const thighAngle = pose.thighAngle !== undefined ? pose.thighAngle : 0;
    const shinAngle = pose.shinAngle !== undefined ? pose.shinAngle : -90;
    const torsoAngle = pose.torsoAngle !== undefined ? pose.torsoAngle : 90;

    const nearKnee = stepFromDeg(nearHip, segments.thigh, thighAngle);
    const nearAnkle = stepFromDeg(nearKnee, segments.shin, shinAngle);
    const nearShoulder = stepFromDeg(nearHip, segments.torso, torsoAngle);

    const neckAngle =
      pose.neckAngle !== undefined ? pose.neckAngle : lerp(torsoAngle, 90, 0.45);
    const neckTop = stepFromDeg(nearShoulder, segments.neck, neckAngle);
    const headPitch = pose.headPitch !== undefined ? pose.headPitch : 0;
    const headCenter = {
      x: neckTop.x + 2,
      y: neckTop.y - segments.headRadius * 0.72,
    };

    const farHip = add(nearHip, farOffset.hip);
    const farKnee = add(nearKnee, farOffset.knee);
    const farAnkle = add(nearAnkle, farOffset.foot);
    const farShoulder = add(nearShoulder, farOffset.shoulder);

    let nearElbow;
    let nearWrist;
    let nearHandTip;
    let farElbow;
    let farWrist;
    let farHandTip;

    if (pose.wristX !== undefined && pose.wristY !== undefined) {
      nearWrist = { x: pose.wristX, y: pose.wristY };
      const bendSign =
        pose.armBendSign !== undefined
          ? pose.armBendSign
          : exerciseConfig.armBendSign !== undefined
            ? exerciseConfig.armBendSign
            : 1;
      nearElbow = solveTwoBoneIK(
        nearShoulder,
        nearWrist,
        segments.upperArm,
        segments.forearm,
        bendSign
      );
      const forearmDeg =
        (Math.atan2(-(nearWrist.y - nearElbow.y), nearWrist.x - nearElbow.x) * 180) / Math.PI;
      const handAngle = pose.handAngle !== undefined ? pose.handAngle : forearmDeg;
      nearHandTip = stepFromDeg(nearWrist, segments.hand * 0.85, handAngle);

      const fOff = exerciseConfig.farWristOffset || { x: 10, y: -3 };
      farWrist = add(nearWrist, fOff);
      farElbow = solveTwoBoneIK(
        farShoulder,
        farWrist,
        segments.upperArm,
        segments.forearm,
        bendSign
      );
      const farHandAngle = pose.farHandAngle !== undefined ? pose.farHandAngle : handAngle;
      farHandTip = stepFromDeg(farWrist, segments.hand * 0.85, farHandAngle);
    } else {
      nearElbow = stepFromDeg(nearShoulder, segments.upperArm, pose.upperArmAngle);
      nearWrist = stepFromDeg(nearElbow, segments.forearm, pose.forearmAngle);
      const handAngle = pose.handAngle !== undefined ? pose.handAngle : pose.forearmAngle;
      nearHandTip = stepFromDeg(nearWrist, segments.hand * 0.9, handAngle);

      const farUa =
        pose.farUpperArmAngle !== undefined ? pose.farUpperArmAngle : pose.upperArmAngle;
      const farFa =
        pose.farForearmAngle !== undefined ? pose.farForearmAngle : pose.forearmAngle;
      farElbow = stepFromDeg(farShoulder, segments.upperArm, farUa);
      farWrist = stepFromDeg(farElbow, segments.forearm, farFa);
      farHandTip = stepFromDeg(
        farWrist,
        segments.hand * 0.9,
        pose.farHandAngle !== undefined ? pose.farHandAngle : farFa
      );
    }

    const footAngle = pose.footAngle || 0;
    const farFootAngle = pose.farFootAngle !== undefined ? pose.farFootAngle : footAngle;

    return {
      view: 'side',
      groundY,
      seated: true,
      seatY,
      near: {
        ankle: nearAnkle,
        knee: nearKnee,
        hip: nearHip,
        shoulder: nearShoulder,
        neckTop,
        headCenter,
        headPitch,
        elbow: nearElbow,
        wrist: nearWrist,
        handTip: nearHandTip,
        footAngle,
        footY: nearAnkle.y + segments.ankleHeight,
      },
      far: {
        ankle: farAnkle,
        knee: farKnee,
        hip: farHip,
        shoulder: farShoulder,
        elbow: farElbow,
        wrist: farWrist,
        handTip: farHandTip,
        footAngle: farFootAngle,
        footY: farAnkle.y + segments.ankleHeight,
      },
      angles: { ...pose },
    };
  }

  if (anchorMode === 'leg-press') {
    const hipY = exerciseConfig.hipY !== undefined ? exerciseConfig.hipY : 386;
    const seatY = exerciseConfig.seatY !== undefined ? exerciseConfig.seatY : hipY + 20;
    const nearHip = { x: anchorX, y: hipY };
    const torsoAngle = pose.torsoAngle !== undefined ? pose.torsoAngle : 128;
    const nearShoulder = stepFromDeg(nearHip, segments.torso, torsoAngle);

    const neckAngle =
      pose.neckAngle !== undefined ? pose.neckAngle : lerp(torsoAngle, 90, 0.25);
    const neckTop = stepFromDeg(nearShoulder, segments.neck, neckAngle);
    const headPitch = pose.headPitch !== undefined ? pose.headPitch : 22;
    const headCenter = {
      x: neckTop.x + 3,
      y: neckTop.y - segments.headRadius * 0.72,
    };

    const nearAnkle = { x: pose.ankleX, y: pose.ankleY };
    const nearKnee = solveTwoBoneIK(nearHip, nearAnkle, segments.thigh, segments.shin, -1);

    const ua = pose.upperArmAngle !== undefined ? pose.upperArmAngle : -76;
    const fa = pose.forearmAngle !== undefined ? pose.forearmAngle : -14;
    const nearElbow = stepFromDeg(nearShoulder, segments.upperArm, ua);
    const nearWrist = stepFromDeg(nearElbow, segments.forearm, fa);
    const nearHandTip = stepFromDeg(
      nearWrist,
      segments.hand * 0.85,
      pose.handAngle !== undefined ? pose.handAngle : fa
    );

    const farHip = add(nearHip, farOffset.hip);
    const farAnkle = add(nearAnkle, { x: 8, y: -6 });
    const farKnee = solveTwoBoneIK(farHip, farAnkle, segments.thigh, segments.shin, -1);
    const farShoulder = add(nearShoulder, farOffset.shoulder);
    const farElbow = add(nearElbow, { x: 6, y: -2 });
    const farWrist = add(nearWrist, { x: 6, y: -2 });
    const farHandTip = add(nearHandTip, { x: 6, y: -2 });

    const footAngle = pose.footAngle !== undefined ? pose.footAngle : -114;

    return {
      view: 'side',
      groundY,
      seated: true,
      seatY,
      near: {
        ankle: nearAnkle,
        knee: nearKnee,
        hip: nearHip,
        shoulder: nearShoulder,
        neckTop,
        headCenter,
        headPitch,
        elbow: nearElbow,
        wrist: nearWrist,
        handTip: nearHandTip,
        footAngle,
        footPivot: nearAnkle,
        footY: nearAnkle.y + segments.ankleHeight,
      },
      far: {
        ankle: farAnkle,
        knee: farKnee,
        hip: farHip,
        shoulder: farShoulder,
        elbow: farElbow,
        wrist: farWrist,
        handTip: farHandTip,
        footAngle,
        footPivot: farAnkle,
        footY: farAnkle.y + segments.ankleHeight,
      },
      angles: { ...pose },
    };
  }

  throw new Error(`Unsupported side anchor mode: ${anchorMode}`);
}

/**
 * Projects a 3D limb segment with lateral abduction (deg from straight down,
 * + = outward away from midline) and sagittal forward flexion (deg toward camera,
 * 0 = vertical, 90 = straight toward viewer).
 */
function projectFrontLimb(origin, length, sideSign, abductionDeg, flexionDeg) {
  const abd = (abductionDeg * Math.PI) / 180;
  const flex = (flexionDeg * Math.PI) / 180;
  const dx = sideSign * length * Math.sin(abd) * Math.cos(flex * 0.35);
  const dy = length * Math.cos(abd) * Math.cos(flex);
  const dz = length * Math.sin(flex);
  return {
    pt: { x: origin.x + dx, y: origin.y + dy },
    depthZ: dz,
  };
}

function solveFrontSkeleton(exerciseConfig, pose, proportions) {
  const { segments, front, canvas } = proportions;
  const centerX = exerciseConfig.anchorX !== undefined ? exerciseConfig.anchorX : 256;
  const groundY = exerciseConfig.groundY !== undefined ? exerciseConfig.groundY : canvas.groundY;
  const standingHipY = groundY - segments.ankleHeight - segments.shin - segments.thigh;
  const ankleY = groundY - segments.ankleHeight;

  const frontMode = exerciseConfig.frontMode || 'standing';

  if (frontMode === 'sumo-squat') {
    const stanceHalfW = exerciseConfig.stanceHalfW || 68;
    const hipDrop = pose.hipDrop || 0;
    const hipCenter = { x: centerX, y: standingHipY + hipDrop };

    const leftAnkle = { x: centerX - stanceHalfW, y: ankleY };
    const rightAnkle = { x: centerX + stanceHalfW, y: ankleY };
    const leftHip = { x: hipCenter.x - front.legSocketX, y: hipCenter.y };
    const rightHip = { x: hipCenter.x + front.legSocketX, y: hipCenter.y };

    // Knees track outward over wide toes and foreshorten toward camera as hips descend
    const kneeOutX = pose.kneeOutX !== undefined ? pose.kneeOutX : stanceHalfW + 6;
    const kneeY = lerp(standingHipY + segments.thigh, ankleY - segments.shin * 0.88, clamp(hipDrop / 90, 0, 1));
    const leftKnee = { x: centerX - kneeOutX, y: kneeY };
    const rightKnee = { x: centerX + kneeOutX, y: kneeY };

    const torsoLen = segments.torso * (1 - clamp(hipDrop / 360, 0, 0.14));
    const torsoTilt = pose.torsoTilt || 0;
    const shoulderCenter = stepFromDeg(hipCenter, torsoLen, 90 - torsoTilt);
    const neckTop = stepFromDeg(shoulderCenter, segments.neck, 90 - torsoTilt * 0.5);
    const headCenter = { x: neckTop.x, y: neckTop.y - front.headRy * 0.72 };

    const leftShoulder = { x: shoulderCenter.x - front.shoulderHalfW, y: shoulderCenter.y + 4 };
    const rightShoulder = { x: shoulderCenter.x + front.shoulderHalfW, y: shoulderCenter.y + 4 };

    const lUa = pose.leftUpperArmAngle !== undefined ? pose.leftUpperArmAngle : -106;
    const rUa = pose.rightUpperArmAngle !== undefined ? pose.rightUpperArmAngle : -74;
    const lFa = pose.leftForearmAngle !== undefined ? pose.leftForearmAngle : -92;
    const rFa = pose.rightForearmAngle !== undefined ? pose.rightForearmAngle : -88;

    const leftElbow = stepFromDeg(leftShoulder, segments.upperArm, lUa);
    const leftWrist = stepFromDeg(leftElbow, segments.forearm, lFa);
    const leftHandTip = stepFromDeg(leftWrist, segments.hand, lFa);

    const rightElbow = stepFromDeg(rightShoulder, segments.upperArm, rUa);
    const rightWrist = stepFromDeg(rightElbow, segments.forearm, rFa);
    const rightHandTip = stepFromDeg(rightWrist, segments.hand, rFa);

    return {
      view: 'front',
      groundY,
      hipCenter,
      shoulderCenter,
      neckTop,
      headCenter,
      left: {
        hip: leftHip,
        knee: leftKnee,
        ankle: leftAnkle,
        footY: groundY,
        footTurnOut: -18,
        kneeDepth: clamp(hipDrop / 80, 0, 1),
        shoulder: leftShoulder,
        elbow: leftElbow,
        wrist: leftWrist,
        handTip: leftHandTip,
      },
      right: {
        hip: rightHip,
        knee: rightKnee,
        ankle: rightAnkle,
        footY: groundY,
        footTurnOut: 18,
        kneeDepth: clamp(hipDrop / 80, 0, 1),
        shoulder: rightShoulder,
        elbow: rightElbow,
        wrist: rightWrist,
        handTip: rightHandTip,
      },
      angles: { ...pose },
    };
  }

  if (frontMode === 'seated') {
    const seatHipY = exerciseConfig.hipY !== undefined ? exerciseConfig.hipY : 300;
    const seatY = exerciseConfig.seatY !== undefined ? exerciseConfig.seatY : seatHipY + 18;
    const hipCenter = { x: centerX, y: seatHipY };
    const leftHip = { x: hipCenter.x - front.legSocketX, y: hipCenter.y };
    const rightHip = { x: hipCenter.x + front.legSocketX, y: hipCenter.y };

    const lThighAbd = pose.leftThighAbd !== undefined ? pose.leftThighAbd : 8;
    const lThighFlex = pose.leftThighFlex !== undefined ? pose.leftThighFlex : 76;
    const rThighAbd = pose.rightThighAbd !== undefined ? pose.rightThighAbd : 8;
    const rThighFlex = pose.rightThighFlex !== undefined ? pose.rightThighFlex : 76;

    const lShinAbd = pose.leftShinAbd !== undefined ? pose.leftShinAbd : 0;
    const lShinFlex = pose.leftShinFlex !== undefined ? pose.leftShinFlex : 0;
    const rShinAbd = pose.rightShinAbd !== undefined ? pose.rightShinAbd : 0;
    const rShinFlex = pose.rightShinFlex !== undefined ? pose.rightShinFlex : 0;

    const lKneeProj = projectFrontLimb(leftHip, segments.thigh, -1, lThighAbd, lThighFlex);
    const lAnkProj = projectFrontLimb(lKneeProj.pt, segments.shin, -1, lShinAbd, lShinFlex);
    const rKneeProj = projectFrontLimb(rightHip, segments.thigh, 1, rThighAbd, rThighFlex);
    const rAnkProj = projectFrontLimb(rKneeProj.pt, segments.shin, 1, rShinAbd, rShinFlex);

    const torsoTilt = pose.torsoTilt || 0;
    const shoulderCenter = stepFromDeg(hipCenter, segments.torso, 90 - torsoTilt);
    const neckTop = stepFromDeg(shoulderCenter, segments.neck, 90 - torsoTilt * 0.5);
    const headCenter = { x: neckTop.x, y: neckTop.y - front.headRy * 0.72 };

    const leftShoulder = { x: shoulderCenter.x - front.shoulderHalfW, y: shoulderCenter.y + 4 };
    const rightShoulder = { x: shoulderCenter.x + front.shoulderHalfW, y: shoulderCenter.y + 4 };

    const lUa = pose.leftUpperArmAngle !== undefined ? pose.leftUpperArmAngle : -158;
    const rUa = pose.rightUpperArmAngle !== undefined ? pose.rightUpperArmAngle : -22;
    const lFa = pose.leftForearmAngle !== undefined ? pose.leftForearmAngle : 86;
    const rFa = pose.rightForearmAngle !== undefined ? pose.rightForearmAngle : 94;

    const lArmLenScale = pose.leftArmForeshorten || 1;
    const rArmLenScale = pose.rightArmForeshorten || 1;

    const leftElbow = stepFromDeg(leftShoulder, segments.upperArm * lArmLenScale, lUa);
    const leftWrist = stepFromDeg(leftElbow, segments.forearm * lArmLenScale, lFa);
    const leftHandTip = stepFromDeg(
      leftWrist,
      segments.hand * 0.72,
      pose.leftHandAngle !== undefined ? pose.leftHandAngle : lFa
    );

    const rightElbow = stepFromDeg(rightShoulder, segments.upperArm * rArmLenScale, rUa);
    const rightWrist = stepFromDeg(rightElbow, segments.forearm * rArmLenScale, rFa);
    const rightHandTip = stepFromDeg(
      rightWrist,
      segments.hand * 0.72,
      pose.rightHandAngle !== undefined ? pose.rightHandAngle : rFa
    );

    return {
      view: 'front',
      groundY,
      seated: true,
      seatY,
      hipCenter,
      shoulderCenter,
      neckTop,
      headCenter,
      left: {
        hip: leftHip,
        knee: lKneeProj.pt,
        ankle: lAnkProj.pt,
        footY: lAnkProj.pt.y + segments.ankleHeight,
        footTurnOut: -10,
        kneeDepth: clamp(lKneeProj.depthZ / segments.thigh, 0, 1),
        shoulder: leftShoulder,
        elbow: leftElbow,
        wrist: leftWrist,
        handTip: leftHandTip,
      },
      right: {
        hip: rightHip,
        knee: rKneeProj.pt,
        ankle: rAnkProj.pt,
        footY: rAnkProj.pt.y + segments.ankleHeight,
        footTurnOut: 10,
        kneeDepth: clamp(rKneeProj.depthZ / segments.thigh, 0, 1),
        shoulder: rightShoulder,
        elbow: rightElbow,
        wrist: rightWrist,
        handTip: rightHandTip,
      },
      angles: { ...pose },
    };
  }

  // Bilateral articulated front-view (march, side-leg-raise, jumping-jack, high-knees)
  const bodyLiftY = pose.bodyLiftY || 0;
  const hipShiftX = pose.hipShiftX || 0;
  const torsoTilt = pose.torsoTilt || 0;

  const lThighAbd = pose.leftThighAbd || 0;
  const lThighFlex = pose.leftThighFlex || 0;
  const lShinAbd = pose.leftShinAbd !== undefined ? pose.leftShinAbd : lThighAbd * 0.5;
  const lShinFlex = pose.leftShinFlex || 0;

  const rThighAbd = pose.rightThighAbd || 0;
  const rThighFlex = pose.rightThighFlex || 0;
  const rShinAbd = pose.rightShinAbd !== undefined ? pose.rightShinAbd : rThighAbd * 0.5;
  const rShinFlex = pose.rightShinFlex || 0;

  // Compute stance anchor:
  // - 'left' / 'right': lock specified foot precisely at ankleY
  // - 'lowest': lowest foot rests on ankleY (great for alternating march / jumping-jack / high-knees)
  const baseHipY = standingHipY + bodyLiftY;
  let hipCenter = { x: centerX + hipShiftX, y: baseHipY };

  const anchorSide = exerciseConfig.anchorSide || 'none';
  const tmpLKnee = projectFrontLimb({ x: 0, y: 0 }, segments.thigh, -1, lThighAbd, lThighFlex).pt;
  const tmpLAnk = projectFrontLimb(tmpLKnee, segments.shin, -1, lShinAbd, lShinFlex).pt;
  const tmpRKnee = projectFrontLimb({ x: 0, y: 0 }, segments.thigh, 1, rThighAbd, rThighFlex).pt;
  const tmpRAnk = projectFrontLimb(tmpRKnee, segments.shin, 1, rShinAbd, rShinFlex).pt;

  if (anchorSide === 'left') {
    hipCenter = {
      x: centerX - tmpLAnk.x + hipShiftX,
      y: ankleY - tmpLAnk.y + bodyLiftY,
    };
  } else if (anchorSide === 'right') {
    hipCenter = {
      x: centerX - tmpRAnk.x + hipShiftX,
      y: ankleY - tmpRAnk.y + bodyLiftY,
    };
  } else if (anchorSide === 'lowest') {
    const maxRelY = Math.max(tmpLAnk.y, tmpRAnk.y);
    hipCenter = {
      x: centerX + hipShiftX,
      y: ankleY - maxRelY + bodyLiftY,
    };
  }

  const leftHip = { x: hipCenter.x - front.legSocketX, y: hipCenter.y };
  const rightHip = { x: hipCenter.x + front.legSocketX, y: hipCenter.y };

  const lKneeProj = projectFrontLimb(leftHip, segments.thigh, -1, lThighAbd, lThighFlex);
  const lAnkProj = projectFrontLimb(lKneeProj.pt, segments.shin, -1, lShinAbd, lShinFlex);

  const rKneeProj = projectFrontLimb(rightHip, segments.thigh, 1, rThighAbd, rThighFlex);
  const rAnkProj = projectFrontLimb(rKneeProj.pt, segments.shin, 1, rShinAbd, rShinFlex);

  const shoulderCenter = stepFromDeg(hipCenter, segments.torso, 90 - torsoTilt);
  const neckTop = stepFromDeg(shoulderCenter, segments.neck, 90 - torsoTilt * 0.5);
  const headCenter = { x: neckTop.x, y: neckTop.y - front.headRy * 0.72 };

  const leftShoulder = { x: shoulderCenter.x - front.shoulderHalfW, y: shoulderCenter.y + 4 };
  const rightShoulder = { x: shoulderCenter.x + front.shoulderHalfW, y: shoulderCenter.y + 4 };

  const lUa = pose.leftUpperArmAngle !== undefined ? pose.leftUpperArmAngle : -102;
  const rUa = pose.rightUpperArmAngle !== undefined ? pose.rightUpperArmAngle : -78;
  const lFa = pose.leftForearmAngle !== undefined ? pose.leftForearmAngle : -96;
  const rFa = pose.rightForearmAngle !== undefined ? pose.rightForearmAngle : -84;

  const lArmLenScale = pose.leftArmForeshorten || 1;
  const rArmLenScale = pose.rightArmForeshorten || 1;

  const leftElbow = stepFromDeg(leftShoulder, segments.upperArm * lArmLenScale, lUa);
  const leftWrist = stepFromDeg(leftElbow, segments.forearm * lArmLenScale, lFa);
  const leftHandTip = stepFromDeg(leftWrist, segments.hand, lFa);

  const rightElbow = stepFromDeg(rightShoulder, segments.upperArm * rArmLenScale, rUa);
  const rightWrist = stepFromDeg(rightElbow, segments.forearm * rArmLenScale, rFa);
  const rightHandTip = stepFromDeg(rightWrist, segments.hand, rFa);

  return {
    view: 'front',
    groundY,
    hipCenter,
    shoulderCenter,
    neckTop,
    headCenter,
    left: {
      hip: leftHip,
      knee: lKneeProj.pt,
      ankle: lAnkProj.pt,
      footY: lAnkProj.pt.y + segments.ankleHeight,
      footTurnOut: -6,
      kneeDepth: clamp(lKneeProj.depthZ / segments.thigh, 0, 1),
      shoulder: leftShoulder,
      elbow: leftElbow,
      wrist: leftWrist,
      handTip: leftHandTip,
    },
    right: {
      hip: rightHip,
      knee: rKneeProj.pt,
      ankle: rAnkProj.pt,
      footY: rAnkProj.pt.y + segments.ankleHeight,
      footTurnOut: 6,
      kneeDepth: clamp(rKneeProj.depthZ / segments.thigh, 0, 1),
      shoulder: rightShoulder,
      elbow: rightElbow,
      wrist: rightWrist,
      handTip: rightHandTip,
    },
    angles: { ...pose },
  };
}

function solveSkeleton(exerciseConfig, pose, proportions) {
  if (exerciseConfig.view === 'front') {
    return solveFrontSkeleton(exerciseConfig, pose, proportions);
  }
  return solveSideSkeleton(exerciseConfig, pose, proportions);
}

module.exports = {
  interpolatePose,
  solveSkeleton,
};
