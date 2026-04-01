import { z } from 'zod'

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
    password: z.string().min(8, 'Password must be at least 8 characters'),
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

/** Set password (after invite) — min 8 chars */
export const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
export type SetPasswordInput = z.infer<typeof setPasswordSchema>

/** Coach — update video metadata (title / description / category) */
export const patchVideoSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200).optional(),
    description: z.union([z.string().max(2000), z.null()]).optional(),
    category: z.union([z.string().max(80), z.null()]).optional(),
  })
  .refine((d) => d.title !== undefined || d.description !== undefined || d.category !== undefined, {
    message: 'Provide at least one field to update',
  })
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
  messageType: z.enum(['text', 'invoice', 'session', 'session_request']).optional(),
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
}).refine((d) => d.endTime > d.startTime, { message: 'End time must be after start time', path: ['endTime'] })
export type RecurringAvailabilityCreateInput = z.infer<typeof recurringAvailabilityCreateSchema>

/** Recurring availability — patch */
export const recurringAvailabilityPatchSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  label: z.string().max(200).nullable().optional(),
  sessionProductId: z.string().uuid().nullable().optional(),
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
  plan: z.enum(['starter', 'pro', 'scale']),
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
})
export type CreatePackageInput = z.infer<typeof createPackageSchema>

export const updatePackageSchema = createPackageSchema.partial()
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>

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
  amountCents: z.number().int().min(0).optional(),
})
export type MarkInvoicePaidInput = z.infer<typeof markInvoicePaidSchema>

/** Program builder (Session 12) */
export const createProgramSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional().nullable(),
})
export type CreateProgramInput = z.infer<typeof createProgramSchema>

export const updateProgramSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
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

export const createContentSchema = z.object({
  contentType: z.enum(['text', 'url', 'video', 'file']),
  title: z.string().max(500).optional().nullable(),
  body: z.string().max(50000).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  videoId: z.string().uuid().optional().nullable(),
  fileUrl: z.string().max(2000).optional().nullable(),
})
export type CreateContentInput = z.infer<typeof createContentSchema>

export const updateContentSchema = z.object({
  title: z.string().max(500).nullable().optional(),
  body: z.string().max(50000).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  videoId: z.string().uuid().nullable().optional(),
  fileUrl: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
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
})
export type UpdateNotificationsInput = z.infer<typeof updateNotificationsSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),
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
  })
  .refine((d) => (d.date == null) === (d.startTime == null), {
    message: 'Provide both date and start time together',
    path: ['startTime'],
  })
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>

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
