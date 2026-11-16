// R14 各動作簡筆示意圖（inline SVG，viewBox 120x180，實線到位姿勢 + 虛線起始疊影）
// 沿用 guide-silhouette 風格：var(--accent, #0ea5e9)、線寬 4-6、圓頭，禁外部圖檔與 base64

const SVG_OPEN =
  '<svg class="guide-silhouette" viewBox="0 0 120 180" width="96" height="144" aria-hidden="true">'
const STROKE_ATTR =
  'fill="none" stroke="var(--accent, #0ea5e9)" stroke-linecap="round" stroke-linejoin="round"'

export const SQUAT_FIGURE_SVG = [
  SVG_OPEN,
  // 起始站姿虛線疊影
  `<circle cx="62" cy="24" r="10" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  `<path d="M62 34 L62 84 L62 126 L62 164" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  // 實線深蹲到位姿勢
  `<circle cx="54" cy="54" r="11" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<path d="M52 65 L38 106 L74 116 L58 164" ${STROKE_ATTR} stroke-width="5" />`,
  `<path d="M48 76 L78 86" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<line x1="22" y1="166" x2="98" y2="166" ${STROKE_ATTR} stroke-width="4" opacity="0.5" />`,
  '</svg>'
].join('')

export const SIT_TO_STAND_FIGURE_SVG = [
  SVG_OPEN,
  // 椅子輪廓（椅背與椅面）
  `<path d="M22 68 L22 122 L54 122 M26 122 L26 164 M50 122 L50 164" ${STROKE_ATTR} stroke-width="4" opacity="0.65" />`,
  // 起始坐姿虛線疊影
  `<circle cx="38" cy="56" r="10" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  `<path d="M38 66 L36 114 L68 118 L70 164" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  // 實線站起到位姿勢
  `<circle cx="68" cy="28" r="11" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<path d="M68 39 L66 94 L68 130 L68 164" ${STROKE_ATTR} stroke-width="5" />`,
  `<path d="M67 52 L82 86" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<line x1="16" y1="166" x2="104" y2="166" ${STROKE_ATTR} stroke-width="4" opacity="0.5" />`,
  '</svg>'
].join('')

export const CALF_RAISE_FIGURE_SVG = [
  SVG_OPEN,
  // 起始平踩地面虛線疊影
  `<circle cx="56" cy="36" r="10" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  `<path d="M56 46 L56 102 L56 164 L74 164" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  // 實線墊腳尖到位姿勢（腳跟離地）
  `<circle cx="56" cy="22" r="11" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<path d="M56 33 L56 90 L58 150 L74 164" ${STROKE_ATTR} stroke-width="5" />`,
  `<path d="M56 48 L44 82" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<line x1="22" y1="166" x2="98" y2="166" ${STROKE_ATTR} stroke-width="4" opacity="0.5" />`,
  '</svg>'
].join('')

export const MARCH_FIGURE_SVG = [
  SVG_OPEN,
  // 正面支撐腳虛線疊影（未抬腿前位置）
  `<path d="M72 96 L74 164" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  // 正面實線單膝高抬姿勢
  `<circle cx="60" cy="26" r="11" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<path d="M60 37 L60 94" ${STROKE_ATTR} stroke-width="5" />`,
  `<path d="M40 54 L80 54" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<path d="M40 54 L34 86 M80 54 L88 76" ${STROKE_ATTR} stroke-width="4.5" />`,
  // 站立左腿與高抬右膝
  `<path d="M52 94 L50 164" ${STROKE_ATTR} stroke-width="5" />`,
  `<path d="M68 94 L88 90 L86 132" ${STROKE_ATTR} stroke-width="5" />`,
  `<line x1="22" y1="166" x2="98" y2="166" ${STROKE_ATTR} stroke-width="4" opacity="0.5" />`,
  '</svg>'
].join('')

export const WALL_PUSHUP_FIGURE_SVG = [
  SVG_OPEN,
  // 右側牆面實線
  `<line x1="96" y1="16" x2="96" y2="168" ${STROKE_ATTR} stroke-width="6" opacity="0.65" />`,
  // 起始直臂撐牆虛線疊影
  `<circle cx="48" cy="34" r="10" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  `<path d="M48 44 L36 104 L26 164" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  `<path d="M46 56 L92 56" ${STROKE_ATTR} stroke-width="4" stroke-dasharray="4 4" opacity="0.35" />`,
  // 實線屈肘靠牆到位姿勢
  `<circle cx="68" cy="40" r="11" ${STROKE_ATTR} stroke-width="4.5" />`,
  `<path d="M64 50 L44 106 L26 164" ${STROKE_ATTR} stroke-width="5" />`,
  `<path d="M60 62 L74 82 L92 64" ${STROKE_ATTR} stroke-width="5" />`,
  `<line x1="16" y1="166" x2="104" y2="166" ${STROKE_ATTR} stroke-width="4" opacity="0.5" />`,
  '</svg>'
].join('')

export const EXERCISE_FIGURES = {
  squat: SQUAT_FIGURE_SVG,
  'sit-to-stand': SIT_TO_STAND_FIGURE_SVG,
  'calf-raise': CALF_RAISE_FIGURE_SVG,
  march: MARCH_FIGURE_SVG,
  'wall-pushup': WALL_PUSHUP_FIGURE_SVG
} as const
