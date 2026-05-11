// Pricing tab — Sprint 2 Story 11.
//
// API-backed CRUD for PaymentPlans. Supports ONE_TIME + INSTALLMENT variants
// with a shared modal for add / edit, a toggle for active/inactive, and a
// ConfirmDialog-gated deactivation (backend has no DELETE; deactivation is
// the safe equivalent — historic plans remain tied to past enrolments).

import { useState } from 'react'
import { Plus, DollarSign } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminPaymentPlans,
  createAdminPaymentPlan,
  updateAdminPaymentPlan,
  toggleAdminPaymentPlan,
  type AdminPaymentPlan,
  type CreatePaymentPlanPayload,
} from '../../../lib/api'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { FormField } from '../../../components/ui/FormField'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { EmptyState } from '../../../components/ui/EmptyState'
import { STALE_TIME } from '../../../lib/queryConfig'
import { cn } from '../../../lib/utils'

interface PaymentPlanFormState {
  name: string
  type: 'ONE_TIME' | 'INSTALLMENT'
  totalAmount: string
  currency: string
  intervalDays: string
}

function blankPlanForm(): PaymentPlanFormState {
  return {
    name: '',
    type: 'ONE_TIME',
    totalAmount: '',
    currency: 'usd',
    intervalDays: '30',
  }
}

function planToForm(p: AdminPaymentPlan): PaymentPlanFormState {
  return {
    name: p.name,
    type: p.type,
    totalAmount: String(p.totalAmount),
    currency: p.currency,
    intervalDays: p.intervalDays != null ? String(p.intervalDays) : '30',
  }
}

function formatAmount(amount: number, currency: string): string {
  // Amount is stored in cents (see createPaymentPlanSchema z.number().int().min(100)).
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100)
  } catch {
    return `$${(amount / 100).toFixed(0)}`
  }
}

