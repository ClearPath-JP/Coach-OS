import { NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit-log'
import { applyAuthNoStoreHeaders } from '@/lib/auth-response'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { changePasswordSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success: ipOk, retryAfter: ipRetry } = await checkRateLimitAsync(`settings-change-password-ip:${ip}`, {
      windowMs: 15 * 60 * 1000,
      max: 30,
    })
    if (!ipOk) {
      const res = applyAuthNoStoreHeaders(
        NextResponse.json(
          { error: 'Too many attempts — please wait and try again' },
          { status: 429 }
        )
      )
      if (ipRetry) res.headers.set('Retry-After', String(ipRetry))
      return res
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return applyAuthNoStoreHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return applyAuthNoStoreHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }

    const { success, retryAfter } = await checkRateLimitAsync(`settings-change-password:${user.id}`, {
      windowMs: 60 * 60 * 1000,
      max: 5,
    })
    if (!success) {
      const res = applyAuthNoStoreHeaders(
        NextResponse.json(
          { error: 'Too many attempts — please wait an hour and try again' },
          { status: 429 }
        )
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return applyAuthNoStoreHeaders(
        NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
      )
    }

    if (!user.email) {
      return applyAuthNoStoreHeaders(
        NextResponse.json({ error: 'Your account is missing an email address' }, { status: 400 })
      )
    }

    const signInCheck = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    })
    if (signInCheck.error) {
      return applyAuthNoStoreHeaders(
        NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      )
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    })
    if (error) {
      return applyAuthNoStoreHeaders(
        NextResponse.json({ error: 'Could not update password' }, { status: 400 })
      )
    }

    void logAuditEvent('password_changed', user.id, workspaceId, {}, request)

    return applyAuthNoStoreHeaders(NextResponse.json({ data: 'Password updated' }))
  } catch {
    return applyAuthNoStoreHeaders(
      NextResponse.json(
        { error: 'Something went wrong — check your connection and try again' },
        { status: 500 }
      )
    )
  }
}
