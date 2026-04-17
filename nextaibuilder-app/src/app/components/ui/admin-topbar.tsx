// Admin topbar — wired to real auth user, real logout action
import { useNavigate } from 'react-router'
import { Bell, LogOut, Search, Settings } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Button } from './button'
import { Input } from './input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { logout } from '@/store/auth'
import { cn } from '@/lib/utils'

interface AdminTopbarProps {
  /** Page title displayed on the left. If omitted, space collapses. */
  title?: string
  showSearch?: boolean
  /** Override notification count (future: wired to real data) */
  notificationCount?: number
  className?: string
}

function AdminTopbar({
  title,
  showSearch = true,
  notificationCount = 0,
  className,
}: AdminTopbarProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const userFullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : 'Admin'
  const userInitials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : 'AD'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header
      data-slot="admin-topbar"
      className={cn(
        'h-16 flex items-center gap-4 px-6 border-b border-border bg-background shrink-0',
        className
      )}
    >
      {/* Page title */}
      {title ? (
        <h1 className="text-base font-medium text-foreground mr-auto leading-tight">{title}</h1>
      ) : (
        <div className="mr-auto" />
      )}

      {/* Search */}
      {showSearch && (
        <div className="relative max-w-xs w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            placeholder="Search students, cohorts…"
            className="pl-9 h-9 bg-input-background border-transparent focus-visible:border-ring"
            aria-label="Search admin"
          />
        </div>
      )}

      {/* Notification bell */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        </Button>
        {notificationCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-brand-orange text-white text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
          >
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </div>

      {/* User avatar + dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1"
            aria-label="User menu"
          >
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src={user?.avatarUrl ?? undefined} alt={userFullName} />
              <AvatarFallback className="bg-brand-navy text-white text-xs font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{userFullName}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => navigate('/admin/settings')}
            className="cursor-pointer"
          >
            <Settings aria-hidden="true" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
          >
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

export { AdminTopbar }
