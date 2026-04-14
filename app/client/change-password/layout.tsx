export const dynamic = 'force-dynamic'

export default function ClientChangePasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <div className="flex flex-1 flex-col items-center justify-center p-4">{children}</div>
    </div>
  )
}
