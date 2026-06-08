import { z } from 'zod'

/** Coach/client passwords: min length + uppercase + digit (aligned with signup & password change). */
export const passwordStrengthSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Needs uppercase letter')
  .regex(/[0-9]/, 'Needs a number')

function isValidHttpUrl(url: string): boolean {
  try {
    const p = new URL(url.trim())
    return p.protocol === 'http:' || p.protocol === 'https:'
  } catch {
    return false
  }
}

/** Public image URLs (e.g. Supabase Storage) — tolerant of encodings z.string().url() can reject. */
export const storedImageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (s) => {
      try {
        const u = new URL(s)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'Must be a valid http(s) URL' }
  )

export const optionalStoredImageUrlSchema = z.union([z.null(), storedImageUrlSchema]).optional()

/** Add client form — Phase 2 / Session 5 */
export const addClientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Email must be valid'),
  phone: z.string().optional(),
  goals: z.string().optional(),
})
export type AddClientInput = z.infer<typeof addClientSchema>

/** Update client (patch) — optional fields */
export const updateClientSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  goals: z.string().nullable().optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  notes: z.string().nullable().optional(),
  profile_photo_url: z.union([z.literal(''), z.null(), storedImageUrlSchema]).optional(),
})
export type UpdateClientInput = z.infer<typeof updateClientSchema>

/** Login form */
export const loginSchema = z.object({
  email: z.string().email('Email must be valid'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

/** Signup form */
export const signupSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Email must be valid'),
    password: passwordStrengthSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: 'You must accept the Terms of Service and Privacy Policy',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type SignupInput = z.infer<typeof signupSchema>

/** Invite client — email only (11-auth, 04-client-management) */
export const inviteClientSchema = z.object({
  email: z.string().email('Email must be valid').transform((e) => e.trim().toLowerCase()),
})
export type InviteClientInput = z.infer<typeof inviteClientSchema>

/** Set password (after invite) */
export const setPasswordSchema = z.object({
  password: passwordStrengthSchema,
})
export type SetPasswordInput = z.infer<typeof setPasswordSchema>

/** Coach — update video metadata (title / description / category) */
export const patchVideoSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200).optional(),
    description: z.union([z.string().max(2000), z.null()]).optional(),
    category: z.union([z.string().max(80), z.null()]).optional(),
    // The real, tab-driving link. `category` (text) is legacy/free-form and no
    // longer the source of truth for the library's category tabs.
    category_id: z.union([z.string().uuid('Invalid category'), z.null()]).optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.description !== undefined ||
      d.category !== undefined ||
      d.category_id !== undefined,
    { message: 'Provide at least one field to update' }
  )
export type PatchVideoInput = z.infer<typeof patchVideoSchema>

export const bulkVideoCategorySchema = z.object({
  videoIds: z.array(z.string().uuid()).min(1, 'Select at least one video').max(200),
  category: z.union([z.string().max(80), z.null()]).optional(),
})

export const createVideoAssignmentSchema = z.object({
  videoId: z.string().uuid('Invalid video'),
  clientId: z.string().uuid('Invalid client'),
})

/** Send message form — clientId + content (05-messaging, Session 8) */
export const sendMessageSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be 2000 characters or less'),
  messageType: z
    .enum(['text', 'invoice', 'session', 'session_request', 'testimonial_request'])
    .optional(),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

/** Mark messages read — clientId (thread) */
export const markMessagesReadSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
})
export type MarkMessagesReadInput = z.infer<typeof markMessagesReadSchema>

/** Recurring availability — create (Session 9) */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/
export const recurringAvailabilityCreateSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'Use HH:mm or HH:mm:ss'),
  endTime: z.string().regex(timeRegex, 'Use HH:mm or HH:mm:ss'),
  label: z.string().max(200).optional(),
  sessionProductId: z.string().uuid().optional().nullable(),
  isClientBookable: z.boolean().optional().default(false),
}).refine((d) => d.endTime > d.startTime, { message: 'End time must be after start time', path: ['endTime'] })
export type RecurringAvailabilityCreateInput = z.infer<typeof recurringAvailabilityCreateSchema>

/** Recurring availability — patch */
export const recurringAvailabilityPatchSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  label: z.string().max(200).nullable().optional(),
  sessionProductId: z.string().uuid().nullable().optional(),
  isClientBookable: z.boolean().optional(),
  is_active: z.boolean().optional(),
}).refine(
  (d) => {
    if (d.startTime != null && d.endTime != null) return d.endTime > d.startTime
    return true
  },
  { message: 'End time must be after start time', path: ['endTime'] }
)
export type RecurringAvailabilityPatchInput = z.infer<typeof recurringAvailabilityPatchSchema>

