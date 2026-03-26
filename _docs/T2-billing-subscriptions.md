# T2 — Billing & subscriptions (pricing reference)

This document tracks **in-app pricing and plan limits** for ClearPath V2 (Session 18 update). Stripe products and webhook handling remain as implemented in the codebase.

## Plan limits (`lib/plan-limits.ts`)

| Plan    | Max clients | Video storage |
|---------|-------------|---------------|
| **free**   | 3  | 1 GB  |
| **starter**| 10 | 10 GB |
| **pro**    | 30 | 50 GB |
| **scale**  | Unlimited* | 200 GB |

\* “Unlimited” clients: enforced as `null` max in code; marketing may show “Unlimited” with a practical safety cap in the future.

## Public pricing (coach billing UI)

Prices are shown on `/billing` (`BillingPageContent`).

### Starter — **$79/month**

- Up to 10 clients  
- 10GB video storage  
- All core features  
- Email support  

### Pro — **$149/month** (most popular)

- Up to 30 clients  
- 50GB video storage  
- Analytics dashboard  
- White label branding  
- Priority support  

### Scale — **$299/month**

- Unlimited clients  
- 200GB video storage  
- All features  
- Dedicated support  
- API access (coming soon)  

## Notes

- Trial copy and signup flows may reference “14 days free” for new coaches; subscription rows use `subscriptions.plan` with values `free` | `starter` | `pro` | `scale`.  
- Stripe price IDs remain environment-driven; update Stripe Dashboard when marketing prices change.
