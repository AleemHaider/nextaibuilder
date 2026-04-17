// PBA-315 — Sign out confirmation dialog
import { useNavigate } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { logout } from '@/store/auth'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/app/components/ui/alert-dialog'

interface SignOutDialogProps {
  open: boolean
  onClose: () => void
}

function SignOutDialog({ open, onClose }: SignOutDialogProps) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await logout()
    void navigate('/login')
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            You'll be signed out of your account on this device.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-md h-9 px-4 text-sm font-medium bg-[#030213] text-white hover:bg-[#030213]/90 transition-colors"
          >
            Yes, sign out
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { SignOutDialog }
