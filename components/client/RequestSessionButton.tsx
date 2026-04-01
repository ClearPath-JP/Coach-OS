'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { RequestSessionModal } from '@/components/client/RequestSessionModal'

export function RequestSessionButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Request a session
      </Button>
      <RequestSessionModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
