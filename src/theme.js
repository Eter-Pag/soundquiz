export const colors = {
  // Base
  background: '#F8F9FA',
  surface:    '#FFFFFF',

  // Cream palette (alias blanco/gris claro para Home, Game, Admin)
  cream:     '#F8F9FA',
  creamDeep: '#E5E7EB',
  creamDark: '#D1D5DB',
  white:     '#FFFFFF',

  // Brand purple
  purple:      '#6366F1',
  purpleLight: '#818CF8',
  purplePale:  '#EEF2FF',

  // Brand (alias para ResultsScreen)
  primary:      '#6366F1',
  primaryDark:  '#4F46E5',
  primaryLight: '#EEF2FF',

  // Feedback
  correct:   '#10B981',
  correctBg: '#ECFDF5',
  wrong:     '#EF4444',
  wrongBg:   '#FEF2F2',
  success:   '#10B981',
  successBg: '#ECFDF5',
  error:     '#EF4444',
  errorBg:   '#FEF2F2',

  // Text
  textDark:      '#111827',
  textMid:       '#374151',
  textSoft:      '#9CA3AF',
  textPrimary:   '#111827',
  textSecondary: '#4B5563',
  textTertiary:  '#9CA3AF',

  // UI Elements
  border:  '#E5E7EB',
  shadow:  '#000000',
};

/**
 * Paletas de color por fandom.
 * Se asigna buscando si el nombre del fandom (lowercase) contiene alguna keyword.
 *
 * Cada tema expone:
 *   accent      → color principal (botón, borde tarjeta seleccionada, logo, barra progreso)
 *   accentLight → versión pálida (fondo tarjeta seleccionada, fondo badge)
 *   accentText  → color de texto sobre accentLight
 *   bg          → tono muy suave para el fondo de la pantalla completa
 *   cardBg      → fondo sutil de la audioCard en GameScreen
 */
