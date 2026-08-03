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
  // Date-only values (YYYY-MM-DD) must render as their calendar day in LOCAL
  // time. `new Date('2026-07-01')` parses as UTC midnight, which then displays
  // as Jun 30 in US timezones — the classic off-by-one. Build a local date from
  // the parts instead. Full timestamps (with a time/zone) parse normally.
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(iso)
  return d.toLocaleDateString('en-US', {
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
