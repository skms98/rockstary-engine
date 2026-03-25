import { EXCEL_COLUMN_MAP } from '@/types'

export interface ParsedRow {
  event_id: string
  event_title: string
  event_url: string
  page_qa_comments: string
  categories: string
  tags: string
  original_description: string
  recommended_versions: string
  fact_check_scores: string
  duplicate_analysis: string
  ab_tests: string
  organiser_trigger_risk: string
  tov_score: string
  grammar_style: string
  reviewer_output: string
  resolver_output: string
  prev_original_description: string
  seo_analysis: string
  fact_check_final: string
  ranked_versions: string
}

function cellValue(row: any[], colIndex: number): string {
  const val = row[colIndex]
  if (val === undefined || val === null) return ''
  return String(val).trim()
}

export async function parseExcelFile(buffer: ArrayBuffer): Promise<ParsedRow[]> {
  // Dynamic import to avoid SSR/build issues with xlsx's Node.js dependencies
  const XLSX = await import('xlsx')

  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Convert to array of arrays (raw data)
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (rawData.length < 2) return [] // Need at least header + 1 data row

  // Skip header row (row 0), process from row 1 onwards
  const rows: ParsedRow[] = []

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i]

    // Skip completely empty rows
    const hasAnyData = row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined)
    if (!hasAnyData) continue

    const eventId = cellValue(row, EXCEL_COLUMN_MAP.event_id)
    const eventTitle = cellValue(row, EXCEL_COLUMN_MAP.event_title)

    // Need at least an event ID or title to create an entry
    if (!eventId && !eventTitle) continue

    rows.push({
      event_id: eventId || `row-${i}`,
      event_title: eventTitle || `Untitled (Row ${i + 1})`,
      event_url: cellValue(row, EXCEL_COLUMN_MAP.event_url),
      page_qa_comments: cellValue(row, EXCEL_COLUMN_MAP.page_qa_comments),
      categories: cellValue(row, EXCEL_COLUMN_MAP.categories),
      tags: cellValue(row, EXCEL_COLUMN_MAP.tags),
      original_description: cellValue(row, EXCEL_COLUMN_MAP.original_description),
      recommended_versions: cellValue(row, EXCEL_COLUMN_MAP.recommended_versions),
      fact_check_scores: cellValue(row, EXCEL_COLUMN_MAP.fact_check_scores),
      duplicate_analysis: cellValue(row, EXCEL_COLUMN_MAP.duplicate_analysis),
      ab_tests: cellValue(row, EXCEL_COLUMN_MAP.ab_tests),
      organiser_trigger_risk: cellValue(row, EXCEL_COLUMN_MAP.organiser_trigger_risk),
      tov_score: cellValue(row, EXCEL_COLUMN_MAP.tov_score),
      grammar_style: cellValue(row, EXCEL_COLUMN_MAP.grammar_style),
      reviewer_output: cellValue(row, EXCEL_COLUMN_MAP.reviewer_output),
      resolver_output: cellValue(row, EXCEL_COLUMN_MAP.resolver_output),
      prev_original_description: cellValue(row, EXCEL_COLUMN_MAP.prev_original_description),
      seo_analysis: cellValue(row, EXCEL_COLUMN_MAP.seo_analysis),
      fact_check_final: cellValue(row, EXCEL_COLUMN_MAP.fact_check_final),
      ranked_versions: cellValue(row, EXCEL_COLUMN_MAP.ranked_versions),
    })
  }

  return rows
}
