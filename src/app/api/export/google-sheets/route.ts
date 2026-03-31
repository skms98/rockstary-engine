import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

/**
 * POST /api/export/google-sheets
 * Creates a new Google Sheet populated with the event pipeline data,
 * shared with anyone at @platinumlist.net, and returns the sheet URL.
 */
export async function POST(request: NextRequest) {
  try {
    const { entryId, authToken } = await request.json()

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    // Verify auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${authToken}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the entry
    const { data: entry, error: fetchError } = await supabase
      .from('content_entries')
      .select('*')
      .eq('id', entryId)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Set up Google API auth
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}')
    if (!credentials.client_email) {
      return NextResponse.json({ error: 'Google service account not configured' }, { status: 500 })
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const drive = google.drive({ version: 'v3', auth })

    // Build the data — mirrors the XLSX export exactly (33 columns A-AG)
    const headers = [
      'Event ID', 'Event Title', 'Event URL', 'Page QA (Step A)',
      'Categories (Step B)', 'Tags', '', '',
      'Original Description (S1)', '', 'Recommended Versions (S2)', '', '',
      'Fact Check Scores (S3)', '', 'Duplicate Analysis (S4)', '',
      'A/B Tests (S5)', '', 'Organiser Trigger Risk (S6)', '',
      'TOV Score (S7)', '', 'Grammar & Style (S8)', '',
      'Reviewer (S9)', '', 'Resolver (S10)', '',
      'Prev Original Description', 'SEO Analysis (S11)',
      'Fact Check Final (S12)', 'Ranked Top Versions (S13)',
    ]

    const row = [
      entry.event_id || '', entry.event_title || '', entry.event_url || '',
      entry.page_qa_comments || '', entry.categories || '', entry.tags || '', '', '',
      entry.original_description || '', '', entry.recommended_versions || '', '', '',
      entry.fact_check_scores || '', '', entry.duplicate_analysis || '', '',
      entry.ab_tests || '', '', entry.organiser_trigger_risk || '', '',
      entry.tov_score || '', '', entry.grammar_style || '', '',
      entry.reviewer_output || '', '', entry.resolver_output || '', '',
      entry.prev_original_description || '', entry.seo_analysis || '',
      entry.fact_check_final || '', entry.ranked_versions || '',
    ]

    // Create the spreadsheet
    const title = `Rockstary — ${entry.event_title || entry.event_id} — Pipeline Export`
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [{
          properties: {
            title: 'Event Pipeline',
            gridProperties: { frozenRowCount: 1 },
          },
        }],
      },
    })

    const spreadsheetId = spreadsheet.data.spreadsheetId!
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl!

    // Populate the data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Event Pipeline!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers, row],
      },
    })

    // Format: bold header row, auto-resize columns
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Bold header row
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.1, green: 0.1, blue: 0.15 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // Set column widths
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 33 },
              properties: { pixelSize: 200 },
              fields: 'pixelSize',
            },
          },
        ],
      },
    })

    // Share with anyone at platinumlist.net domain
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'writer',
        type: 'domain',
        domain: 'platinumlist.net',
      },
    })

    return NextResponse.json({ url: spreadsheetUrl })
  } catch (err: any) {
    console.error('Google Sheets export error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create Google Sheet' },
      { status: 500 }
    )
  }
}
