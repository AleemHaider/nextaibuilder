// PBA-146 — ScreenshotUploadZone component (Verify Setup tab)
import { useCallback, useRef, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { studentApi } from '../../../lib/api-client'
import { Button } from '../../components/ui/button'

type UploadState =
  | 'idle'
  | 'preview'
  | 'uploading'
  | 'success'
  | 'error'
  | 'wrong-file'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

interface ScreenshotUploadZoneProps {
  stepId: string
  screenshotCriteria: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ScreenshotUploadZone({ stepId, screenshotCriteria }: ScreenshotUploadZoneProps) {
  const queryClient = useQueryClient()
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  function resetUpload() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadState('idle')
    setUploadProgress(0)
    setErrorMessage(null)
    xhrRef.current = null
  }

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0]
        if (error.code === 'file-too-large') {
          setErrorMessage(
            `File must be under 10MB. Your file is ${formatBytes(rejectedFiles[0].file.size)}.`,
          )
          setUploadState('wrong-file')
        } else {
          setErrorMessage('Only PNG, JPG, and WEBP files are accepted.')
          setUploadState('wrong-file')
        }
        return
      }

      const file = acceptedFiles[0]
      if (!file) return

      const url = URL.createObjectURL(file)
      setSelectedFile(file)
      setPreviewUrl(url)
      setUploadState('preview')
      setErrorMessage(null)
    },
    [],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize: MAX_SIZE_BYTES,
    multiple: false,
    noClick: uploadState !== 'idle',
    noDrag: uploadState !== 'idle',
  })

  async function handleSubmit() {
    if (!selectedFile || !stepId) return

    setUploadState('uploading')
    setUploadProgress(0)
    setErrorMessage(null)

    try {
      // Step 1: Get presigned URL — pass actual file MIME type so S3 signature matches
      const { data: presignData, error: presignError } = await studentApi.presignUpload(stepId, selectedFile.type)
      if (presignError || !presignData) {
        setErrorMessage(presignError?.message ?? 'Failed to prepare upload.')
        setUploadState('error')
        return
      }

      const { presignedUrl, s3Key, contentType: uploadContentType } = presignData

      // Step 2: Upload directly to S3 with XHR for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`S3 upload failed: ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

        xhr.open('PUT', presignedUrl)
        // Must match the ContentType used to sign the URL
        xhr.setRequestHeader('Content-Type', uploadContentType ?? selectedFile.type)
        xhr.send(selectedFile)
      })

      // Step 3: Record submission in DB
      const { data: subData, error: subError } = await studentApi.createSubmission(stepId, s3Key)
      if (subError || !subData) {
        setErrorMessage(subError?.message ?? 'Failed to record submission.')
        setUploadState('error')
        return
      }

      // Invalidate step query so status refreshes
      await queryClient.invalidateQueries({ queryKey: ['step', stepId] })
      await queryClient.invalidateQueries({ queryKey: ['student-dashboard'] })

      setUploadState('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      if (msg === 'Upload cancelled') {
        resetUpload()
        return
      }
      setErrorMessage('Upload failed. Please check your connection and try again.')
      setUploadState('error')
    }
  }

  function handleCancel() {
    xhrRef.current?.abort()
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (uploadState === 'success') {
    return (
      <div
        data-slot="screenshot-upload-zone"
        className="flex flex-col items-center space-y-3 rounded-xl border-2 border-green-300 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-950/30"
      >
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <div>
          <p className="font-medium text-green-700 dark:text-green-400">
            Screenshot submitted! Your step is now under review.
          </p>
          <p className="mt-1 text-sm text-green-600 dark:text-green-500">
            We&apos;ll notify you when your step has been reviewed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div data-slot="screenshot-upload-zone" className="space-y-4">
      {/* Screenshot criteria reminder */}
      <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Screenshot must show: </span>
        {screenshotCriteria}
      </div>

      {/* Upload area */}
      {(uploadState === 'idle' || uploadState === 'wrong-file') && (
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
            isDragActive
              ? 'border-[#4a9ad4] bg-blue-50 dark:bg-blue-950/20'
              : 'border-border hover:border-[#4a9ad4]/50 hover:bg-accent/30',
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              {isDragActive ? 'Drop your screenshot here' : 'Drag & drop your screenshot here'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP — max 10MB</p>
        </div>
      )}

      {/* Error state */}
      {uploadState === 'wrong-file' && errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Preview state */}
      {uploadState === 'preview' && selectedFile && previewUrl && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={resetUpload}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button className="w-full" onClick={() => void handleSubmit()}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Submit Screenshot
          </Button>
        </div>
      )}

      {/* Uploading state */}
      {uploadState === 'uploading' && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading... {uploadProgress}%
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#4a9ad4] transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}

      {/* Upload error */}
      {uploadState === 'error' && (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorMessage ?? 'Upload failed. Please try again.'}
          </div>
          <Button variant="outline" onClick={resetUpload}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}

export { ScreenshotUploadZone }
