/**
 * Loop Messenger — African-first color system
 * Warm amber/gold palette with deep warm dark backgrounds.
 * All oklch values from the web app converted to sRGB hex.
 */
export const Colors = {
  // Primary — warm amber/gold  oklch(0.76 0.18 65)
  primary:       '#D4A232',
  primaryLight:  '#E8BB55',
  primaryDim:    'rgba(212,162,50,0.18)',
  primaryBorder: 'rgba(212,162,50,0.32)',

  // Backgrounds
  background:    '#110D07',   // oklch(0.09 0.014 45) — deep warm night
  surface:       '#1B1208',   // cards / panels
  surfaceRaised: '#251A0C',   // elevated inputs, bubbles
  border:        '#3A2810',   // subtle dividers
  borderFocus:   'rgba(212,162,50,0.40)',

  // Text
  text:          '#EDE0CA',   // warm near-white
  textSecondary: '#8B7A62',   // muted warm
  textMuted:     '#5A4A36',   // very muted

  // Semantic
  error:         '#C84030',   // oklch(0.62 0.22 25)
  errorDim:      'rgba(200,64,48,0.18)',
  success:       '#4CAF80',   // oklch(0.72 0.20 145)
  successDim:    'rgba(76,175,128,0.18)',
  warning:       '#E8991A',

  // RALD state corners
  cornerIdle:    'rgba(255,255,255,0.12)',
  cornerTyping:  '#D4A232',   // amber
  cornerError:   '#C84030',   // red
  cornerSuccess: '#4CAF80',   // green

  // Kente strip  (5 African-inspired accent colors)
  kente: ['#D4A232', '#C84030', '#4CAF80', '#30A89A', '#8855CC'] as const,

  // Bottom nav
  tabActive:     '#D4A232',
  tabInactive:   '#5A4A36',

  // Presence
  online:        '#4CAF80',
  away:          '#E8991A',
  offline:       '#5A4A36',

  // Calls
  callGreen:     '#2ECC71',
  callRed:       '#E74C3C',
  callMute:      '#E67E22',
};

export type ColorKey = keyof typeof Colors;
