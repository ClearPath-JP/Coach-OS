import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { postClientInvoiceCheckoutSession } from '@/lib/client-invoice-checkout-post'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/client/invoices/[id]/checkout — Stripe Checkout for one invoice (card).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, clientId, workspaceId, supabase } = auth
    const { id: invoiceId } = await context.params
    return postClientInvoiceCheckoutSession(request, invoiceId, user, clientId, workspaceId, supabase)
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
