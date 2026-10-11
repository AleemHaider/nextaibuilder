'use client'

// PBA-315 — Profile section: name update + email (read-only) + cohort display
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AvatarUpload } from './avatar-upload'
import { useUpdateProfile } from '@/hooks/use-student-profile'
import type { ProfileResponse } from '@/lib/api-client'

interface ProfileSectionProps {
  profile: ProfileResponse
  className?: string
}

interface ProfileFormValues {
  firstName: string
  lastName:  string
}

function ProfileSection({ profile, className }: ProfileSectionProps) {
  const updateProfile = useUpdateProfile()

  const {
    register,
    handleSubmit,
    formState: { isDirty, isSubmitting },
    reset,
  } = useForm<ProfileFormValues>({
    defaultValues: {
      firstName: profile.firstName,
      lastName:  profile.lastName,
    },
  })

  async function onSubmit(values: ProfileFormValues) {
    try {
      await updateProfile.mutateAsync(values)
      reset(values) // mark form as clean after save
      toast.success('Profile updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile.')
    }
  }

  function handleAvatarSuccess() {
    // The mutation in AvatarUpload already invalidates the profile query
    // and updates the auth store. Nothing extra to do here.
  }

  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase()

  const cohortStartFormatted = profile.cohort?.startDate
    ? new Date(profile.cohort.startDate).toLocaleDateString('en-GB', {
        day:   'numeric',
        month: 'long',
        year:  'numeric',
      })
    : null

  return (
    <section
      data-slot="profile-section"
      className={cn('border-b border-black/10 pb-10 mb-10', className)}
    >
      <h2 className="text-[18px] font-medium text-[#1a2744] mb-6">Personal Information</h2>

      {/* Avatar */}
      <div className="flex items-center gap-6 mb-8">
        <AvatarUpload
          currentUrl={profile.avatarUrl}
          initials={initials}
          onSuccess={handleAvatarSuccess}
        />
        <div>
          <p className="text-sm font-medium text-[#1a2744]">Profile photo</p>
          <p className="text-sm text-[#717182] mt-0.5">JPEG, PNG or WebP · max 5 MB</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* First name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1a2744]" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              className={cn(
                'h-10 px-3 rounded-md text-sm text-[#1a2744] bg-[#f3f3f5] border border-black/10',
                'focus:outline-none focus:border-[#4a9ad4] focus:ring-2 focus:ring-[#4a9ad4]/20',
                'placeholder:text-[#717182]',
              )}
              {...register('firstName', { required: true })}
            />
          </div>

          {/* Last name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1a2744]" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              className={cn(
                'h-10 px-3 rounded-md text-sm text-[#1a2744] bg-[#f3f3f5] border border-black/10',
                'focus:outline-none focus:border-[#4a9ad4] focus:ring-2 focus:ring-[#4a9ad4]/20',
                'placeholder:text-[#717182]',
              )}
              {...register('lastName', { required: true })}
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#1a2744]" htmlFor="email">
              Email address
            </label>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f3f3f5] text-[#717182] border border-black/10">
              <Lock className="w-2.5 h-2.5" />
              Read only
            </span>
          </div>
          <input
            id="email"
            type="email"
            value={profile.email}
            readOnly
            className={cn(
              'h-10 px-3 rounded-md text-sm bg-[#f3f3f5] border border-black/10',
              'text-[#717182] cursor-not-allowed select-none',
            )}
          />
          <p className="text-xs text-[#717182]">
            Email address cannot be changed. Contact support if needed.
          </p>
        </div>

        {/* Cohort */}
        {profile.cohort && (
          <div className="flex flex-col gap-1.5 mb-6">
            <label className="text-sm font-medium text-[#1a2744]">Cohort</label>
            <div className={cn(
              'h-10 px-3 rounded-md text-sm bg-[#f3f3f5] border border-black/10',
              'flex items-center gap-2 text-[#717182]',
            )}>
              <span className="font-medium text-[#1a2744]">{profile.cohort.name}</span>
              {cohortStartFormatted && (
                <>
                  <span className="w-1 h-1 rounded-full bg-[#cbced4]" />
                  <span>Started {cohortStartFormatted}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Save row */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className={cn(
              'h-10 px-5 rounded-md text-sm font-medium bg-[#030213] text-white transition-opacity',
              (!isDirty || isSubmitting) && 'opacity-40 cursor-not-allowed',
            )}
          >
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>

          {isDirty && !isSubmitting && (
            <span className="text-sm text-[#4a9ad4]">You have unsaved changes</span>
          )}
        </div>
      </form>
    </section>
  )
}

export { ProfileSection }
