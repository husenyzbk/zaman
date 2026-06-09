export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-').map(Number)
  const monthName = new Date(year, (month || 1) - 1, 1)
    .toLocaleString('en-US', { month: 'short' })
  return month ? `${monthName} ${year}` : `${year}`
}

export function formatDateRange(startStr, endStr) {
  return `${formatDate(startStr)} → ${formatDate(endStr)}`
}
