import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { assignmentReviewSchema } from '@/lib/validations'
import { normalizeEmail } from '@/lib/utils'
import { computeStreakUpdate, getLevelFromXp, levelNumberFromXp, XP_ACTIONS } from '@/lib/xp-system'

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/assignments/[id]/review — coach approves or returns (client_assignment id).
 */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { id: clientAssignmentId } = await context.params

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-review:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = assignmentReviewSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { status, coachFeedback, pointsAwarded } = parsed.data

    const { data: row, error: fetchErr } = await supabase
      .from('client_assignments')
      .select(
        `
        id,
        client_id,
        status,
        workspace_id,
        assignment_template_id,
        assignment_templates ( id, title, points, assignment_type )
      `
      )
      .eq('id', clientAssignmentId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    if (row.status !== 'submitted') {
      return NextResponse.json({ error: 'Only submitted assignments can be reviewed' }, { status: 400 })
    }

    const rawTpl = row.assignment_templates as unknown
    const tplRow = Array.isArray(rawTpl) ? rawTpl[0] : rawTpl
    const tpl =
      tplRow && typeof tplRow === 'object' && tplRow !== null && 'points' in tplRow
        ? (tplRow as { id: string; title: string; points: number; assignment_type: string })
        : null
    const maxPoints = (tpl?.points ?? 10) * 2
    const award = status === 'approved' ? Math.min(pointsAwarded, maxPoints) : 0

    const nowIso = new Date().toISOString()

    const { data: client } = await supabase
      .from('clients')
      .select('id, email')
      .eq('id', row.client_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!client?.email) {
      return NextResponse.json({ error: 'Client record missing email' }, { status: 400 })
    }

    const emailNorm = normalizeEmail(client.email)
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailNorm)
      .maybeSingle()

    if (!clientProfile?.id) {
      return NextResponse.json({ error: 'Client has no login profile' }, { status: 400 })
    }

    let previousLevel = 1
    let newTotalXp = 0
    let streakBonus = 0

    if (status === 'approved') {
      const { data: rewards } = await supabase
        .from('client_rewards')
        .select(
          'id, total_xp, current_streak_days, longest_streak_days, last_activity_at, assignments_completed'
        )
        .eq('client_id', row.client_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      const baseXp = rewards?.total_xp ?? 0
      previousLevel = levelNumberFromXp(baseXp)

      const streak = computeStreakUpdate(
        rewards?.current_streak_days ?? 0,
        rewards?.longest_streak_days ?? 0,
        rewards?.last_activity_at ?? null
      )
      streakBonus = streak.streakBonus ? XP_ACTIONS.STREAK_BONUS : 0
      newTotalXp = baseXp + award + streakBonus

      const newLevel = levelNumberFromXp(newTotalXp)

      if (rewards) {
        await supabase
          .from('client_rewards')
          .update({
            total_xp: newTotalXp,
            level: newLevel,
            current_streak_days: streak.currentStreakDays,
            longest_streak_days: streak.longestStreakDays,
            last_activity_at: nowIso,
            assignments_completed: (rewards.assignments_completed ?? 0) + 1,
            updated_at: nowIso,
          })
          .eq('id', rewards.id)
      } else {
        await supabase.from('client_rewards').insert({
          workspace_id: workspaceId,
          client_id: row.client_id,
          total_xp: newTotalXp,
          level: newLevel,
          current_streak_days: streak.currentStreakDays,
          longest_streak_days: streak.longestStreakDays,
          last_activity_at: nowIso,
          assignments_completed: 1,
          assignments_total: 1,
          updated_at: nowIso,
        })
      }
    }

    const { data: updated, error: upErr } = await supabase
      .from('client_assignments')
      .update({
        status,
        coach_feedback: coachFeedback ?? null,
        points_awarded: award,
        reviewed_at: nowIso,
        reviewed_by: user.id,
        updated_at: nowIso,
      })
      .eq('id', clientAssignmentId)
      .select('id, status, coach_feedback, points_awarded, reviewed_at')
      .single()

    if (upErr) {
      return NextResponse.json({ error: 'Could not save review' }, { status: 500 })
    }

    const newLevelNum = status === 'approved' ? levelNumberFromXp(newTotalXp) : previousLevel
    const levelDef = status === 'approved' ? getLevelFromXp(newTotalXp) : getLevelFromXp(0)
    const leveledUp = status === 'approved' && newLevelNum > previousLevel

    const feedbackCard =
      status === 'approved'
        ? {
            type: 'assignment_feedback',
            clientAssignmentId,
            templateTitle: tpl?.title ?? 'Assignment',
            status,
            pointsAwarded: award,
            streakBonus,
            coachFeedback: coachFeedback ?? null,
            newLevel: newLevelNum,
            levelName: levelDef.name,
            leveledUp,
            totalXp: newTotalXp,
          }
        : {
            type: 'assignment_feedback',
            clientAssignmentId,
            templateTitle: tpl?.title ?? 'Assignment',
            status,
            pointsAwarded: 0,
            streakBonus: 0,
            coachFeedback: coachFeedback ?? null,
            leveledUp: false,
          }

    const { error: msgErr } = await supabase.from('messages').insert({
      workspace_id: workspaceId,
      sender_id: user.id,
      recipient_id: clientProfile.id,
      client_id: row.client_id,
      content: JSON.stringify(feedbackCard),
      message_type: 'assignment_feedback',
    })

    if (msgErr) {
      return NextResponse.json(
        { error: 'Review saved, but feedback message failed to send', data: updated },
        { status: 207 }
      )
    }

    return NextResponse.json({
      data: {
        assignment: updated,
        totalXp: status === 'approved' ? newTotalXp : undefined,
        leveledUp,
        newLevel: status === 'approved' ? newLevelNum : undefined,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
