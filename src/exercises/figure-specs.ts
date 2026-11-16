// 18 個動作的骨架示範圖規格（供 figure-rig 產生 CSS keyframes SVG）

import type { FigureSpec } from './figure-rig'

export const SQUAT_FIGURE_SPEC: FigureSpec = {
  id: 'squat',
  view: 'side',
  durationMs: 1800,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 6,
    upperArmR: 6,
    forearmL: -10,
    forearmR: -10,
    heelRaise: 0
  },
  action: {
    torsoTilt: 28,
    hipY: 26,
    thighL: -80,
    thighR: -80,
    shinL: 76,
    shinR: 76,
    upperArmL: -95,
    upperArmR: -95,
    forearmL: -10,
    forearmR: -10,
    heelRaise: 0
  }
}

export const SIT_TO_STAND_FIGURE_SPEC: FigureSpec = {
  id: 'sit-to-stand',
  view: 'side',
  prop: 'chair',
  // 錨定左腳踝後，坐姿髖部落在 rootX-38 處；rootX 70 讓坐姿對上椅面、
  // 站姿離開椅子（椅子畫在左側，見 figure-rig renderProp 的 chair 座標）
  rootX: 70,
  durationMs: 2200,
  start: {
    torsoTilt: 8,
    hipY: 30,
    thighL: -95,
    thighR: -95,
    shinL: 87,
    shinR: 87,
    upperArmL: -35,
    upperArmR: -35,
    forearmL: -25,
    forearmR: -25,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 6,
    upperArmR: 6,
    forearmL: -8,
    forearmR: -8,
    heelRaise: 0
  }
}

export const CALF_RAISE_FIGURE_SPEC: FigureSpec = {
  id: 'calf-raise',
  view: 'side',
  durationMs: 1400,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 6,
    upperArmR: 6,
    forearmL: -10,
    forearmR: -10,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 10,
    upperArmR: 10,
    forearmL: -14,
    forearmR: -14,
    heelRaise: 14
  }
}

export const MARCH_FIGURE_SPEC: FigureSpec = {
  id: 'march',
  view: 'front',
  durationMs: 1200,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 8,
    upperArmR: -8,
    forearmL: -6,
    forearmR: 6,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: -78,
    shinL: 0,
    shinR: 78,
    upperArmL: 24,
    upperArmR: -18,
    forearmL: -35,
    forearmR: 25,
    heelRaise: 0
  }
}

export const WALL_PUSHUP_FIGURE_SPEC: FigureSpec = {
  id: 'wall-pushup',
  view: 'side',
  prop: 'wall',
  durationMs: 1800,
  start: {
    torsoTilt: 12,
    hipY: 2,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: -102,
    upperArmR: -102,
    forearmL: 0,
    forearmR: 0,
    heelRaise: 0
  },
  action: {
    torsoTilt: 26,
    hipY: 7,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: -64,
    upperArmR: -64,
    forearmL: -94,
    forearmR: -94,
    heelRaise: 0
  }
}

export const SIDE_LEG_RAISE_FIGURE_SPEC: FigureSpec = {
  id: 'side-leg-raise',
  view: 'front',
  durationMs: 1500,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 3,
    thighR: -3,
    shinL: 0,
    shinR: 0,
    upperArmL: 12,
    upperArmR: -12,
    forearmL: -12,
    forearmR: 12,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 4,
    thighR: -44,
    shinL: 0,
    shinR: 0,
    upperArmL: 32,
    upperArmR: -32,
    forearmL: -42,
    forearmR: 42,
    heelRaise: 0
  }
}

export const LUNGE_FIGURE_SPEC: FigureSpec = {
  id: 'lunge',
  view: 'side',
  durationMs: 1800,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: -10,
    thighR: 12,
    shinL: 10,
    shinR: 6,
    upperArmL: 8,
    upperArmR: 8,
    forearmL: -14,
    forearmR: -14,
    heelRaise: 0
  },
  action: {
    torsoTilt: 6,
    hipY: 22,
    thighL: -88,
    thighR: 12,
    shinL: 88,
    shinR: 88,
    upperArmL: 12,
    upperArmR: 12,
    forearmL: -55,
    forearmR: -55,
    heelRaise: 0
  }
}

