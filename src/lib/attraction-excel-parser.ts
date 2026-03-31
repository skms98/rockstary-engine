// Attraction-specific Excel parser
// Each sheet in the Excel = one attraction entry

export interface AttractionParsedRow {
  sheetName: string
  title: string
  url: string
  country: string
  city: string
  rawText: string
  keywords: string
  sections: Record<string, string>
}

export async function parseAttractionExcel(buffer: ArrayBuffer): Promise<AttractionParsedRow[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const rows: AttractionParsedRow[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    // Convert sheet to array of arrays
    const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    })

    if (data.length === 0) continue

    // Try to extract structured data from the sheet
    // Look for key-value pairs in columns A and B
    const sections: Record<string, string> = {}
    let title = ''
    let url = ''
    let country = ''
    let city = ''
    let rawText = ''
    let keywords = ''

    for (const row of data) {
      const key = String(row[0] || '').trim().toLowerCase()
      const val = String(row[1] || '').trim()

      if (!key && !val) continue

      // Try to detect known fields
      if (key.includes('title') || key.includes('name')) {
        title = title || val
      } else if (key.includes('url') || key.includes('link')) {
        url = url || val
      } else if (key.includes('country')) {
        country = country || val
      } else if (key.includes('city')) {
        city = city || val
      } else if (key.includes('keyword')) {
        keywords = keywords || val
      } else if (key.includes('description') || key.includes('content') || key.includes('text')) {
        rawText = rawText || val
      }

      // Store everything as sections
      if (key && val) {
        sections[key] = val
      }
    }

    // If no title found from key-value, use sheet name
    if (!title) title = sheetName

    // If no structured data, concatenate all cell text as rawText
    if (!rawText) {
      const allText = data
        .flat()
        .map((c) => String(c || '').trim())
        .filter(Boolean)
        .join('\n')
      rawText = allText
    }

    rows.push({
      sheetName,
      title,
      url,
      country,
      city,
      rawText,
      keywords,
      sections,
    })
  }

  return rows
}
