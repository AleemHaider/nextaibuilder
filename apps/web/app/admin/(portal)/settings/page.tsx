'use client'
// PBA-132 — Admin Settings page (profile, account, platform info)
// PBA-241 — Sub-Admin Management card added for SUPER_ADMIN
// PBA-261 — 2FA toggle card
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { User, Camera, Shield, Info, Users, KeyRound, AlertCircle, Phone, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/format'
import { useAdminProfile, useUpdateProfile, useUpdateAvatar } from '@/hooks/use-admin-settings'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuth } from '@/hooks/use-auth'
import { apiFetch } from '@/store/auth'
import { useUpdateAgentSettings } from '@/hooks/use-agent-settings'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function roleLabel(role: string) {
  if (role === 'SUPER_ADMIN') return 'Super Admin'
  if (role === 'ADMIN') return 'Admin'
  return role
}

// ── Form types ────────────────────────────────────────────────────────────────

interface ProfileFormValues {
  firstName: string
  lastName: string
}

// ── Avatar uploader ───────────────────────────────────────────────────────────

interface AvatarUploaderProps {
  avatarUrl: string | null | undefined
  initials: string
  onFile: (file: File) => void
  uploading: boolean
}

function AvatarUploader({ avatarUrl, initials, onFile, uploading }: AvatarUploaderProps) {
  const fileRef = React.useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="h-16 w-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile photo" />}
          <AvatarFallback className="text-lg font-medium">{initials}</AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Upload profile photo"
          onChange={handleChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          Change Photo
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPEG or WebP · Max 2 MB</p>
      </div>
    </div>
  )
}

// ── Call Settings Card (PBA-329) ──────────────────────────────────────────────

