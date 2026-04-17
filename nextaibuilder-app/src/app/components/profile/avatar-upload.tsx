// PBA-315 — Avatar upload component with presign → S3 PUT → confirm flow
import * as React from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePresignAvatar, useUpdateAvatarKey } from '@/hooks/use-student-profile'

interface AvatarUploadProps {
  currentUrl: string | null
  initials: string
  onSuccess: (avatarUrl: string) => void
  className?: string
}

function AvatarUpload({ currentUrl, initials, onSuccess, className }: AvatarUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  const presignMutation   = usePresignAvatar()
  const updateKeyMutation = useUpdateAvatarKey()

  const displayUrl = preview ?? currentUrl

  function handleClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!e.target.files) return
    // Reset value so same file can be re-selected if needed
    e.target.value = ''

    if (!file) return

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPEG, PNG, or WebP image.')
      return
    }

    // Validate size (5 MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size is 5 MB.')
      return
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setIsUploading(true)

    try {
      // 1. Get presigned URL
      const contentType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'
      const { presignedUrl, s3Key } = await presignMutation.mutateAsync(contentType)

      // 2. PUT directly to S3
      const putRes = await fetch(presignedUrl, {
        method:  'PUT',
        body:    file,
        headers: { 'Content-Type': contentType },
      })

      if (!putRes.ok) {
        throw new Error('Upload failed. Please try again.')
      }

      // 3. Confirm s3Key with backend → get permanent avatarUrl
      const { avatarUrl } = await updateKeyMutation.mutateAsync(s3Key)
      onSuccess(avatarUrl)

      // Revoke old object URL since we now have a real URL
      URL.revokeObjectURL(objectUrl)
      setPreview(null)

      toast.success('Profile photo updated.')
    } catch (err) {
      // Revert preview on failure
      URL.revokeObjectURL(objectUrl)
      setPreview(null)
      toast.error(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div data-slot="avatar-upload" className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        className="group relative w-24 h-24 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9ad4] focus-visible:ring-offset-2"
        aria-label="Change profile photo"
      >
        {/* Avatar circle */}
        <div
          className="w-24 h-24 rounded-full overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4a9ad4, #ff8c5a)' }}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Profile photo"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="flex items-center justify-center w-full h-full text-2xl font-bold text-white select-none">
              {initials}
            </span>
          )}
        </div>

        {/* Hover overlay */}
        {isUploading ? (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
            <Camera className="w-5 h-5 text-white" />
            <span className="text-white text-[10px] font-medium leading-tight text-center px-2">
              Change Photo
            </span>
          </div>
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
        tabIndex={-1}
      />
    </div>
  )
}

export { AvatarUpload }
