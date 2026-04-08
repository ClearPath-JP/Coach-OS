import type { LucideProps } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  Sparkles,
  Users,
  Video,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const sz = 'size-4 shrink-0'

export function DashboardIcon({ className, ...props }: LucideProps) {
  return <LayoutDashboard className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function ClientsIcon({ className, ...props }: LucideProps) {
  return <Users className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function MessagesIcon({ className, ...props }: LucideProps) {
  return <MessageSquare className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function ScheduleIcon({ className, ...props }: LucideProps) {
  return <Calendar className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function ProgramsIcon({ className, ...props }: LucideProps) {
  return <BookOpen className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function VideosIcon({ className, ...props }: LucideProps) {
  return <Video className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function PackagesIcon({ className, ...props }: LucideProps) {
  return <Package className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function InvoicesIcon({ className, ...props }: LucideProps) {
  return <FileText className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function PaymentsIcon({ className, ...props }: LucideProps) {
  return <CreditCard className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function AnalyticsIcon({ className, ...props }: LucideProps) {
  return <BarChart3 className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

/** Subscription / plan billing — distinct from client Payments. */
export function BillingNavIcon({ className, ...props }: LucideProps) {
  return <Wallet className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function AssignmentsIcon({ className, ...props }: LucideProps) {
  return <ClipboardList className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function SubscriptionIcon({ className, ...props }: LucideProps) {
  return <Sparkles className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}

export function SettingsNavIcon({ className, ...props }: LucideProps) {
  return <Settings className={cn(sz, className)} strokeWidth={2} aria-hidden {...props} />
}
