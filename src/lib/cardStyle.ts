export const CARD_COLORS = ['default', 'red', 'yellow', 'blue'] as const
export type CardColor = (typeof CARD_COLORS)[number]

export const CARD_BORDER_STYLES = ['solid', 'dashed', 'none'] as const
export type CardBorderStyle = (typeof CARD_BORDER_STYLES)[number]

export const DEFAULT_CARD_COLOR: CardColor = 'default'
export const DEFAULT_CARD_BORDER: CardBorderStyle = 'solid'

const COLOR_SET = new Set<string>(CARD_COLORS)
const BORDER_SET = new Set<string>(CARD_BORDER_STYLES)

export function isCardColor(value: unknown): value is CardColor {
  return typeof value === 'string' && COLOR_SET.has(value)
}

export function isCardBorderStyle(value: unknown): value is CardBorderStyle {
  return typeof value === 'string' && BORDER_SET.has(value)
}

export function normalizeCardColor(value: unknown): CardColor {
  return isCardColor(value) ? value : DEFAULT_CARD_COLOR
}

export function normalizeCardBorderStyle(value: unknown): CardBorderStyle {
  return isCardBorderStyle(value) ? value : DEFAULT_CARD_BORDER
}

export const CARD_COLOR_LABEL: Record<CardColor, string> = {
  default: 'Default',
  red: 'Red',
  yellow: 'Yellow',
  blue: 'Blue',
}

export const CARD_BORDER_LABEL: Record<CardBorderStyle, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  none: 'None',
}

/** Complete class strings so Tailwind keeps them. */
export const CARD_FILL_CLASS: Record<CardColor, string> = {
  default: 'bg-surface',
  red: 'bg-card-red',
  yellow: 'bg-card-yellow',
  blue: 'bg-card-blue',
}

export const CARD_EDGE_CLASS: Record<CardColor, string> = {
  default: 'border-border',
  red: 'border-card-red-edge',
  yellow: 'border-card-yellow-edge',
  blue: 'border-card-blue-edge',
}