export const KNEE_PUSHUP_FIGURE_SPEC: FigureSpec = {
  id: 'knee-pushup',
  anchor: 'none',
  view: 'side',
  rootX: 64,
  bodyScale: 0.85,
  durationMs: 1600,
  start: {
    torsoTilt: 68,
    hipY: 48,
    thighL: 0,
    thighR: 0,
    shinL: -78,
    shinR: -78,
    upperArmL: -68,
    upperArmR: -68,
    forearmL: 0,
    forearmR: 0,
    heelRaise: 0
  },
  action: {
    torsoTilt: 78,
    hipY: 58,
    thighL: 0,
    thighR: 0,
    shinL: -84,
    shinR: -84,
    upperArmL: -120,
    upperArmR: -120,
    forearmL: 78,
    forearmR: 78,
    heelRaise: 0
  }
}

export const SUMO_SQUAT_FIGURE_SPEC: FigureSpec = {
  id: 'sumo-squat',
  view: 'front',
  durationMs: 1800,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 24,
    thighR: -24,
    shinL: -14,
    shinR: 14,
    upperArmL: 10,
    upperArmR: -10,
    forearmL: -12,
    forearmR: 12,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: 22,
    thighL: 58,
    thighR: -58,
    shinL: -52,
    shinR: 52,
    upperArmL: 18,
    upperArmR: -18,
    forearmL: -48,
    forearmR: 48,
    heelRaise: 0
  }
}

export const GLUTE_BRIDGE_FIGURE_SPEC: FigureSpec = {
  id: 'glute-bridge',
  anchor: 'none',
  view: 'side',
  rootX: 68,
  durationMs: 1800,
  start: {
    torsoTilt: -90,
    hipY: 56,
    thighL: -50,
    thighR: -50,
    shinL: 115,
    shinR: 115,
    upperArmL: 0,
    upperArmR: 0,
    forearmL: 0,
    forearmR: 0,
    heelRaise: 0
  },
  action: {
    torsoTilt: -112,
    hipY: 40,
    thighL: -10,
    thighR: -10,
    shinL: 105,
    shinR: 105,
    upperArmL: 22,
    upperArmR: 22,
    forearmL: 0,
    forearmR: 0,
    heelRaise: 0
  }
}

export const JUMPING_JACK_FIGURE_SPEC: FigureSpec = {
  id: 'jumping-jack',
  anchor: 'none',
  view: 'front',
  durationMs: 900,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 2,
    thighR: -2,
    shinL: 0,
    shinR: 0,
    upperArmL: 6,
    upperArmR: -6,
    forearmL: -4,
    forearmR: 4,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: -5,
    thighL: 26,
    thighR: -26,
    shinL: 0,
    shinR: 0,
    upperArmL: 150,
    upperArmR: -150,
    forearmL: 18,
    forearmR: -18,
    heelRaise: 0
  }
}

export const HIGH_KNEES_FIGURE_SPEC: FigureSpec = {
  id: 'high-knees',
  view: 'front',
  durationMs: 750,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 2,
    thighR: -2,
    shinL: 0,
    shinR: 0,
    upperArmL: 14,
    upperArmR: -14,
    forearmL: -48,
    forearmR: 48,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: -5,
    thighL: 2,
    thighR: -92,
    shinL: 0,
    shinR: 92,
    upperArmL: 34,
    upperArmR: -22,
    forearmL: -58,
    forearmR: 42,
    heelRaise: 0
  }
}

