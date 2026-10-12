'use client'

// PBA-315 — Delete account confirmation dialog with credential verification
import * as React from 'react'
import { Trash2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDeleteAccount } from '@/hooks/use-student-profile'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

interface DeleteAccountDialogProps {
  open: boolean
  onClose: () => void
  hasPassword: boolean
}

function DeleteAccountDialog({ open, onClose, hasPassword }: DeleteAccountDialogProps) {
  const [password, setPassword]         = React.useState('')
  const [confirmation, setConfirmation] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError]               = React.useState('')
  const deleteMutation                  = useDeleteAccount()

  // Reset state whenever dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setPassword('')
      setConfirmation('')
      setShowPassword(false)
      setError('')
    }
  }, [open])

  const canConfirm = hasPassword
    ? password.trim().length > 0
    : confirmation === 'DELETE'

  async function handleDelete() {
    setError('')
    try {
      await deleteMutation.mutateAsync(
        hasPassword
          ? { password }
          : { confirmation },
      )
      // onSuccess in the hook navigates to /login — no need to call onClose
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account. Please try again.')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-[#d4183d]" />
            </div>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            This action is permanent and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Warning box */}
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
          <p className="font-medium mb-1">The following will be permanently deleted:</p>
          <ul className="list-disc list-inside space-y-0.5 text-red-700">
            <li>Your progress and step completions</li>
            <li>All submitted screenshots</li>
            <li>Earned badges</li>
            <li>Your certificate (if issued)</li>
          </ul>
        </div>

        {/* Credential input */}
        <div className="mt-2">
          {hasPassword ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2744]" htmlFor="delete-password">
                Enter your current password to confirm
              </label>
              <div className="relative">
                <input
                  id="delete-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="Your current password"
                  className={cn(
                    'w-full h-10 px-3 pr-10 rounded-md text-sm text-[#1a2744] bg-[#f3f3f5]',
                    'border border-black/10 focus:outline-none focus:border-[#4a9ad4] focus:ring-2 focus:ring-[#4a9ad4]/20',
                    'placeholder:text-[#717182]',
                    error && 'border-[#d4183d]',
                  )}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#1a2744]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2744]" htmlFor="delete-confirmation">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                id="delete-confirmation"
                type="text"
                value={confirmation}
                onChange={(e) => { setConfirmation(e.target.value); setError('') }}
                placeholder="DELETE"
                className={cn(
                  'w-full h-10 px-3 rounded-md text-sm text-[#1a2744] bg-[#f3f3f5]',
                  'border border-black/10 focus:outline-none focus:border-[#4a9ad4] focus:ring-2 focus:ring-[#4a9ad4]/20',
                  'placeholder:text-[#717182]',
                  error && 'border-[#d4183d]',
                )}
              />
            </div>
          )}
          {error && <p className="text-xs text-[#d4183d] mt-1">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <button
            onClick={handleDelete}
            disabled={!canConfirm || deleteMutation.isPending}
            className={cn(
              'inline-flex items-center justify-center rounded-md h-9 px-4 text-sm font-medium',
              'bg-[#d4183d] text-white transition-opacity',
              (!canConfirm || deleteMutation.isPending) && 'opacity-40 cursor-not-allowed',
            )}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete my account'}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DeleteAccountDialog }