/** Create session (coach) — client, time, optional duration/notes/slot/product */
export const createSessionSchema = z.object({
  client_id: z.string().uuid('Invalid client'),
  scheduled_time: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date-time'),
  duration_minutes: z.number().int().min(15).max(240).optional().default(60),
  notes: z.string().max(2000).optional().nullable(),
  availability_slot_id: z.string().uuid().optional().nullable(),
  session_product_id: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'confirmed']).optional().default('confirmed'),
})
export type CreateSessionInput = z.infer<typeof createSessionSchema>

/** Calendar UI — create session (date + local start time, coach dashboard) */
export const coachCalendarSessionCreateSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD for date'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:mm for start time'),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  type: z.string().max(100).optional(),
  notes: z.string().max(2000).optional().nullable(),
})
export type CoachCalendarSessionCreateInput = z.infer<typeof coachCalendarSessionCreateSchema>

/** Stripe checkout plan */
export const billingCheckoutSchema = z.object({
  plan: z.enum(['founding', 'starter', 'pro', 'scale']),
})
export type BillingCheckoutInput = z.infer<typeof billingCheckoutSchema>

/** Session package — create/update (Session 11) */
export const createPackageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  price_cents: z.number().int().min(0),
  currency: z.string().length(3).optional().default('usd'),
  duration_minutes: z.number().int().min(5).max(480).optional().default(60),
  session_type: z.string().max(100).optional().nullable(),
  is_virtual: z.boolean().optional().default(true),
  is_active: z.boolean().optional().default(true),
  capacity: z.number().int().min(1).max(50).optional().default(1),
})
export type CreatePackageInput = z.infer<typeof createPackageSchema>

export const updatePackageSchema = createPackageSchema.partial()
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>

/** Class pass (credit pack) — create. POST /api/coach/passes */
export const createClassPassSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(2000).optional().nullable(),
    priceCents: z.number().int().min(0, 'Price cannot be negative'),
    currency: z.string().length(3).optional().default('usd'),
    creditCount: z.number().int().min(1, 'A pass must include at least 1 class').max(1000),
    appliesTo: z.enum(['all', 'types']),
    appliesToTypes: z.array(z.string().max(100)).max(50).optional(),
    expiresInDays: z.number().int().min(1).max(3650).optional().nullable(),
    status: z.enum(['active', 'draft']).optional().default('active'),
  })
  .superRefine((d, ctx) => {
    if (d.appliesTo === 'types' && (!d.appliesToTypes || d.appliesToTypes.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'appliesToTypes must have at least one type when appliesTo is "types"',
        path: ['appliesToTypes'],
      })
    }
  })
export type CreateClassPassInput = z.infer<typeof createClassPassSchema>

/** Class pass — edit. PATCH /api/coach/passes/[id] */
export const patchClassPassSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    priceCents: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    creditCount: z.number().int().min(1).max(1000).optional(),
    appliesTo: z.enum(['all', 'types']).optional(),
    appliesToTypes: z.array(z.string().max(100)).max(50).nullable().optional(),
    expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
    status: z.enum(['active', 'draft', 'archived']).optional(),
  })
  .superRefine((d, ctx) => {
    const hasAny =
      d.title !== undefined ||
      d.description !== undefined ||
      d.priceCents !== undefined ||
      d.currency !== undefined ||
      d.creditCount !== undefined ||
      d.appliesTo !== undefined ||
      d.appliesToTypes !== undefined ||
      d.expiresInDays !== undefined ||
      d.status !== undefined
    if (!hasAny) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide at least one field to update' })
    }
    if (d.appliesTo === 'types' && (!d.appliesToTypes || d.appliesToTypes.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'appliesToTypes must have at least one type when appliesTo is "types"',
        path: ['appliesToTypes'],
      })
    }
  })
export type PatchClassPassInput = z.infer<typeof patchClassPassSchema>

/** Client buys a pass. POST /api/client/buy-pass */
export const buyPassSchema = z.object({
  passId: z.string().uuid('Invalid pass'),
})
export type BuyPassInput = z.infer<typeof buyPassSchema>

