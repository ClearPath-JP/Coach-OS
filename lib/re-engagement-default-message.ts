/** Default auto check-in copy when workspace.auto_checkin_message is empty. */
export const DEFAULT_AUTO_CHECKIN_MESSAGE = `Hey {firstName}! Just checking in 👋
How are things going?

I noticed we haven't connected in a few days. Remember, consistency is what creates results.

What's one thing you've been working on this week?`

export function formatAutoCheckinMessage(template: string, firstName: string): string {
  const name = firstName.trim() || 'there'
  const t = template.trim() || DEFAULT_AUTO_CHECKIN_MESSAGE
  return t.replace(/\{firstName\}/gi, name)
}