export const PUSHUP_FIGURE_SPEC: FigureSpec = {
  id: 'pushup',
  anchor: 'none',
  view: 'side',
  rootX: 64,
  bodyScale: 0.85,
  durationMs: 1400,
  start: {
    torsoTilt: 74,
    hipY: 48,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: -74,
    upperArmR: -74,
    forearmL: 0,
    forearmR: 0,
    heelRaise: 0
  },
  action: {
    torsoTilt: 82,
    hipY: 58,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: -125,
    upperArmR: -125,
    forearmL: 75,
    forearmR: 75,
    heelRaise: 0
  }
}

export const JUMP_SQUAT_FIGURE_SPEC: FigureSpec = {
  id: 'jump-squat',
  view: 'side',
  durationMs: 1100,
  start: {
    torsoTilt: 28,
    hipY: 26,
    thighL: -100,
    thighR: -100,
    shinL: 84,
    shinR: 84,
    upperArmL: -85,
    upperArmR: -85,
    forearmL: -12,
    forearmR: -12,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: -18,
    thighL: 6,
    thighR: 6,
    shinL: 8,
    shinR: 8,
    upperArmL: 22,
    upperArmR: 22,
    forearmL: -12,
    forearmR: -12,
    heelRaise: 0
  }
}

export const JUMP_LUNGE_FIGURE_SPEC: FigureSpec = {
  id: 'jump-lunge',
  view: 'side',
  durationMs: 1000,
  start: {
    torsoTilt: 6,
    hipY: 22,
    thighL: -86,
    thighR: 12,
    shinL: 86,
    shinR: 84,
    upperArmL: -45,
    upperArmR: -45,
    forearmL: -40,
    forearmR: -40,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: -14,
    thighL: 24,
    thighR: -32,
    shinL: 16,
    shinR: 28,
    upperArmL: -120,
    upperArmR: -120,
    forearmL: -20,
    forearmR: -20,
    heelRaise: 0
  }
}

export const BULGARIAN_SPLIT_SQUAT_FIGURE_SPEC: FigureSpec = {
  id: 'bulgarian-split-squat',
  view: 'side',
  prop: 'bench',
  durationMs: 1800,
  start: {
    torsoTilt: 6,
    hipY: 2,
    thighL: -16,
    thighR: 38,
    shinL: 16,
    shinR: 52,
    upperArmL: 8,
    upperArmR: 8,
    forearmL: -20,
    forearmR: -20,
    heelRaise: 0
  },
  action: {
    torsoTilt: 14,
    hipY: 22,
    thighL: -94,
    thighR: 26,
    shinL: 86,
    shinR: 64,
    upperArmL: -20,
    upperArmR: -20,
    forearmL: -45,
    forearmR: -45,
    heelRaise: 0
  }
}

export const SINGLE_LEG_RDL_FIGURE_SPEC: FigureSpec = {
  id: 'single-leg-rdl',
  view: 'side',
  durationMs: 2000,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 6,
    shinL: 0,
    shinR: 12,
    upperArmL: 6,
    upperArmR: 6,
    forearmL: -6,
    forearmR: -6,
    heelRaise: 0
  },
  action: {
    torsoTilt: 68,
    hipY: 2,
    thighL: -68,
    thighR: 22,
    shinL: 0,
    shinR: 0,
    upperArmL: -68,
    upperArmR: -68,
    forearmL: 0,
    forearmR: 0,
    heelRaise: 0
  }
}

export const PISTOL_SQUAT_FIGURE_SPEC: FigureSpec = {
  id: 'pistol-squat',
  view: 'side',
  durationMs: 2000,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: -18,
    shinL: 0,
    shinR: 0,
    upperArmL: -40,
    upperArmR: -40,
    forearmL: -10,
    forearmR: -10,
    heelRaise: 0
  },
  action: {
    torsoTilt: 24,
    hipY: 32,
    thighL: -115,
    thighR: -108,
    shinL: 105,
    shinR: 0,
    upperArmL: -105,
    upperArmR: -105,
    forearmL: -5,
    forearmR: -5,
    heelRaise: 0
  }
}