/** Create invoice — package, client, optional due date */
export const createInvoiceSchema = z.object({
  packageId: z.string().uuid('Invalid package'),
  clientId: z.string().uuid('Invalid client'),
  dueDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date').optional().nullable(),
})
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

/** Mark invoice paid — payment method and optional reference/note */
const paymentMethodEnum = z.enum([
  'cash', 'zelle', 'venmo', 'cashapp', 'paypal', 'bank_transfer', 'stripe', 'other',
])
export const markInvoicePaidSchema = z.object({
  paymentMethod: paymentMethodEnum,
  paymentReference: z.string().max(500).optional().nullable(),
  paymentMethodNote: z.string().max(500).optional().nullable(),
  // amountCents intentionally omitted — always use invoice.amount_cents to prevent client-side override
})
export type MarkInvoicePaidInput = z.infer<typeof markInvoicePaidSchema>

/** Program builder (Session 12) */
export const createProgramSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional().nullable(),
  thumbnail_url: z.string().url().max(2000).optional().nullable(),
})
export type CreateProgramInput = z.infer<typeof createProgramSchema>

export const updateProgramSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  thumbnail_url: z.string().url().max(2000).nullable().optional(),
})
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>

export const createModuleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional().nullable(),
  position: z.number().int().min(0).optional().default(0),
})
export type CreateModuleInput = z.infer<typeof createModuleSchema>

export const updateModuleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
})
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>

export const createContentSchema = z
  .object({
    contentType: z.enum(['text', 'url', 'video', 'file']),
    title: z.string().max(500).optional().nullable(),
    body: z.string().max(50000).optional().nullable(),
    url: z.string().max(2000).optional().nullable(),
    videoId: z.string().uuid().optional().nullable(),
    fileUrl: z.string().max(2000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const u = data.url?.trim()
    if (data.contentType === 'url' && u && !isValidHttpUrl(u)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL must start with http:// or https://',
        path: ['url'],
      })
    }
    const f = data.fileUrl?.trim()
    if (f && !isValidHttpUrl(f)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'File URL must start with http:// or https://',
        path: ['fileUrl'],
      })
    }
  })
export type CreateContentInput = z.infer<typeof createContentSchema>

export const updateContentSchema = z
  .object({
    title: z.string().max(500).nullable().optional(),
    body: z.string().max(50000).nullable().optional(),
    url: z.string().max(2000).nullable().optional(),
    videoId: z.string().uuid().nullable().optional(),
    fileUrl: z.string().max(2000).nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    const u = data.url != null ? String(data.url).trim() : ''
    if (u !== '' && !isValidHttpUrl(u)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL must start with http:// or https://',
        path: ['url'],
      })
    }
    const f = data.fileUrl != null ? String(data.fileUrl).trim() : ''
    if (f !== '' && !isValidHttpUrl(f)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'File URL must start with http:// or https://',
        path: ['fileUrl'],
      })
    }
  })
export type UpdateContentInput = z.infer<typeof updateContentSchema>

export const assignProgramSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
})
export type AssignProgramInput = z.infer<typeof assignProgramSchema>

/** Settings (Session 15) */
const timezoneEnum = z.enum([
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
])

const paymentMethodsEnum = z.enum([
  'cash',
  'venmo',
  'cashapp',
  'zelle',
  'paypal',
  'bank_transfer',
])

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/

export const updateWorkspaceSettingsSchema = z.object({
  displayName: z.string().min(1).max(120).nullable().optional(),
  accentColor: z.string().regex(hexColorRegex, 'Accent color must be a valid hex color').nullable().optional(),
  accentColorLight: z.string().regex(hexColorRegex, 'Accent light color must be a valid hex color').nullable().optional(),
  timezone: timezoneEnum.optional(),
  logoUrl: optionalStoredImageUrlSchema,
  preferredPaymentMethods: z.array(paymentMethodsEnum).max(6).nullable().optional(),
  brandName: z.string().max(120).nullable().optional(),
  brandTagline: z.string().max(100).nullable().optional(),
  clientPortalHeading: z.string().max(200).nullable().optional(),
  clientWelcomeMessage: z.string().max(200).nullable().optional(),
  cashappUsername: z.string().max(120).nullable().optional(),
  venmoUsername: z.string().max(120).nullable().optional(),
  paypalEmail: z.string().max(255).nullable().optional(),
  zelleEmailOrPhone: z.string().max(255).nullable().optional(),
  stripeConnected: z.boolean().optional(),
  paymentInstructions: z.string().max(300).nullable().optional(),
})
export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>

