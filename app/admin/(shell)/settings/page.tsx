export default function AdminSettingsPage() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Admin settings</h1>
      <p className="text-sm text-slate-600">
        Super-admin access is controlled only by the server environment variable{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_EMAIL</code>. There is no UI to grant or revoke
        admin roles.
      </p>
      <p className="text-sm text-slate-600">
        Use <code className="rounded bg-slate-100 px-1 text-xs">pnpm run setup:admin</code> to align your Supabase
        profile flag after signup, and run billing or cache actions from the System page.
      </p>
    </div>
  )
}
