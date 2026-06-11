/** Format integer cents as USD, e.g. 145000 -> "$1,450". */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** Format an ISO date string as "Jun 10, 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Human label for a property type. */
export function propertyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    apartment: 'Apartment community',
    senior: 'Senior living',
    townhome: 'Townhomes',
    house: 'Single-family',
  }
  return map[type] ?? type
}

/** Title-case a status enum like "in_progress" -> "In progress". */
export function humanize(value: string): string {
  const s = value.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