export const updateProfileSettingsSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
  bio: z.string().max(300).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  avatarUrl: optionalStoredImageUrlSchema,
})
export type UpdateProfileSettingsInput = z.infer<typeof updateProfileSettingsSchema>

export const updateNotificationsSchema = z.object({
  newMessage: z.boolean().optional(),
  sessionReminder: z.boolean().optional(),
  clientActivity: z.boolean().optional(),
  paymentReceived: z.boolean().optional(),
  autoCheckinEnabled: z.boolean().optional(),
  autoCheckinMessage: z.string().max(4000).nullable().optional(),
})
export type UpdateNotificationsInput = z.infer<typeof updateNotificationsSchema>

const goalCategorySchema = z.enum([
  'fitness',
  'nutrition',
  'mindset',
  'business',
  'relationship',
  'health',
  'performance',
  'general',
])

export const createClientGoalSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  category: goalCategorySchema.optional(),
  targetValue: z.number().finite().nullable().optional(),
  startValue: z.number().finite().nullable().optional(),
  currentValue: z.number().finite().optional(),
  unit: z.string().max(40).nullable().optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .nullable()
    .optional(),
})
export type CreateClientGoalInput = z.infer<typeof createClientGoalSchema>

export const patchClientGoalSchema = z
  .object({
    currentValue: z.number().finite().optional(),
    status: z.enum(['active', 'achieved', 'paused', 'abandoned']).optional(),
    note: z.string().max(2000).nullable().optional(),
    title: z.string().min(1).max(500).optional(),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .refine(
    (d) =>
      d.currentValue !== undefined ||
      d.status !== undefined ||
      d.note !== undefined ||
      d.title !== undefined ||
      d.targetDate !== undefined,
    { message: 'Provide at least one field to update' }
  )
export type PatchClientGoalInput = z.infer<typeof patchClientGoalSchema>

export const messagesBroadcastSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000),
  clientIds: z.array(z.string().uuid()).max(500).optional(),
})
export type MessagesBroadcastInput = z.infer<typeof messagesBroadcastSchema>

export const clientTestimonialSubmitSchema = z.object({
  content: z.string().max(500).optional().nullable(),
  rating: z.number().int().min(1).max(5),
})
export type ClientTestimonialSubmitInput = z.infer<typeof clientTestimonialSubmitSchema>

export const clientDailyCheckinSchema = z.object({
  moodScore: z.number().int().min(1, 'Mood must be between 1 and 5').max(5, 'Mood must be between 1 and 5'),
  energyScore: z.number().int().min(1).max(5).optional().nullable(),
  note: z.string().max(300, 'Note must be 300 characters or less').optional().nullable(),
})
export type ClientDailyCheckinInput = z.infer<typeof clientDailyCheckinSchema>

export const patchTestimonialSchema = z.object({
  isApproved: z.boolean().optional(),
  isPublic: z.boolean().optional(),
})
export type PatchTestimonialInput = z.infer<typeof patchTestimonialSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordStrengthSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'New password and confirm password must match',
    path: ['confirmPassword'],
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

/** Manual / invoice-linked payments (Session 17) */
export const paymentMethodSchema = z.enum([
  'cash',
  'venmo',
  'cashapp',
  'zelle',
  'paypal',
  'bank_transfer',
  'stripe',
  'other',
])
export const createPaymentSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
  amountCents: z.number().int().min(1, 'Amount must be at least one cent'),
  paymentMethod: paymentMethodSchema,
  paymentReference: z.string().max(500).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').optional(),
  invoiceId: z.string().uuid().optional().nullable(),
  sessionId: z.string().uuid().optional().nullable(),
})
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

export const updatePaymentSchema = z.object({
  clientId: z.string().uuid().optional(),
  amountCents: z.number().int().min(1).optional(),
  paymentMethod: paymentMethodSchema.optional(),
  paymentReference: z.string().max(500).nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
})
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>

/** PATCH /api/sessions/[id] — coach calendar session update */
export const updateSessionSchema = z
  .object({
    notes: z.string().max(2000).nullable().optional(),
    status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
    paid: z.boolean().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    durationMinutes: z.number().int().min(15).max(240).optional(),
    recapVideoId: z.string().uuid().nullable().optional(),
  })
  .refine((d) => (d.date == null) === (d.startTime == null), {
    message: 'Provide both date and start time together',
    path: ['startTime'],
  })
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>

