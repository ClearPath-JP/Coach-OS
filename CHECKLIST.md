# Pre-launch checklist

## Before your first real coach signs up

### Code

- [ ] `pnpm run build` passes
- [ ] `pnpm run test` passes (59 tests, 8 suites)
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
- [ ] Daily check-in works for clients
- [ ] Session notes / summary send to client when intended
- [ ] Action items can be checked off by the client
- [ ] Goal tracking saves correctly (coach + client views)
- [ ] Testimonial request / submit on program completion (or manual flow) works
- [ ] Re-engagement / auto check-in behaves as configured
- [ ] Broadcast message reaches intended clients
- [ ] Google Drive streaming plays without full-file download
- [ ] Coach iCal feed works (session or secret token URL)
- [ ] Admin panel accessible only to super admin (`ADMIN_EMAIL` / `is_super_admin`)

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
