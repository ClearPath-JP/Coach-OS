# Pre-launch checklist

## Before your first real coach signs up

### Code

- [ ] `pnpm run build` passes
- [ ] `pnpm run test` passes (46+ tests)
- [ ] No `console.log` in production code
- [ ] No hardcoded secrets in any file
- [ ] `.env.local` is in `.gitignore`

### Database

- [ ] All migrations applied in production
- [ ] RLS enabled on every table
- [ ] Indexes added for performance
- [ ] Daily backups enabled (Supabase Pro)

### Auth

- [ ] Signup flow tested end to end
- [ ] Client invite flow tested
- [ ] Password reset flow tested
- [ ] Session expiry tested (logout works)

### Payments

- [ ] Stripe in LIVE mode (not test)
- [ ] Webhook endpoint receiving events
- [ ] Plan limits enforced correctly
- [ ] Billing page shows correct pricing

### Email

- [ ] Resend API key configured
- [ ] Client invite email sends correctly
- [ ] Password reset email sends correctly
- [ ] Email sender is your domain (not @resend.dev)

### Features

- [ ] Messaging works both directions
- [ ] Calendar booking works
- [ ] Program builder works
- [ ] Video import pipeline tested
- [ ] Analytics shows correct data
- [ ] Dark mode works
- [ ] Color themes save and persist

### Performance

- [ ] Lighthouse score 85+
- [ ] First page load under 3 seconds
- [ ] Images lazy loaded

### Legal

- [ ] Privacy policy page exists (`/privacy`)
- [ ] Terms of service page exists (`/terms`)
- [ ] Cookie notice if needed

### Support

- [ ] You have a support email coaches can contact
- [ ] You know how to access Supabase to help coaches if needed
