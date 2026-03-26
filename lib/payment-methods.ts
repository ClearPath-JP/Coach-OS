/** Payment method values stored in DB and used by APIs (Session 17). */
export const PAYMENT_METHOD_VALUES = [
  'cash',
  'venmo',
  'cashapp',
  'zelle',
  'paypal',
  'bank_transfer',
  'stripe',
  'other',
] as const

export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  cash: 'Cash',
  venmo: 'Venmo',
  cashapp: 'CashApp',
  zelle: 'Zelle',
  paypal: 'PayPal',
  bank_transfer: 'Bank transfer',
  stripe: 'Stripe',
  other: 'Other',
}

/** Tailwind background + text for method pills/badges (readable on white). */
export const PAYMENT_METHOD_STYLES: Record<PaymentMethodValue, string> = {
  cash: 'bg-emerald-100 text-emerald-900',
  venmo: 'bg-sky-100 text-sky-900',
  cashapp: 'bg-green-100 text-green-900',
  zelle: 'bg-violet-100 text-violet-900',
  paypal: 'bg-blue-100 text-blue-900',
  bank_transfer: 'bg-amber-100 text-amber-900',
  stripe: 'bg-indigo-100 text-indigo-900',
  other: 'bg-neutral-200 text-neutral-800',
}

/** Methods shown in Record payment modal (manual entry; Stripe usually via invoice/mark-paid). */
export const RECORD_PAYMENT_METHOD_OPTIONS: { value: PaymentMethodValue; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'CashApp' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]
