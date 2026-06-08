'use client'

import * as React from 'react'
import { IconBug } from '@tabler/icons-react'
import { FeedbackModal } from './feedback-modal'

export function FeedbackButton() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="feedback-modal-exclude fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Feedback geben"
        title="Feedback geben"
      >
        <IconBug className="size-5" />
      </button>
      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  )
}