const sessionNotesActionItemInputSchema = z.object({
  id: z.string().min(1, 'Action item id is required').max(80),
  text: z.string().min(1, 'Action item text is required').max(200, 'Each action item must be 200 characters or less'),
  assignedTo: z.enum(['client', 'coach']),
})

/** PATCH /api/sessions/[id]/notes — structured session notes */
export const sessionNotesPatchSchema = z
  .object({
    coachPrivateNotes: z.string().max(8000).nullable().optional(),
    sessionSummary: z.string().max(1000, 'Session summary must be 1000 characters or less').optional(),
    actionItems: z.array(sessionNotesActionItemInputSchema).max(10, 'At most 10 action items').optional(),
    sendToClient: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.coachPrivateNotes !== undefined ||
      d.sessionSummary !== undefined ||
      d.actionItems !== undefined ||
      d.sendToClient === true,
    { message: 'Provide at least one field to update' }
  )
export type SessionNotesPatchInput = z.infer<typeof sessionNotesPatchSchema>

/** POST /api/sessions/[id]/action-items/complete */
export const sessionActionItemCompleteSchema = z.object({
  actionItemId: z.string().min(1, 'actionItemId is required').max(80),
})
export type SessionActionItemCompleteInput = z.infer<typeof sessionActionItemCompleteSchema>

/** Onboarding step 1 */
export const onboardingWorkspaceSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(2, 'Workspace name must be at least 2 characters').max(200)),
  logo_url: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  avatar_url: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
})
export type OnboardingWorkspaceInput = z.infer<typeof onboardingWorkspaceSchema>

const onboardingCoachingTypeSchema = z.enum([
  'Fitness',
  'Life',
  'Business',
  'Nutrition',
  'Mindset',
  'Performance',
  'Career',
  'Relationships',
  'Other',
])

/** Onboarding step 2 */
export const onboardingCoachingSchema = z.object({
  coaching_types: z.array(onboardingCoachingTypeSchema).max(20).optional(),
  current_client_count: z.union([z.number().int().nonnegative(), z.string(), z.null()]).optional(),
})
export type OnboardingCoachingInput = z.infer<typeof onboardingCoachingSchema>

/** PATCH bodies that must be empty JSON objects */
export const emptyStrictBodySchema = z.object({}).strict()

/** Program upload FormData fields (file validated separately) */
export const programUploadFieldsSchema = z.object({
  moduleId: z.string().uuid('Invalid module'),
  workspaceId: z.string().uuid('Invalid workspace'),
})

const assignmentTypeSchema = z.enum(['text', 'video', 'file', 'checklist'])

/** Coach: create assignment template */
export const createAssignmentTemplateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  instructions: z.string().max(8000).optional().nullable(),
  assignmentType: assignmentTypeSchema.optional().default('text'),
  checklistItems: z.array(z.string().min(1).max(500)).max(50).optional().nullable(),
  dueDaysAfterAssign: z.number().int().min(0).max(365).optional().default(7),
  points: z.number().int().min(0).max(1000).optional().default(10),
  programId: z.string().uuid().optional().nullable(),
  moduleId: z.string().uuid().optional().nullable(),
  isRequired: z.boolean().optional().default(true),
  position: z.number().int().min(0).optional().default(0),
})
export type CreateAssignmentTemplateInput = z.infer<typeof createAssignmentTemplateSchema>

export const updateAssignmentTemplateSchema = createAssignmentTemplateSchema.partial()
export type UpdateAssignmentTemplateInput = z.infer<typeof updateAssignmentTemplateSchema>

/** Coach: assign template to client */
export const assignToClientSchema = z.object({
  templateId: z.string().uuid('Invalid template'),
  clientId: z.string().uuid('Invalid client'),
  clientProgramId: z.string().uuid().optional().nullable(),
  dueAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date').optional().nullable(),
})

/** Coach: review submission */
export const assignmentReviewSchema = z.object({
  status: z.enum(['approved', 'returned']),
  coachFeedback: z.string().max(8000).optional().nullable(),
  pointsAwarded: z.number().int().min(0).max(2000).optional().default(0),
})

/** Client: submit assignment */
export const assignmentSubmitSchema = z.object({
  submissionType: assignmentTypeSchema,
  textContent: z.string().max(20000).optional().nullable(),
  videoId: z.string().uuid().optional().nullable(),
  fileUrl: z.string().url().max(2000).optional().nullable(),
  fileSizeBytes: z.number().int().nonnegative().optional().nullable(),
  checklistResponses: z.record(z.string(), z.boolean()).optional().nullable(),
})

