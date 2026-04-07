// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createPLClient } from '@/lib/pl-supabase'

export async function POST(request: NextRequest) {
  try {
    const { attractionId, type, note, authorName, attractionTitle, fieldKey } = await request.json()

    if (!attractionId || !type || !note) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!['seo', 'attraction', 'field_note'].includes(type)) {
      return NextResponse.json({ error: 'type must be "seo", "attraction", or "field_note"' }, { status: 400 })
    }
    if (type === 'field_note' && !fieldKey) {
      return NextResponse.json({ error: 'fieldKey is required for field_note type' }, { status: 400 })
    }

    const plClient = createPLClient()

    if (type === 'field_note') {
      // Merge into field_notes JSONB
      const { data: current } = await plClient
        .from('attractions')
        .select('field_notes')
        .eq('id', attractionId)
        .single()

      const existing = (current?.field_notes as Record<string, string>) || {}
      existing[fieldKey] = note

      const { error: updateError } = await plClient
        .from('attractions')
        .update({ field_notes: existing, updated_at: new Date().toISOString() })
        .eq('id', attractionId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      // Save to seo_notes or attraction_notes
      const field = type === 'seo' ? 'seo_notes' : 'attraction_notes'
      const { error: updateError } = await plClient
        .from('attractions')
        .update({ [field]: note, updated_at: new Date().toISOString() })
        .eq('id', attractionId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Fetch assigned_writer for Slack notification
    const { data: entryData } = await plClient
      .from('attractions')
      .select('assigned_writer')
      .eq('id', attractionId)
      .single()
    const assignedWriter = entryData?.assigned_writer

    // Send Slack notification if webhook URL is configured
    const slackWebhookUrl = process.env.SLACK_ROCKSTARY_WEBHOOK_URL
    if (slackWebhookUrl) {
      const label =
        type === 'field_note'
          ? `📝 Field Note — ${fieldKey?.replace(/_/g, ' ')}`
          : type === 'seo'
          ? '✍️ SEO Note'
          : '📋 Attraction Note'
      const author = authorName || 'Marketing'
      const attractionUrl = `https://rockstary-engine.vercel.app/dashboard/attractions/${attractionId}`

      const contextText = [
        `Posted by *${author}*`,
        assignedWriter ? `Writer: *${assignedWriter}*` : null,
        `<${attractionUrl}|View attraction>`,
      ]
        .filter(Boolean)
        .join(' · ')

      const slackPayload = {
        text: `${label} added by *${author}*`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${label} — ${attractionTitle || attractionId}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Note:*\n${note}` },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: contextText }],
          },
        ],
      }

      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
      }).catch(() => {
        // Slack failure is non-fatal — note was already saved
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
