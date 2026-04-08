import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json()
    const correctPin = process.env.SETTINGS_PIN || '4545'
    if (pin === correctPin) {
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, error: 'Incorrect PIN' }, { status: 401 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
}
