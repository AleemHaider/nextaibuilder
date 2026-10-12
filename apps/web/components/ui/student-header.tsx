'use client'

// PBA-291 — Dark navy global header: cohort badge, Get Help link, gradient avatar
// PBA-383 — Notification bell dropdown wired to student notifications API
import { differenceInDays, isPast } from 'date-fns'
import Link from 'next/link'
import { Award, GraduationCap, HelpCircle, LogOut, Trophy } from 'lucide-react'
import { logout } from '@/store/auth'
import { Logo } from './logo'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { NotificationDropdown } from './notification-dropdown'
import { cn } from '@/lib/utils'

interface StudentHeaderProps {
  userName?: string
  userAvatar?: string
  userInitials?: string
  /** Cohort display name, e.g. "Cohort 12 — Spring 2026" */
  cohortName?: string
  /** ISO date string for cohort start */
  cohortStartDate?: string
  /** ISO date string for cohort deadline/end */
  cohortDeadline?: string
  className?: string
}

/** Derives the orange badge text shown beside the cohort name. */
function getCohortBadgeText(startDate?: string, deadline?: string): string | null {
  if (!startDate && !deadline) return null

  const now = new Date()

  // If cohort hasn't started yet, show "Cohort starts in N days"
  if (startDate) {
    const start = new Date(startDate)
    if (!isPast(start)) {
      const days = differenceInDays(start, now)
      return `Cohort starts in ${days} day${days !== 1 ? 's' : ''}`
    }
  }

  // Cohort has started — show "Ends in N days" until deadline passes
  if (deadline) {
    const end = new Date(deadline)
    if (!isPast(end)) {
      const days = differenceInDays(end, now)
      return `Ends in ${days} day${days !== 1 ? 's' : ''}`
    }
  }

  return null
}

function StudentHeader({
  userName = 'Student',
  userAvatar,
  userInitials = 'ST',
  cohortName,
  cohortStartDate,
  cohortDeadline,
  className,
}: StudentHeaderProps) {
  const badgeText = getCohortBadgeText(cohortStartDate, cohortDeadline)

  return (
    <header
      data-slot="student-header"
      className={cn(
        'h-14 flex items-center justify-between px-4 border-b border-white/10',
        'bg-[#1a2744] text-white shrink-0',
        className
      )}
    >
      {/* ── Left: Logo ── */}
      <Link
 href="/dashboard"
        className="flex items-center gap-2.5 hover:opacity-90 transition-opacity shrink-0"
      >
        <Logo variant="full" size="sm" onDark />
      </Link>

      {/* ── Centre-left: Cohort name + countdown badge ── */}
      {(cohortName || badgeText) && (
        <div className="hidden sm:flex items-center gap-3 ml-4 flex-1 min-w-0">
          {cohortName && (
            <>
              <div className="h-4 w-px bg-white/20 shrink-0" />
              <span className="text-[14px] font-medium text-white/90 truncate">
                {cohortName}
              </span>
            </>
          )}
          {badgeText && (
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-white/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-[#ff8c5a] shrink-0" />
              <span className="text-[13px] text-white/90 font-medium whitespace-nowrap">
                {badgeText}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Right: Get Help + notification bell + avatar ── */}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        {/* My Courses link */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex items-center gap-1.5 text-[14px] text-white/80 hover:text-white hover:bg-white/10 px-2"
          asChild
        >
          <Link href="/courses">
            <GraduationCap className="h-4 w-4" />
            My Courses
          </Link>
        </Button>

        {/* Get Help text link */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex items-center gap-1.5 text-[14px] text-white/80 hover:text-white hover:bg-white/10 px-2"
          asChild
        >
          <Link href="/help">
            <HelpCircle className="h-4 w-4" />
            Get Help
          </Link>
        </Button>

        {/* Notification bell */}
        <NotificationDropdown />

        {/* Avatar / user menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Avatar className="h-6 w-6 cursor-pointer ring-1 ring-white/30 hover:ring-white/60 transition-all">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback
                  className="text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #4a90c4, #ff8c5a)' }}
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-medium text-sm normal-case tracking-normal">
              {userName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">Profile &amp; Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/courses" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                My Courses
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/student/badges" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                My Badges
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/student/certificate" className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                My Certificate
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/help">Help &amp; Support</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => { void logout() }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export { StudentHeader }
