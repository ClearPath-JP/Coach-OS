export type CsvLeadRow = {
  name: string
  handle: string | null
  leadType: string
  platform: string
  email: string | null
  status: string
  reason: string | null
  url: string
}

/** RFC-4180 CSV quote a field if it contains comma, double-quote, or newline. */
function quoteCsvField(value: string | null): string {
  if (value === null) return ''
  // Formula-injection guard: neutralise values that Excel/Sheets would execute.
  // Lead data is untrusted (third-party scraper) — prefix a lone apostrophe so
  // the cell is treated as plain text, not a formula.
  const firstChar = value[0]
  const guarded =
    firstChar === '=' ||
    firstChar === '+' ||
    firstChar === '-' ||
    firstChar === '@' ||
    firstChar === '\t' ||
    firstChar === '\r'
      ? `'${value}`
      : value
  // Escape internal double-quotes by doubling them
  const escaped = guarded.replace(/"/g, '""')
  // Wrap in quotes if the value contains comma, double-quote, or newline
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    return `"${escaped}"`
  }
  return escaped
}

export function leadsToCsv(rows: CsvLeadRow[]): string {
  const header = ['Name', 'Handle', 'Type', 'Platform', 'Email', 'Status', 'Why', 'URL']
  const headerLine = header.join(',')

  const dataLines = rows.map((row) =>
    [
      quoteCsvField(row.name),
      quoteCsvField(row.handle),
      quoteCsvField(row.leadType),
      quoteCsvField(row.platform),
      quoteCsvField(row.email),
      quoteCsvField(row.status),
      quoteCsvField(row.reason),
      quoteCsvField(row.url),
    ].join(',')
  )

  return [headerLine, ...dataLines].join('\r\n')
}