export function PricingTab({
  cohortId,
  isAdmin,
  addToast,
}: {
  cohortId: string | null
  isAdmin: boolean
  addToast: (message: string, variant: 'success' | 'error') => void
}) {
  const queryClient = useQueryClient()
  const plansKey = ['admin', 'courses', cohortId ?? '__draft__', 'payment-plans'] as const

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminPaymentPlan | null>(null)
  const [form, setForm] = useState<PaymentPlanFormState>(blankPlanForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<AdminPaymentPlan | null>(null)

  const {
    data: plans = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: plansKey,
    queryFn: () => fetchAdminPaymentPlans(cohortId as string),
    enabled: Boolean(cohortId),
    staleTime: STALE_TIME.medium,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreatePaymentPlanPayload) =>
      createAdminPaymentPlan(cohortId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey })
      addToast('Payment plan created', 'success')
      setModalOpen(false)
      setForm(blankPlanForm())
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (args: {
      planId: string
      payload: Omit<CreatePaymentPlanPayload, 'type'>
    }) =>
      updateAdminPaymentPlan(cohortId as string, args.planId, args.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey })
      addToast('Payment plan updated', 'success')
      setModalOpen(false)
      setEditingPlan(null)
      setForm(blankPlanForm())
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const toggleMutation = useMutation({
    mutationFn: (planId: string) =>
      toggleAdminPaymentPlan(cohortId as string, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey })
      addToast('Payment plan updated', 'success')
      setDeletingPlan(null)
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  function openAddModal() {
    setEditingPlan(null)
    setForm(blankPlanForm())
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(plan: AdminPaymentPlan) {
    setEditingPlan(plan)
    setForm(planToForm(plan))
    setFormError(null)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) {
      setFormError('Plan name is required')
      return
    }
    const amount = Number(form.totalAmount)
    if (!Number.isFinite(amount) || amount < 100) {
      setFormError('Total amount must be at least 100 (cents)')
      return
    }
    const currency = form.currency.trim() || 'usd'
    if (currency.length !== 3) {
      setFormError('Currency must be a 3-letter ISO code')
      return
    }
    if (editingPlan) {
      // type is immutable on the back end — we strip it from the PATCH body.
      updateMutation.mutate({
        planId: editingPlan.id,
        payload: {
          name: form.name.trim(),
          totalAmount: amount,
          currency,
          ...(form.type === 'INSTALLMENT'
            ? { intervalDays: Number(form.intervalDays) || 30 }
            : {}),
        },
      })
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        type: form.type,
        totalAmount: amount,
        currency,
        ...(form.type === 'INSTALLMENT'
          ? { intervalDays: Number(form.intervalDays) || 30 }
          : {}),
      })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  if (!cohortId) {
    return (
      <div className="px-8 py-6">
        <EmptyState
          icon={DollarSign}
          title="Save the course first"
          description="Payment plans are attached to a saved course. Save the draft on the Overview tab to start defining pricing."
        />
      </div>
    )
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-[700] text-[#1a2744]">Payment Plans</h3>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} aria-hidden="true" />}
            onClick={openAddModal}
          >
            Add Plan
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="py-10">
          <LoadingSpinner centered label="Loading payment plans" />
        </div>
      )}

      {isError && (
        <div className="p-6 text-center text-[13px] text-[#d03238]">
          Failed to load payment plans. Try refreshing.
        </div>
      )}

      {!isLoading && !isError && plans.length === 0 && (
        <EmptyState
          icon={DollarSign}
          title="No payment plans yet"
          description="Add a one-time or installment plan to start selling this cohort."
          action={
            isAdmin
              ? { label: 'Add Plan', onClick: openAddModal }
              : undefined
          }
        />
      )}

      {!isLoading && !isError && plans.length > 0 && (
        <div
          className="bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden"
          data-testid="payment-plans-list"
        >
          <table className="w-full border-collapse" aria-label="Payment plans">
            <thead>
              <tr>
                {['Name', 'Type', 'Amount', 'Installments', 'Active', 'Actions'].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="text-left text-[12px] font-[600] text-[#717182] px-5 py-3 border-b border-[rgba(26,39,68,0.08)] uppercase tracking-[0.5px] bg-[#f8f9fb]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:[&>td]:bg-[#f8f9fb] transition-colors">
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[600] text-[#1a2744]">
                    {plan.name}
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                    {plan.type === 'ONE_TIME' ? 'One-time' : 'Installment'}
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#1a2744] font-[600]">
                    {formatAmount(plan.totalAmount, plan.currency)}
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                    {plan.type === 'INSTALLMENT'
                      ? `${plan.installments?.length ?? 3} × every ${plan.intervalDays ?? 30}d`
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                    <span
                      className={cn(
                        'text-[11px] font-[600] px-[9px] py-[3px] rounded-full',
                        plan.isActive
                          ? 'bg-[#e6f4ec] text-[#054d28]'
                          : 'bg-[#f0f0f0] text-[#717182]',
                      )}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-[13px] font-[600] text-[#4a9ad4] hover:underline"
                        onClick={() => openEditModal(plan)}
                        disabled={!isAdmin}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[13px] font-[600] text-[#d03238] hover:underline"
                        onClick={() => setDeletingPlan(plan)}
                        disabled={!isAdmin}
                      >
                        {plan.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit plan modal */}
      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModalOpen(false)
            setEditingPlan(null)
            setFormError(null)
          }
        }}
        title={editingPlan ? 'Edit Payment Plan' : 'Add Payment Plan'}
        description="Define the price, currency, and schedule for this cohort."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false)
                setEditingPlan(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="payment-plan-form"
              isLoading={isSaving}
            >
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </>
        }
      >
        <form
          id="payment-plan-form"
          onSubmit={handleSubmit}
          className={cn('flex flex-col gap-4')}
        >
          <FormField id="plan-name" label="Plan name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Founding cohort"
            />
          </FormField>
          <div>
            <label
              htmlFor="plan-type"
              className="block text-[14px] font-semibold text-[var(--color-wise-text)] mb-1.5"
            >
              Type
            </label>
            <select
              id="plan-type"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as 'ONE_TIME' | 'INSTALLMENT',
                })
              }
              disabled={Boolean(editingPlan)}
              className={cn(
                'w-full h-11 px-4 rounded-xl border bg-white text-[15px]',
                'border-[var(--color-wise-ring)] outline-none',
                'focus:ring-4 focus:ring-[var(--color-wise-primary)]/25',
                'disabled:opacity-50',
              )}
            >
              <option value="ONE_TIME">One-time</option>
              <option value="INSTALLMENT">Installment (3 payments)</option>
            </select>
            {editingPlan && (
              <p className="mt-1.5 text-[12px] text-[var(--color-wise-text-muted)]">
                Plan type cannot be changed after creation.
              </p>
            )}
          </div>
          <FormField
            id="plan-amount"
            label="Total amount (cents)"
            helperText="Store the amount in cents — e.g. $499 → 49900."
            required
          >
            <Input
              type="number"
              min={100}
              value={form.totalAmount}
              onChange={(e) =>
                setForm({ ...form, totalAmount: e.target.value })
              }
              placeholder="49900"
            />
          </FormField>
          <FormField
            id="plan-currency"
            label="Currency (3-letter ISO)"
            required
          >
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="usd"
              maxLength={3}
            />
          </FormField>
          {form.type === 'INSTALLMENT' && (
            <FormField
              id="plan-interval"
              label="Days between installments"
            >
              <Input
                type="number"
                min={1}
                value={form.intervalDays}
                onChange={(e) =>
                  setForm({ ...form, intervalDays: e.target.value })
                }
              />
            </FormField>
          )}
          {formError && (
            <p
              role="alert"
              className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
            >
              {formError}
            </p>
          )}
        </form>
      </Modal>

      {/* Delete / toggle confirm dialog */}
      <ConfirmDialog
        open={Boolean(deletingPlan)}
        onOpenChange={(open) => {
          if (!open) setDeletingPlan(null)
        }}
        title={deletingPlan?.isActive ? 'Deactivate plan?' : 'Activate plan?'}
        description={
          deletingPlan
            ? deletingPlan.isActive
              ? `"${deletingPlan.name}" will no longer be purchasable. Existing enrolments are unaffected.`
              : `"${deletingPlan.name}" will become purchasable again.`
            : ''
        }
        confirmLabel={deletingPlan?.isActive ? 'Deactivate' : 'Activate'}
        cancelLabel="Cancel"
        variant={deletingPlan?.isActive ? 'danger' : 'warning'}
        isLoading={toggleMutation.isPending}
        onConfirm={async () => {
          if (deletingPlan) {
            await toggleMutation.mutateAsync(deletingPlan.id)
          }
        }}
      />
    </div>
  )
}