// ---------------------------------------------------------------------------
// Coach class CRUD (Classes overhaul, 2026-06-01)
// ---------------------------------------------------------------------------

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

/** POST /api/coach/classes — create a class */
export const createClassSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    type: z.string().min(1, 'Type is required').max(100),
    description: z.string().max(2000).optional().nullable(),
    location: z.string().max(300).optional().nullable(),
    capacity: z.number().int().min(1, 'Capacity must be at least 1'),
    priceCents: z.number().int().min(0, 'Price cannot be negative'),
    currency: z.string().length(3).optional().default('usd'),
    durationMinutes: z.number().int().min(5).max(480),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:MM'),
    color: z.string().max(50).optional().nullable(),
    status: z.enum(['active', 'draft']),
    memberAccess: z.enum(['included', 'members_only', 'drop_in_only']),
    isVirtual: z.boolean().optional().default(false),
    recurring: z.boolean(),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    oneTimeDate: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),
  })
  .superRefine((d, ctx) => {
    if (d.recurring) {
      if (!d.days || d.days.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide at least one day for recurring classes',
          path: ['days'],
        })
      }
    } else {
      if (!d.oneTimeDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide oneTimeDate for a one-time class',
          path: ['oneTimeDate'],
        })
      }
    }
  })
export type CreateClassInput = z.infer<typeof createClassSchema>

// ---------------------------------------------------------------------------
// Membership plans CRUD (Dojo Memberships, Task 2 — 2026-06-01)
// ---------------------------------------------------------------------------

/** POST /api/coach/memberships — create a membership plan */
export const createMembershipPlanSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    priceCents: z.number().int().min(0, 'Price cannot be negative'),
    currency: z.string().length(3).optional().default('usd'),
    accessType: z.enum(['unlimited', 'limited', 'specific']),
    classesPerPeriod: z.number().int().min(1).optional(),
    appliesTo: z.enum(['all', 'types']),
    appliesToTypes: z.array(z.string().max(100)).max(50).optional(),
    status: z.enum(['active', 'draft']).optional().default('active'),
  })
  .superRefine((d, ctx) => {
    if (d.accessType === 'limited' && d.classesPerPeriod == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'classesPerPeriod is required when accessType is "limited"',
        path: ['classesPerPeriod'],
      })
    }
    if (d.appliesTo === 'types' && (!d.appliesToTypes || d.appliesToTypes.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'appliesToTypes must have at least one type when appliesTo is "types"',
        path: ['appliesToTypes'],
      })
    }
  })
export type CreateMembershipPlanInput = z.infer<typeof createMembershipPlanSchema>

/** PATCH /api/coach/memberships/[id] — edit a membership plan */
export const patchMembershipPlanSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    priceCents: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    accessType: z.enum(['unlimited', 'limited', 'specific']).optional(),
    classesPerPeriod: z.number().int().min(1).nullable().optional(),
    appliesTo: z.enum(['all', 'types']).optional(),
    appliesToTypes: z.array(z.string().max(100)).max(50).nullable().optional(),
    status: z.enum(['active', 'draft', 'archived']).optional(),
  })
  .superRefine((d, ctx) => {
    // At least one field must be present
    const hasAny =
      d.name !== undefined ||
      d.priceCents !== undefined ||
      d.currency !== undefined ||
      d.accessType !== undefined ||
      d.classesPerPeriod !== undefined ||
      d.appliesTo !== undefined ||
      d.appliesToTypes !== undefined ||
      d.status !== undefined
    if (!hasAny) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update',
      })
    }
    // If switching accessType to 'limited', classesPerPeriod must be supplied in
    // the same request (we cannot infer the existing DB value at parse time).
    if (d.accessType === 'limited' && d.classesPerPeriod == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'classesPerPeriod is required when setting accessType to "limited"',
        path: ['classesPerPeriod'],
      })
    }
    // If switching appliesTo to 'types', at least one type must be supplied.
    if (d.appliesTo === 'types' && (!d.appliesToTypes || d.appliesToTypes.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'appliesToTypes must have at least one entry when setting appliesTo to "types"',
        path: ['appliesToTypes'],
      })
    }
  })
export type PatchMembershipPlanInput = z.infer<typeof patchMembershipPlanSchema>

