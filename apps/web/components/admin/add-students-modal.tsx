'use client'

// PBA-365/366 — AddStudentsModal: multi-email batch invite + CSV bulk import
// Usable from AdminStudentsPage (with cohort selector) and AdminCohortRosterPage (cohortId pre-filled)
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, FileText, CheckCircle, AlertCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  useBatchInviteStudents,
  useCsvImportStudents,
} from '@/hooks/use-admin-students'
import { useAdminCohorts } from '@/hooks/use-admin-cohorts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailChip {
  id: string
  value: string
  valid: boolean
}

interface CsvRow {
  firstName: string
  lastName: string
  email: string
  valid: boolean
  errors: string[]
}

export interface AddStudentsModalProps {
  open: boolean
  onClose: () => void
  /** When provided, cohortId is pre-filled and the selector is hidden */
  cohortId?: string
  cohortName?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

function uid(): string {
  return Math.random().toString(36).slice(2)
}

function parseCsvLine(line: string): string[] {
  // Simple CSV split — handles quoted fields
  const result: string[] = []
  let current = ''
  let inQuote = false
  for (const char of line) {
    if (char === '"') {
      inQuote = !inQuote
    } else if (char === ',' && !inQuote) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseCsvFile(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []

  // Auto-detect header row — skip if first cell looks like a label
  const firstLine = parseCsvLine(lines[0])
  const hasHeader =
    firstLine.some((cell) =>
      /^(first|last|email|name)/i.test(cell.trim())
    )
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines
    .filter((l) => l.trim())
    .map((line) => {
      const cols = parseCsvLine(line)
      const firstName = cols[0] ?? ''
      const lastName = cols[1] ?? ''
      const email = cols[2] ?? ''
      const errors: string[] = []
      if (!firstName.trim()) errors.push('Missing first name')
      if (!lastName.trim()) errors.push('Missing last name')
      if (!email.trim()) errors.push('Missing email')
      else if (!isValidEmail(email)) errors.push('Invalid email')
      return {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        valid: errors.length === 0,
        errors,
      }
    })
}

// ── Email chip component ───────────────────────────────────────────────────────

interface EmailChipProps {
  chip: EmailChip
  onRemove: (id: string) => void
}

function EmailChipItem({ chip, onRemove }: EmailChipProps) {
  return (
    <span
      data-slot="email-chip"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium max-w-full',
        chip.valid
          ? 'bg-primary/8 text-foreground border border-border'
          : 'bg-destructive/6 text-destructive border border-destructive/25',
      )}
      title={chip.valid ? undefined : 'Invalid email address'}
    >
      <span className="truncate max-w-[200px]">{chip.value}</span>
      <button
        type="button"
        onClick={() => onRemove(chip.id)}
        className="shrink-0 rounded hover:bg-black/10 p-0.5 -mr-0.5"
        aria-label={`Remove ${chip.value}`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  )
}

// ── Tab 1: Invite by Email ─────────────────────────────────────────────────────

interface InviteByEmailTabProps {
  cohortId: string
  setCohortId: (id: string) => void
  showCohortSelector: boolean
}

function InviteByEmailTab({ cohortId, setCohortId, showCohortSelector }: InviteByEmailTabProps) {
  const { data: cohorts } = useAdminCohorts()
  const batchInvite = useBatchInviteStudents()

  const [inputValue, setInputValue] = React.useState('')
  const [chips, setChips] = React.useState<EmailChip[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  function addChip(raw: string) {
    const values = raw.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean)
    if (values.length === 0) return
    const newChips: EmailChip[] = values.map((v) => ({
      id: uid(),
      value: v,
      valid: isValidEmail(v),
    }))
    setChips((prev) => {
      const existing = new Set(prev.map((c) => c.value.toLowerCase()))
      return [...prev, ...newChips.filter((c) => !existing.has(c.value.toLowerCase()))]
    })
    setInputValue('')
  }

  function removeChip(id: string) {
    setChips((prev) => prev.filter((c) => c.id !== id))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addChip(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
      setChips((prev) => prev.slice(0, -1))
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (text.includes('\n') || text.includes(',') || text.includes(';')) {
      e.preventDefault()
      addChip(text)
    }
  }

  const validChips = chips.filter((c) => c.valid)
  const invalidChips = chips.filter((c) => !c.valid)
  const canSubmit = validChips.length > 0 && invalidChips.length === 0 && Boolean(cohortId)

  async function handleSubmit() {
    if (!canSubmit) return
    try {
      const result = await batchInvite.mutateAsync({
        emails: validChips.map((c) => c.value.toLowerCase()),
        cohortId,
      })
      const alreadyExist = result.skipped - (result.errors?.length ?? 0)
      const failed = result.errors?.length ?? 0
      const parts = [`${result.invited} student${result.invited !== 1 ? 's' : ''} invited`]
      if (alreadyExist > 0) parts.push(`${alreadyExist} skipped (already exist)`)
      if (failed > 0) parts.push(`${failed} failed`)
      toast.success(parts.join(', '))
      setChips([])
      setInputValue('')
    } catch (err) {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to send invites. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      {showCohortSelector && (
        <div className="space-y-1.5">
          <Label htmlFor="batch-cohort">Cohort</Label>
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger id="batch-cohort">
              <SelectValue placeholder="Select a cohort" />
            </SelectTrigger>
            <SelectContent>
              {cohorts?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email-input">Email addresses</Label>
        <p className="text-xs text-muted-foreground">
          Type an email and press Enter or comma to add. Paste multiple addresses at once.
        </p>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            id="email-input"
            type="email"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="student@example.com"
            className="flex-1"
            aria-label="Add email address"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => addChip(inputValue)}
            disabled={!inputValue.trim()}
            aria-label="Add email chip"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {chips.length} email{chips.length !== 1 ? 's' : ''}
              {invalidChips.length > 0 && (
                <span className="text-destructive ml-1">
                  ({invalidChips.length} invalid)
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setChips([])}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
          <div
            className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-border bg-muted/30 min-h-[60px] max-h-[160px] overflow-y-auto cursor-text"
            onClick={() => inputRef.current?.focus()}
            role="group"
            aria-label="Email list"
          >
            {chips.map((chip) => (
              <EmailChipItem key={chip.id} chip={chip} onRemove={removeChip} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {validChips.length > 0
            ? `${validChips.length} valid email${validChips.length !== 1 ? 's' : ''} ready to send`
            : 'Add at least one email address'}
        </p>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || batchInvite.isPending}
        >
          {batchInvite.isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              Sending…
            </>
          ) : (
            `Send Invite${validChips.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Tab 2: Bulk CSV Import ─────────────────────────────────────────────────────

interface BulkCsvTabProps {
  cohortId: string
  setCohortId: (id: string) => void
  showCohortSelector: boolean
}

const PREVIEW_LIMIT = 5

function BulkCsvTab({ cohortId, setCohortId, showCohortSelector }: BulkCsvTabProps) {
  const { data: cohorts } = useAdminCohorts()
  const csvImport = useCsvImportStudents()

  const [file, setFile] = React.useState<File | null>(null)
  const [rows, setRows] = React.useState<CsvRow[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)

  function handleFile(f: File) {
    setFile(f)
    setParseError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      try {
        const parsed = parseCsvFile(text)
        if (parsed.length === 0) {
          setParseError('No data rows found. Check your CSV has firstName, lastName, email columns.')
          setRows([])
        } else {
          setRows(parsed)
        }
      } catch {
        setParseError('Failed to parse CSV. Ensure it is a valid .csv file.')
        setRows([])
      }
    }
    reader.readAsText(f)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
    onDropAccepted: ([f]) => { if (f) handleFile(f) },
    onDropRejected: () => setParseError('Only .csv files are accepted.'),
  })

  const validRows = rows.filter((r) => r.valid)
  const invalidRows = rows.filter((r) => !r.valid)
  const canSubmit = validRows.length > 0 && Boolean(cohortId) && !csvImport.isPending

  async function handleImport() {
    if (!file || !canSubmit) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('cohortId', cohortId)
    try {
      const result = await csvImport.mutateAsync(fd)
      toast.success(
        `${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`
      )
      setFile(null)
      setRows([])
    } catch (err) {
      const e = err as { message?: string }
      toast.error(e.message ?? 'CSV import failed. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      {showCohortSelector && (
        <div className="space-y-1.5">
          <Label htmlFor="csv-cohort">Cohort</Label>
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger id="csv-cohort">
              <SelectValue placeholder="Select a cohort" />
            </SelectTrigger>
            <SelectContent>
              {cohorts?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>CSV File</Label>
        <p className="text-xs text-muted-foreground">
          Expected columns: <code className="bg-muted px-1 rounded text-xs">firstName, lastName, email</code>
        </p>
        <div
          {...getRootProps()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary/60 bg-primary/4'
              : 'border-border bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/40',
          )}
          aria-label="CSV file upload dropzone"
        >
          <input {...getInputProps()} />
          {file ? (
            <>
              <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary/70" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rows.length} rows detected
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setFile(null); setRows([]) }}
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            </>
          ) : (
            <>
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? 'Drop your CSV here' : 'Drag & drop a CSV file'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  or click to browse — .csv only
                </p>
              </div>
            </>
          )}
        </div>
        {parseError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {parseError}
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground flex-1">
              Preview (first {Math.min(rows.length, PREVIEW_LIMIT)} of {rows.length} rows)
            </p>
            {invalidRows.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {invalidRows.length} error{invalidRows.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {validRows.length > 0 && (
              <Badge variant="success" className="text-xs">
                {validRows.length} valid
              </Badge>
            )}
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full" aria-label="CSV preview">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-2 pl-3 pr-2 text-left text-xs font-medium text-muted-foreground">First Name</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-muted-foreground">Last Name</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                  <th className="py-2 pl-2 pr-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map((row, i) => (
                  <tr
                    key={i}
                    className={cn(
                      'border-b border-border last:border-0',
                      !row.valid && 'bg-destructive/[0.03]',
                    )}
                  >
                    <td className={cn('py-2 pl-3 pr-2 text-xs', !row.valid && !row.firstName && 'text-destructive')}>
                      {row.firstName || <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className={cn('py-2 px-2 text-xs', !row.valid && !row.lastName && 'text-destructive')}>
                      {row.lastName || <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className={cn('py-2 px-2 text-xs font-mono', !row.valid && !isValidEmail(row.email) && 'text-destructive')}>
                      {row.email || <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className="py-2 pl-2 pr-3">
                      {row.valid ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" aria-label="Valid" />
                      ) : (
                        <span title={row.errors.join(', ')}>
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-label={row.errors.join(', ')} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {validRows.length > 0
            ? `${validRows.length} student${validRows.length !== 1 ? 's' : ''} will be imported`
            : 'Upload a CSV to preview'}
        </p>
        <Button
          type="button"
          onClick={handleImport}
          disabled={!canSubmit}
        >
          {csvImport.isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              Importing…
            </>
          ) : (
            `Import ${validRows.length > 0 ? validRows.length : ''} Student${validRows.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

function AddStudentsModal({ open, onClose, cohortId: fixedCohortId, cohortName }: AddStudentsModalProps) {
  const [tab, setTab] = React.useState('email')
  const [cohortId, setCohortId] = React.useState(fixedCohortId ?? '')

  // Sync if parent changes the fixed cohortId
  React.useEffect(() => {
    if (fixedCohortId) setCohortId(fixedCohortId)
  }, [fixedCohortId])

  function handleClose() {
    setTab('email')
    if (!fixedCohortId) setCohortId('')
    onClose()
  }

  const showCohortSelector = !fixedCohortId

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg" data-slot="add-students-modal">
        <DialogHeader>
          <DialogTitle>
            Add Students
            {cohortName && (
              <span className="text-muted-foreground font-normal ml-1.5">— {cohortName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="email" className="flex-1">Invite by Email</TabsTrigger>
            <TabsTrigger value="csv" className="flex-1">Bulk Import (CSV)</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-4">
            <InviteByEmailTab
              cohortId={cohortId}
              setCohortId={setCohortId}
              showCohortSelector={showCohortSelector}
            />
          </TabsContent>

          <TabsContent value="csv" className="mt-4">
            <BulkCsvTab
              cohortId={cohortId}
              setCohortId={setCohortId}
              showCohortSelector={showCohortSelector}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export { AddStudentsModal }
