'use client'

// Paddle card-payment enrollment (sandbox-testable).
//
// 1. Student picks an open cohort → POST /api/v1/student/checkout/paddle
//    creates a server-side Paddle transaction (price locked from the
//    PaymentPlan, custom_data = student/cohort/plan ids).
// 2. Paddle.js overlay opens for that transactionId.
// 3. On checkout.completed we show "activating…" and poll the dashboard —
//    the enrollment itself is created by the Paddle webhook
//    (transaction.completed), never from this client event.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckoutEventNames } from '@paddle/paddle-js'
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react'
import { checkoutApi, studentApi, type StorefrontCohort } from '@/lib/api-client'
import { getPaddle, isPaddleEnabled, onPaddleEvent, PADDLE_ENV } from '@/lib/paddle'
import { Button } from '@/components/ui/button'
import { PromoTicker } from '@/components/checkout/promo-ticker'
import { useFlashPromo } from '@/hooks/use-flash-promo'
import { cn } from '@/lib/utils'

interface PaddleEnrollCardProps {
  cohorts: StorefrontCohort[]
  className?: string
}

type Phase = 'idle' | 'creating' | 'checkout' | 'activating' | 'done'

function PaddleEnrollCard({ cohorts, className }: PaddleEnrollCardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedCohortId, setSelectedCohortId] = useState(cohorts[0]?.id ?? '')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const activeTxn = useRef<string | null>(null)
  const promo = useFlashPromo()

  useEffect(() => {
    if (!selectedCohortId && cohorts[0]) setSelectedCohortId(cohorts[0].id)
  }, [cohorts, selectedCohortId])

  // Warm up Paddle.js so the overlay opens instantly on click.
  useEffect(() => { void getPaddle() }, [])

  // Poll the dashboard while we wait for the webhook to land.
  const { data: dash } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load dashboard')
      return data!
    },
    enabled: phase === 'activating',
    refetchInterval: phase === 'activating' ? 2000 : false,
  })

  useEffect(() => {
    if (phase !== 'activating') return
    if (dash && dash.dashboardState !== 'NO_COHORT') {
      setPhase('done')
      void queryClient.invalidateQueries({ queryKey: ['student-dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['lms-dashboard'] })
      const t = setTimeout(() => router.push('/courses'), 1200)
      return () => clearTimeout(t)
    }
  }, [dash, phase, queryClient, router])

  // Paddle overlay lifecycle
  useEffect(() => {
    return onPaddleEvent((event) => {
      if (!activeTxn.current) return
      switch (event.name) {
        case CheckoutEventNames.CHECKOUT_COMPLETED:
          setPhase('activating')
          break
        case CheckoutEventNames.CHECKOUT_PAYMENT_FAILED:
          setError('Payment failed. Please try another card.')
          break
        case CheckoutEventNames.CHECKOUT_CLOSED:
          setPhase((p) => (p === 'checkout' ? 'idle' : p))
          break
        case CheckoutEventNames.CHECKOUT_ERROR:
          setError(event.detail ?? 'Checkout error. Please try again.')
          setPhase('idle')
          break
        default:
          break
      }
    })
  }, [])

  const createTxn = useMutation({
    mutationFn: async () => {
      const { data, error } = await checkoutApi.createPaddleTransaction(selectedCohortId)
      if (error) throw new Error(error.message ?? 'Could not start checkout')
      return data!
    },
    onMutate: () => { setError(null); setPhase('creating') },
    onSuccess: async (txn) => {
      const paddle = await getPaddle()
      if (!paddle) {
        setError('Payments are not available right now.')
        setPhase('idle')
        return
      }
      activeTxn.current = txn.transactionId
      setPhase('checkout')
      paddle.Checkout.open({ transactionId: txn.transactionId })
    },
    onError: (err: Error) => { setError(err.message); setPhase('idle') },
  })

  if (!isPaddleEnabled() || cohorts.length === 0) return null

  const selected = cohorts.find((c) => c.id === selectedCohortId) ?? cohorts[0]
  const busy = phase === 'creating' || phase === 'checkout'
  const listPrice = selected?.price ?? 0
  const payPrice = promo.discounted(listPrice)

  return (
    <div
      data-slot="paddle-enroll-card"
      className={cn('w-full max-w-md rounded-xl border bg-card p-5 text-left', className)}
    >
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-[#4a9ad4]" />
        <h2 className="text-sm font-medium text-foreground">Enroll with a card</h2>
        {PADDLE_ENV === 'sandbox' && (
          <span className="ml-auto rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Sandbox
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Secure checkout by Paddle. You&apos;ll get instant access once payment clears.
      </p>

      {phase === 'activating' || phase === 'done' ? (
        <div className="mt-4 flex items-center gap-3 rounded-md bg-muted px-3 py-3 text-sm">
          {phase === 'done'
            ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            : <Loader2 className="h-5 w-5 animate-spin text-[#4a9ad4]" />}
          <div>
            <p className="font-medium text-foreground">
              {phase === 'done' ? 'You&apos;re in!' : 'Payment received'}
            </p>
            <p className="text-xs text-muted-foreground">
              {phase === 'done' ? 'Taking you to your course…' : 'Setting up your enrollment…'}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <PromoTicker compact />
          <select
            data-slot="paddle-cohort-select"
            aria-label="Select a cohort to enroll in"
            className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
            disabled={busy}
          >
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — ${c.price}
              </option>
            ))}
          </select>
          <div className="flex items-baseline justify-between">
            {selected?.meta
              ? <p className="text-xs text-muted-foreground">{selected.meta}</p>
              : <span />}
            <p className="text-sm">
              {promo.active && (
                <span className="mr-2 text-muted-foreground line-through">${listPrice.toLocaleString()}</span>
              )}
              <span className="font-semibold text-foreground">${payPrice.toLocaleString()}</span>
            </p>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">{error}</p>
          )}
          <Button
            type="button"
            className="w-full"
            onClick={() => createTxn.mutate()}
            disabled={busy || !selectedCohortId}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {phase === 'creating' ? 'Preparing checkout…'
              : phase === 'checkout' ? 'Complete payment in the popup…'
              : `Pay $${payPrice.toLocaleString()} and enroll`}
          </Button>
        </div>
      )}
    </div>
  )
}

export { PaddleEnrollCard }
