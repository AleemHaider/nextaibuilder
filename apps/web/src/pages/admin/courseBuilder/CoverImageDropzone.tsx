// Cover-image upload dropzone for the Overview tab. Click-to-browse,
// drag-and-drop, preview, remove. Disabled until the course has been saved
// (the server needs a cohortId to associate the upload with).

import { useRef, useState } from 'react'
import { X as XIcon, ImageIcon } from 'lucide-react'
import { uploadAdminCourseCover, cohortCoverImageUrl } from '../../../lib/api'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { cn } from '../../../lib/utils'

const ACCEPTED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const COVER_MAX_BYTES = 5 * 1024 * 1024

export function CoverImageDropzone({
  cohortId,
  coverImageKey,
  onUploaded,
}: {
  cohortId: string | null
  coverImageKey: string | null
  onUploaded: (key: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = !cohortId
  const previewUrl = cohortCoverImageUrl(coverImageKey)

  const validate = (file: File): string | null => {
    if (!ACCEPTED_COVER_TYPES.includes(file.type)) {
      return 'Please upload a JPEG, PNG, or WebP image.'
    }
    if (file.size > COVER_MAX_BYTES) {
      return 'Image is over 5 MB. Please compress and try again.'
    }
    return null
  }

  const upload = async (file: File) => {
    if (!cohortId) {
      setError('Save the course first — cover upload needs a saved draft.')
      return
    }
    const validationError = validate(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setIsUploading(true)
    try {
      const { coverImageKey: key } = await uploadAdminCourseCover(cohortId, file)
      onUploaded(key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const openPicker = () => {
    if (disabled || isUploading) return
    inputRef.current?.click()
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void upload(file)
    // Reset so the same filename can be re-selected later
    e.target.value = ''
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || isUploading) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || isUploading) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void upload(file)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || isUploading) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_COVER_TYPES.join(',')}
        className="sr-only"
        onChange={onFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={previewUrl ? 'Replace cover image' : 'Upload cover image'}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'relative overflow-hidden rounded-[16px] border-2 border-dashed transition-colors',
          'text-center',
          disabled
            ? 'border-[rgba(26,39,68,0.15)] bg-[#f1f3f7] cursor-not-allowed opacity-70'
            : 'border-[rgba(26,39,68,0.2)] bg-[#f8f9fb] cursor-pointer hover:border-[#4a9ad4] hover:bg-[#eef6fd]',
          isDragOver && !disabled && 'border-[#4a9ad4] bg-[#eef6fd]',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4a9ad4]/25',
        )}
      >
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Cover preview"
              className="block w-full h-[200px] object-cover"
              onError={() => setError('Preview could not load — the image was uploaded but the server returned 404.')}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (disabled || isUploading) return
                onUploaded('')
              }}
              disabled={disabled || isUploading}
              aria-label="Remove cover image"
              className={cn(
                'absolute top-2 right-2 inline-flex items-center justify-center',
                'h-8 w-8 rounded-full bg-white/90 text-[#1a2744] shadow-[var(--shadow-ring)]',
                'hover:bg-white transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <XIcon className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        ) : (
          <div className="p-8">
            <ImageIcon
              className="mx-auto mb-2 h-8 w-8 text-[#4a9ad4]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="text-[14px] text-[#717182]">
              Drag &amp; drop or{' '}
              <span className="text-[14px] font-[600] text-[#4a9ad4]">browse files</span>
            </div>
            <div className="text-[12px] text-[#a3a3a3] mt-1">
              PNG, JPG, WebP · Max 5 MB · 1920×1080px recommended
            </div>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <LoadingSpinner size="md" label="Uploading cover…" />
          </div>
        )}
      </div>

      {disabled && (
        <p className="mt-2 text-[12px] text-[#717182]">
          Save the course first to enable cover image upload.
        </p>
      )}

      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-2 text-[12px] font-[600] text-[#d4183d]"
        >
          {error}
        </p>
      )}
    </div>
  )
}