const FANDOM_PALETTE = [
  // ── K-POP ──────────────────────────────────────────────────────────────────
  {
    keywords: ['bts', 'bangtan', 'army'],
    accent:      '#6A3DE8', // morado BTS
    accentLight: '#EDE9FB',
    accentText:  '#4C2DBF',
    bg:          '#F5F3FF',
    cardBg:      '#6A3DE8',
  },
  {
    keywords: ['blackpink', 'black pink', 'blink'],
    accent:      '#D6226A', // rosa BLACKPINK
    accentLight: '#FCE8F3',
    accentText:  '#A01554',
    bg:          '#FFF5F9',
    cardBg:      '#D6226A',
  },
  {
    keywords: ['twice', 'once'],
    accent:      '#FF6FA8', // rosa pastel TWICE
    accentLight: '#FFF0F6',
    accentText:  '#CC3370',
    bg:          '#FFF8FB',
    cardBg:      '#FF6FA8',
  },
  {
    keywords: ['exo', 'exo-l'],
    accent:      '#1C1C2E', // negro/azul marino EXO
    accentLight: '#EAEAF5',
    accentText:  '#1C1C2E',
    bg:          '#F2F2F8',
    cardBg:      '#1C1C2E',
  },
  {
    keywords: ['stray kids', 'straykids', 'stay'],
    accent:      '#FF5A1F', // naranja SKZ
    accentLight: '#FFF0EA',
    accentText:  '#C03A00',
    bg:          '#FFF8F5',
    cardBg:      '#FF5A1F',
  },
  {
    keywords: ['nct', 'nctzen'],
    accent:      '#00BFA5', // verde/teal NCT
    accentLight: '#E0F7F4',
    accentText:  '#007A6B',
    bg:          '#F0FDFB',
    cardBg:      '#00BFA5',
  },
  {
    keywords: ['seventeen', 'carat'],
    accent:      '#3DD5F3', // celeste SVT
    accentLight: '#E8FAFF',
    accentText:  '#0099BB',
    bg:          '#F0FDFF',
    cardBg:      '#0099BB',
  },
  {
    keywords: ['aespa'],
    accent:      '#7B68EE', // morado/neón aespa
    accentLight: '#F0EEFF',
    accentText:  '#5045CC',
    bg:          '#F5F4FF',
    cardBg:      '#7B68EE',
  },
  {
    keywords: ['ive'],
    accent:      '#D4AF37', // dorado IVE
    accentLight: '#FDF8E4',
    accentText:  '#9A7B00',
    bg:          '#FEFCF0',
    cardBg:      '#B8950A',
  },
  {
    keywords: ['newjeans', 'new jeans'],
    accent:      '#5B8DEF', // azul denim NewJeans
    accentLight: '#EAF1FD',
    accentText:  '#2A5CC7',
    bg:          '#F4F8FF',
    cardBg:      '#5B8DEF',
  },
  {
    keywords: ['red velvet', 'redvelvet', 'reveluv'],
    accent:      '#C0392B', // rojo Red Velvet
    accentLight: '#FDECEA',
    accentText:  '#8E1A10',
    bg:          '#FFF5F4',
    cardBg:      '#C0392B',
  },
  {
    keywords: ['got7', 'igot7', 'ahgase'],
    accent:      '#2ECC71', // verde GOT7
    accentLight: '#E8FAF0',
    accentText:  '#1A7A44',
    bg:          '#F2FDF7',
    cardBg:      '#2ECC71',
  },
  {
    keywords: ['monsta x', 'monsta', 'monbebe'],
    accent:      '#E74C3C', // rojo Monsta X
    accentLight: '#FDEDEB',
    accentText:  '#A93226',
    bg:          '#FFF5F4',
    cardBg:      '#E74C3C',
  },
  // ── REGIONAL / BELICO BEATS ────────────────────────────────────────────────
  {
    keywords: ['corridos', 'belico', 'norteño', 'norteno', 'regional'],
    accent:      '#8B4513', // café/tierra corridos
    accentLight: '#F5EBDF',
    accentText:  '#5C2D0A',
    bg:          '#FBF5EF',
    cardBg:      '#8B4513',
  },
  {
    keywords: ['banda'],
    accent:      '#B8860B', // dorado banda
    accentLight: '#FDF5D4',
    accentText:  '#7A5700',
    bg:          '#FEFBE8',
    cardBg:      '#B8860B',
  },
  {
    keywords: ['trap', 'rap', 'urban', 'urbano'],
    accent:      '#212121', // negro urbano
    accentLight: '#F0F0F0',
    accentText:  '#212121',
    bg:          '#F5F5F5',
    cardBg:      '#212121',
  },
  {
    keywords: ['pop', 'latin'],
    accent:      '#E91E8C', // rosa pop latino
    accentLight: '#FCE8F4',
    accentText:  '#A80E65',
    bg:          '#FFF5FA',
    cardBg:      '#E91E8C',
  },
];

/** Tema por defecto (purple de la app) */
const DEFAULT_THEME = {
  accent:      '#6366F1',
  accentLight: '#EEF2FF',
  accentText:  '#4F46E5',
  bg:          '#F8F9FA',
  cardBg:      '#6366F1',
};

/** Tema Infinity All — fondo rojo */
export const INFINITY_ALL_THEME = {
  accent:      '#EF4444',
  accentLight: '#FEF2F2',
  accentText:  '#B91C1C',
  bg:          '#FFF5F5',
  cardBg:      '#DC2626',
};

/** Tema Epic — fondo negro */
export const EPIC_THEME = {
  accent:      '#F59E0B',
  accentLight: '#1a1a14',
  accentText:  '#F59E0B',
  bg:          '#0D0D0D',
  cardBg:      '#1a1a14',
};

/**
 * Devuelve la paleta de un fandom buscando keywords en su nombre.
 * @returns {object} tema con { accent, accentLight, accentText, bg, cardBg }
 */
export function getFandomTheme(fandomName = '') {
  const lower = fandomName.toLowerCase();
  const match = FANDOM_PALETTE.find(p => p.keywords.some(k => lower.includes(k)));
  return match
    ? { accent: match.accent, accentLight: match.accentLight, accentText: match.accentText, bg: match.bg, cardBg: match.cardBg }
    : DEFAULT_THEME;
}
