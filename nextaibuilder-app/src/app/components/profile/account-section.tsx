// PBA-315 — Account actions section: change password, sign out, delete account
import * as React from 'react'
import { LogOut, Trash2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PasswordSection } from './password-section'
import { SignOutDialog } from './sign-out-dialog'
import { DeleteAccountDialog } from './delete-account-dialog'

interface AccountSectionProps {
  hasPassword: boolean
  className?: string
}

function AccountSection({ hasPassword, className }: AccountSectionProps) {
  const [showSignOutDialog, setShowSignOutDialog]   = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog]     = React.useState(false)

  return (
    <section
      data-slot="account-section"
      className={cn('', className)}
    >
      <h2 className="text-[18px] font-medium text-[#1a2744] mb-6">Account</h2>

      <div className="border border-black/10 rounded-xl overflow-hidden">
        {/* Password row (expandable) */}
        {hasPassword && (
          <div className="border-b border-black/10">
            <PasswordSection hasPassword={hasPassword} />
          </div>
        )}

        {/* Sign out row */}
        <button
          type="button"
          onClick={() => setShowSignOutDialog(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-black/10"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#f3f3f5] flex items-center justify-center">
              <LogOut className="w-4 h-4 text-[#717182]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-[#1a2744]">Sign out</p>
              <p className="text-xs text-[#717182] mt-0.5">Sign out of your account on this device</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#717182]" />
        </button>

        {/* Delete account row */}
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-[#d4183d]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-[#d4183d]">Delete account</p>
              <p className="text-xs text-[#717182] mt-0.5">Permanently delete your account and all data</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#717182]" />
        </button>
      </div>

      {/* Dialogs */}
      <SignOutDialog
        open={showSignOutDialog}
        onClose={() => setShowSignOutDialog(false)}
      />
      <DeleteAccountDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        hasPassword={hasPassword}
      />
    </section>
  )
}

export { AccountSection }
