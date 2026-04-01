import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { getAdminEmail } from '@/lib/admin-email'

export async function POST(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY is missing' }, { status: 500 })
    }

    const to = getAdminEmail()
    if (!to) {
      return NextResponse.json({ error: 'ADMIN_EMAIL is not configured' }, { status: 500 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ClearPath <noreply@clearpath.com>',
        to: [to],
        subject: 'ClearPath admin test email',
        html: '<p>Admin test email sent successfully.</p>',
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Email send failed: ${text}` }, { status: 500 })
    }

    await logAdminAudit({
      action: 'admin.test_email.post',
      userId: auth.id,
      request,
    })

    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json({ error: 'Could not send test email' }, { status: 500 })
  }
}