/** PATCH /api/coach/classes/[id] — update a class group or occurrence */
export const patchClassSchema = z
  .object({
    scope: z.enum(['all', 'occurrence']),
    occurrenceDate: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),
    // Shared editable fields
    name: z.string().min(1).max(200).optional(),
    type: z.string().max(100).optional(),
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(300).nullable().optional(),
    capacity: z.number().int().min(1).optional(),
    priceCents: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    color: z.string().max(50).nullable().optional(),
    status: z.enum(['active', 'draft']).optional(),
    memberAccess: z.enum(['included', 'members_only', 'drop_in_only']).optional(),
    isVirtual: z.boolean().optional(),
    // 'all' scope only: reconcile days
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.scope === 'occurrence' && !d.occurrenceDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'occurrenceDate is required for scope=occurrence',
        path: ['occurrenceDate'],
      })
    }
  })
export type PatchClassInput = z.infer<typeof patchClassSchema>

// ---------------------------------------------------------------------------
// Promote content workspace — Saved Posts + Brand Voice (2026-06-05)
// ---------------------------------------------------------------------------

/** A finished post (Idea/Chat paths) — mirrors PromotePost in lib/promote-content. */
const promotePostContentSchema = z.object({
  hook: z.string().max(2000),
  caption: z.string().max(8000),
  hashtags: z.array(z.string().max(80)).max(30),
  cta: z.string().max(2000),
  videoScript: z.union([z.array(z.string().max(2000)).max(20), z.null()]),
})

/** A Reel plan (Video path) — mirrors VideoPlan in lib/promote-content. */
const promoteVideoPlanContentSchema = z.object({
  hookIdea: z.string().max(2000),
  structure: z.array(z.string().max(2000)).max(20),
  onScreenText: z.array(z.string().max(2000)).max(20),
  caption: z.string().max(8000),
  hashtags: z.array(z.string().max(80)).max(30),
})

/** Either content shape — used where the post type isn't statically known (PATCH). */
export const promotePostContentUnionSchema = z.union([
  promotePostContentSchema,
  promoteVideoPlanContentSchema,
])

const promotePostBaseSchema = z.object({
  path: z.enum(['idea', 'chat', 'video']),
  kind: z.enum(['class', 'workout', 'book1on1', 'bts']).nullable().optional(),
  platform: z.enum(['instagram', 'facebook']).nullable().optional(),
  tone: z.enum(['hype', 'calm', 'friendly']).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  sourceVideoId: z.string().uuid('Invalid video').nullable().optional(),
})

/** POST /api/coach/promote/posts — save a generated post or video plan.
 *  Discriminated on `type` so `content` is guaranteed to match the post type. */
export const savePromotePostSchema = z.discriminatedUnion('type', [
  promotePostBaseSchema.extend({ type: z.literal('post'), content: promotePostContentSchema }),
  promotePostBaseSchema.extend({ type: z.literal('video'), content: promoteVideoPlanContentSchema }),
])
export type SavePromotePostInput = z.infer<typeof savePromotePostSchema>

/** PATCH /api/coach/promote/posts/[id] — edit content and/or status.
 *  The route re-validates `content` against the stored post's `type`. */
export const patchPromotePostSchema = z
  .object({
    content: promotePostContentUnionSchema.optional(),
    status: z.enum(['draft', 'posted']).optional(),
    title: z.string().max(200).nullable().optional(),
  })
  .refine((d) => d.content !== undefined || d.status !== undefined || d.title !== undefined, {
    message: 'Provide at least one field to update',
  })
export type PatchPromotePostInput = z.infer<typeof patchPromotePostSchema>

/** PATCH /api/coach/promote/profile — brand voice (upsert, one row per workspace). */
export const promoteProfileSchema = z
  .object({
    discipline: z.string().max(80).nullable().optional(),
    tone: z.enum(['hype', 'calm', 'friendly']).nullable().optional(),
    platform: z.enum(['instagram', 'facebook']).nullable().optional(),
    bookingUrl: z.string().max(300).nullable().optional(),
    signature: z.string().max(200).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    const u = d.bookingUrl != null ? String(d.bookingUrl).trim() : ''
    if (u !== '' && !isValidHttpUrl(u)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Booking link must start with http:// or https://',
        path: ['bookingUrl'],
      })
    }
  })
export type PromoteProfileInput = z.infer<typeof promoteProfileSchema>
