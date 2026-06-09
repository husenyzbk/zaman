export const BASE_PX_PER_YEAR = 80

export function dateToX(date, zoom) {
  const year = new Date(date).getFullYear()
  const month = new Date(date).getMonth()
  const fractionalYear = year + month / 12
  return fractionalYear * BASE_PX_PER_YEAR * zoom
}

export function yearToX(year, zoom) {
  return year * BASE_PX_PER_YEAR * zoom
}

export function xToYear(x, zoom) {
  return x / (BASE_PX_PER_YEAR * zoom)
}

export function xToDate(x, zoom) {
  const fractionalYear = xToYear(x, zoom)
  const year = Math.floor(fractionalYear)
  const month = Math.round((fractionalYear - year) * 12)
  const d = new Date(year, month, 1)
  return d.toISOString().split('T')[0]
}

export function formatYear(year) {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year}`
}

export function getTickInterval(zoom) {
  const pxPerYear = BASE_PX_PER_YEAR * zoom
  if (pxPerYear >= 200) return { major: 1, minor: null }
  if (pxPerYear >= 80) return { major: 5, minor: 1 }
  if (pxPerYear >= 40) return { major: 10, minor: 5 }
  if (pxPerYear >= 16) return { major: 25, minor: 5 }
  if (pxPerYear >= 8) return { major: 50, minor: 10 }
  return { major: 100, minor: 25 }
}
