export const CATEGORIES = [
  { id: 'military',   label: 'Military',   short: 'MIL', color: '#ef4444' },
  { id: 'political',  label: 'Political',  short: 'POL', color: '#3b82f6' },
  { id: 'economic',   label: 'Economic',   short: 'ECO', color: '#f59e0b' },
  { id: 'social',     label: 'Social',     short: 'SOC', color: '#22c55e' },
  { id: 'diplomatic', label: 'Diplomatic', short: 'DIP', color: '#8b5cf6' },
  { id: 'cultural',   label: 'Cultural',   short: 'CUL', color: '#06b6d4' },
  { id: 'scientific', label: 'Scientific', short: 'SCI', color: '#ec4899' },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))
