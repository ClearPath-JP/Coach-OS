import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`session-reminder:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .select('id, scheduled_time, clients(first_name, last_name, email)')
      .eq('id', id)
      .eq('coach_id', user.id)
      .single()

    if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const webhookUrl = process.env.N8N_SESSION_REMINDER_ON_DEMAND_URL
    if (!webhookUrl) return NextResponse.json({ data: { queued: false } })

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        scheduled_time: session.scheduled_time,
        client: session.clients ?? null,
        type: 'reminder',
      }),
    })

    if (!response.ok) return NextResponse.json({ error: 'Could not send reminder' }, { status: 500 })

    return NextResponse.json({ data: { queued: true } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — check your connection and try again' }, { status: 500 })
  }
}

