export const RELATIONSHIPS = [
  { id: 'caused',       label: 'Caused',       color: '#ef4444', dash: null },
  { id: 'influenced',   label: 'Influenced',   color: '#f97316', dash: '6 3' },
  { id: 'responded_to', label: 'Responded To', color: '#eab308', dash: '2 3' },
  { id: 'opposed',      label: 'Opposed',      color: '#ec4899', dash: '8 3 2 3' },
  { id: 'supported',    label: 'Supported',    color: '#22c55e', dash: null },
  { id: 'preceded',     label: 'Preceded',     color: '#3b82f6', dash: '5 2' },
  { id: 'led_to',       label: 'Led To',       color: '#8b5cf6', dash: null },
]
export const RELATIONSHIP_MAP = Object.fromEntries(RELATIONSHIPS.map(r => [r.id, r]))