function CallSettingsCard({ initialSchedulingUrl }: { initialSchedulingUrl: string | null }) {
  const [schedulingUrl, setSchedulingUrl] = React.useState(initialSchedulingUrl ?? '')
  const [isAvailableForCalls, setIsAvailableForCalls] = React.useState(true)
  const [urlError, setUrlError] = React.useState<string | null>(null)
  const updateAgent = useUpdateAgentSettings()

  function validateUrl(url: string): boolean {
    if (!url.trim()) return true
    try { new URL(url); return true } catch { return false }
  }

  async function handleSaveUrl() {
    if (!validateUrl(schedulingUrl)) {
      setUrlError('Enter a valid URL (e.g. https://calendly.com/...)')
      return
    }
    setUrlError(null)
    try {
      await updateAgent.mutateAsync({ schedulingUrl: schedulingUrl.trim() || null })
      toast.success('Scheduling URL saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleToggleAvailability() {
    const newValue = !isAvailableForCalls
    setIsAvailableForCalls(newValue)
    try {
      await updateAgent.mutateAsync({ isAvailableForCalls: newValue })
      toast.success(newValue ? 'You are now available for calls' : 'You are now unavailable for calls')
    } catch (err) {
      setIsAvailableForCalls(!newValue) // revert optimistic update
      toast.error(err instanceof Error ? err.message : 'Failed to update availability')
    }
  }

  return (
    <Card data-slot="call-settings-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4" aria-hidden="true" />
          Call Settings
        </CardTitle>
        <CardDescription>
          Manage your student call booking settings. Students can book 15-min calls with you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Availability toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Available for calls</p>
            <p className="text-xs text-muted-foreground">
              Toggle off to temporarily pause new bookings
            </p>
          </div>
          <Switch
            checked={isAvailableForCalls}
            onCheckedChange={handleToggleAvailability}
            disabled={updateAgent.isPending}
          />
        </div>

        <Separator />

        {/* Scheduling URL */}
        <div className="space-y-1.5">
          <Label htmlFor="agent-scheduling-url">Scheduling URL</Label>
          <div className="flex gap-2">
            <Input
              id="agent-scheduling-url"
              type="url"
              placeholder="https://calendly.com/your-link"
              value={schedulingUrl}
              onChange={(e) => { setSchedulingUrl(e.target.value); setUrlError(null) }}
              aria-invalid={Boolean(urlError)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveUrl}
              disabled={updateAgent.isPending}
            >
              {updateAgent.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : 'Save'}
            </Button>
          </div>
          {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          <p className="text-xs text-muted-foreground">
            Link students use to book a slot with you (e.g. Calendly, Cal.com).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── 2FA Card (PBA-261) ────────────────────────────────────────────────────────

type TwoFaStep = 'idle' | 'otp-enable' | 'otp-disable' | 'success-enable' | 'success-disable'

function TwoFactorCard({ enabled: initialEnabled, isSuperAdmin }: { enabled: boolean; isSuperAdmin: boolean }) {
  const [enabled, setEnabled] = React.useState(initialEnabled)
  const [step, setStep] = React.useState<TwoFaStep>('idle')
  const [otp, setOtp] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [otpError, setOtpError] = React.useState<string | null>(null)

  const handleEnable = async () => {
    setLoading(true)
    setOtpError(null)
    const { error } = await apiFetch('/api/admin/settings/2fa/enable', { method: 'POST' })
    setLoading(false)
    if (error) {
      toast.error(error.message ?? 'Failed to send verification code')
      return
    }
    setOtp('')
    setStep('otp-enable')
  }

  const handleConfirmEnable = async () => {
    if (otp.length !== 6) return
    setLoading(true)
    setOtpError(null)
    const { error } = await apiFetch('/api/admin/settings/2fa/enable/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: otp }),
    })
    setLoading(false)
    if (error) {
      setOtpError(
        error.error === 'OTP_EXPIRED' ? 'Code has expired. Please request a new one.' :
        error.error === 'OTP_LOCKED'  ? 'Too many attempts. Please try again later.' :
        error.error === 'OTP_INVALID' ? 'Incorrect code. Please try again.' :
        (error.message ?? 'Something went wrong.')
      )
      return
    }
    setEnabled(true)
    setStep('success-enable')
  }

  const handleDisable = async () => {
    setLoading(true)
    setOtpError(null)
    const { error } = await apiFetch('/api/admin/settings/2fa/disable', { method: 'POST' })
    setLoading(false)
    if (error) {
      toast.error(error.message ?? 'Failed to send verification code')
      return
    }
    setOtp('')
    setStep('otp-disable')
  }

  const handleConfirmDisable = async () => {
    if (otp.length !== 6) return
    setLoading(true)
    setOtpError(null)
    const { error } = await apiFetch('/api/admin/settings/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code: otp }),
    })
    setLoading(false)
    if (error) {
      setOtpError(
        error.error === 'OTP_EXPIRED' ? 'Code has expired. Please request a new one.' :
        error.error === 'OTP_LOCKED'  ? 'Too many attempts. Please try again later.' :
        error.error === 'OTP_INVALID' ? 'Incorrect code. Please try again.' :
        (error.message ?? 'Something went wrong.')
      )
      return
    }
    setEnabled(false)
    setStep('success-disable')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your admin account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* SUPER_ADMIN: always required */}
        {isSuperAdmin ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted/60 px-4 py-3">
            <Shield className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Two-factor authentication is always required for Super Admin accounts and cannot be disabled.
            </p>
          </div>
        ) : (
          <>
            {/* Status row */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {enabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? 'You will be asked for a verification code each time you log in.'
                    : 'Enable 2FA to require a verification code at every login.'}
                </p>
              </div>
              {step === 'idle' && (
                <Button
                  variant={enabled ? 'outline' : 'default'}
                  size="sm"
                  onClick={enabled ? handleDisable : handleEnable}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : enabled ? 'Disable' : 'Enable'}
                </Button>
              )}
            </div>

            {/* OTP entry step */}
            {(step === 'otp-enable' || step === 'otp-disable') && (
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  A 6-digit verification code has been sent to your email. Enter it below to confirm.
                </p>
                {otpError && (
                  <div role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/[0.06] border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                    <p className="text-sm text-destructive">{otpError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => {
                      setOtpError(null)
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }}
                    className={cn(
                      'flex h-9 w-32 rounded-md border border-input bg-input-background px-3 py-1 text-sm',
                      'text-center tracking-widest font-medium',
                      'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    )}
                    aria-label="Verification code"
                  />
                  <Button
                    size="sm"
                    onClick={step === 'otp-enable' ? handleConfirmEnable : handleConfirmDisable}
                    disabled={otp.length !== 6 || loading}
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      : 'Confirm'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setStep('idle'); setOtp(''); setOtpError(null) }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Success messages */}
            {step === 'success-enable' && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <Shield className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" />
                <p className="text-sm text-green-700">
                  Two-factor authentication has been enabled.
                </p>
              </div>
            )}
            {step === 'success-disable' && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication has been disabled.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const { data: profile, isLoading: profileLoading } = useAdminProfile()
  const { mutateAsync: updateProfile, isPending: saving } = useUpdateProfile()
  const { mutateAsync: updateAvatar, isPending: uploadingAvatar } = useUpdateAvatar()
  const { isSuperAdmin } = usePermissions()
  const { user } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
    },
  })

  // Populate form once profile loads
  React.useEffect(() => {
    if (profile) {
      reset({ firstName: profile.firstName, lastName: profile.lastName })
    }
  }, [profile, reset])

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await updateProfile(values)
      toast.success('Profile updated successfully')
      reset(values) // mark form as pristine with new values
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    }
  }

  const handleAvatarFile = async (file: File) => {
    try {
      await updateAvatar(file)
      toast.success('Profile photo updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo')
    }
  }

  const initials =
    profile ? getInitials(profile.firstName, profile.lastName) : '?'

  // ── App version / support info (static)
  const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'
  const SUPPORT_EMAIL = 'support@productbuilderacademy.com'

  return (
    <div data-slot="admin-settings-page" className="space-y-6 max-w-2xl">

      {/* Page heading */}
      <div>
        <h2 className="text-xl font-medium text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your profile and account preferences.
        </p>
      </div>

      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" aria-hidden="true" />
            Profile
          </CardTitle>
          <CardDescription>
            Update your display name and profile photo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {profileLoading ? (
            <>
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-28 rounded-md" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-12" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* Avatar */}
              <AvatarUploader
                avatarUrl={profile?.avatarUrl}
                initials={initials}
                onFile={handleAvatarFile}
                uploading={uploadingAvatar}
              />

              <Separator />

              {/* Name fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    placeholder="Jane"
                    aria-invalid={Boolean(errors.firstName)}
                    {...register('firstName', { required: 'First name is required' })}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive mt-1">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Smith"
                    aria-invalid={Boolean(errors.lastName)}
                    {...register('lastName', { required: 'Last name is required' })}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive mt-1">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              {/* Email (read-only) */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email ?? ''}
                  readOnly
                  disabled
                  className="opacity-60 cursor-not-allowed"
                  aria-describedby="email-hint"
                />
                <p id="email-hint" className="text-xs text-muted-foreground">
                  Email is managed through your SSO provider and cannot be changed here.
                </p>
              </div>

              {/* Role (read-only) */}
              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="flex items-center gap-2 h-9">
                  <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Badge variant="secondary">{roleLabel(profile?.role ?? 'ADMIN')}</Badge>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !isDirty}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Saving…
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Account card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" aria-hidden="true" />
            Account
          </CardTitle>
          <CardDescription>Account activity and membership details.</CardDescription>
        </CardHeader>
        <CardContent>
          {profileLoading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          ) : (
            <dl className="divide-y divide-border">
              <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <dt className="text-sm text-muted-foreground">Joined</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatDate(profile?.joinedAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <dt className="text-sm text-muted-foreground">Last active</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatDate(profile?.lastActiveAt)}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      {/* 2FA card — PBA-261 */}
      <TwoFactorCard
        enabled={user?.twoFactorEnabled ?? false}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Platform info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" aria-hidden="true" />
            Platform
          </CardTitle>
          <CardDescription>Application information and support resources.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <dt className="text-sm text-muted-foreground">App version</dt>
              <dd className="text-sm font-medium text-foreground font-mono">{APP_VERSION}</dd>
            </div>
            <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <dt className="text-sm text-muted-foreground">Support</dt>
              <dd className="text-sm font-medium">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-foreground underline underline-offset-4 hover:text-foreground/70 transition-colors"
                >
                  {SUPPORT_EMAIL}
                </a>
              </dd>
            </div>
            <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <dt className="text-sm text-muted-foreground">Environment</dt>
              <dd className="text-sm font-medium text-foreground">
                <Badge variant="outline" className="font-mono text-xs">
                  {process.env.NODE_ENV ?? 'production'}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Sub-Admin Management card — SUPER_ADMIN only (PBA-241) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              Sub-Admin Management
            </CardTitle>
            <CardDescription>
              Create and manage admin accounts with granular access permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/sub-admins')}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Manage Sub-Admins
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Call Settings card — PBA-329 — only visible to support agents */}
      {user?.takesStudentCalls && (
        <CallSettingsCard
          initialSchedulingUrl={user.schedulingUrl ?? null}
        />
      )}

    </div>
  )
}
