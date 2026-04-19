// FIR-34 — Shared navigation — wired to auth state
// Sprint 3 Story 14 — Wise theme migration:
//  · White/warm-white bar with subtle Wise ring border
//  · Lucide <Menu>/<X> hamburger replacing ☰/✕ unicode glyphs
//  · Wave 6 <Button> for Sign In / Get Started
//  · Mint-on-hover pill nav links
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'
import { NotificationBell } from './NotificationBell'
import { Logo } from './Logo'
import { SkipToMainLink } from './SkipToMainLink'
import { Button } from './ui/Button'

// ---------------------------------------------------------------------------
// Avatar circle — initials derived from user name
// ---------------------------------------------------------------------------
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AvatarProps {
  name: string
  avatarUrl?: string
  size?: number
}

function Avatar({ name, avatarUrl, size = 36 }: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center rounded-full flex-shrink-0',
        'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
        'font-bold text-[13px] select-none',
      )}
      style={{ width: size, height: size }}
    >
      {getInitials(name)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// User dropdown menu
// ---------------------------------------------------------------------------
interface DropdownItem {
  label: string
  to?: string
  onClick?: () => void
  danger?: boolean
}

interface UserDropdownProps {
  items: DropdownItem[]
  onClose: () => void
}

function UserDropdown({ items, onClose }: UserDropdownProps) {
  // Sprint 4 Story 18 — focus trap: cycle Tab/Shift+Tab inside the menu and
  // focus the first item when the menu mounts. ESC is handled at the parent
  // so focus can be restored to the trigger button.
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = menuRef.current
    if (!root) return
    const first = root.querySelector<HTMLElement>('[role="menuitem"]')
    first?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const root = menuRef.current
    if (!root) return
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).filter((el) => !el.hasAttribute('disabled'))
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="User menu"
      onKeyDown={handleKeyDown}
      className={cn(
        'absolute right-0 top-[calc(100%+8px)] w-48 z-50 py-1',
        'bg-white overflow-hidden',
        'rounded-[var(--radius-md)] shadow-[var(--shadow-card)]',
      )}
    >
      {items.map((item) => {
        const baseClass = cn(
          'block w-full text-left px-4 py-2.5 text-[14px] font-medium',
          'no-underline cursor-pointer transition-colors',
          'bg-transparent border-none',
          'hover:bg-[var(--color-wise-mint)]',
          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-wise-primary-text)]',
          item.danger
            ? 'text-[var(--color-wise-danger)]'
            : 'text-[var(--color-wise-text)] hover:text-[var(--color-wise-primary-text)]',
        )
        return (
          <div key={item.label} role="none">
            {item.to ? (
              <Link
                to={item.to}
                role="menuitem"
                onClick={onClose}
                className={baseClass}
              >
                {item.label}
              </Link>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => { item.onClick?.(); onClose() }}
                className={baseClass}
              >
                {item.label}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TopNav
// ---------------------------------------------------------------------------
export function TopNav() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Sprint 4 Story 18 — remember the trigger so we can restore focus when the
  // user closes the menu with ESC or by selecting an item.
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null)

  // Close mobile menu on route change / resize
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Sprint 4 Story 18 — ESC closes the dropdown and restores focus.
  useEffect(() => {
    if (!dropdownOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        dropdownTriggerRef.current?.focus()
      }
    }
    function handleClick(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [dropdownOpen])

  // Close helper: returns focus to the trigger (covers menuitem activation).
  function closeDropdown() {
    setDropdownOpen(false)
    // Defer so the newly-rendered target (route change / button) doesn't
    // steal the focus we're trying to restore in the unauth-trigger case.
    requestAnimationFrame(() => dropdownTriggerRef.current?.focus())
  }

  async function handleLogout() {
    setDropdownOpen(false)
    await logout()
    navigate('/', { replace: true })
  }

  const studentDropdownItems: DropdownItem[] = [
    { label: 'My Courses', to: '/student/dashboard' },
    { label: 'Notifications', to: '/student/notifications' },
    { label: 'Settings', to: '/student/settings' },
    { label: 'Sign Out', onClick: handleLogout, danger: false },
  ]

  const adminDropdownItems: DropdownItem[] = [
    { label: 'Admin Dashboard', to: '/admin/dashboard' },
    { label: 'Sign Out', onClick: handleLogout, danger: false },
  ]

  const isAdmin =
    isAuthenticated &&
    (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN')
  const isStudent = isAuthenticated && user?.role === 'STUDENT'

  // Pill-hover nav link style — shared between active + inactive states so
  // only the font weight / colour flips when the route matches.
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center rounded-full px-3 py-1.5 text-[15px]',
      'no-underline transition-colors',
      'hover:bg-[var(--color-wise-mint)] hover:text-[var(--color-wise-primary-text)]',
      isActive
        ? 'font-[700] text-[var(--color-wise-primary-text)] bg-[var(--color-wise-mint)]'
        : 'font-[500] text-[var(--color-wise-text)]',
    )

  return (
    <>
      {/* Sprint 4 Story 18 — skip link lives first in the tab order so */}
      {/* keyboard users can jump the TopNav on every page. */}
      <SkipToMainLink />
      <style>{`
        @media (max-width: 768px) {
          .topnav-links { display: none !important; }
          .topnav-actions { display: none !important; }
          .topnav-hamburger { display: flex !important; }
          .topnav-root { padding: 0 20px !important; }
        }
        .topnav-hamburger { display: none; }
        .topnav-mobile-menu {
          display: none;
          position: fixed;
          top: 72px;
          left: 0;
          right: 0;
          background: var(--color-wise-surface);
          box-shadow: 0 8px 24px rgba(14,15,12,0.12);
          z-index: 99;
          padding: 16px 20px 24px;
          flex-direction: column;
          gap: 4px;
          border-top: 1px solid var(--color-wise-ring);
        }
        .topnav-mobile-menu.open { display: flex; }
      `}</style>

      <nav
        aria-label="Main navigation"
        className={cn(
          'topnav-root sticky top-0 z-[100] flex items-center',
          'h-[72px] bg-white',
          'border-b border-[var(--color-wise-ring)]',
        )}
        style={{ padding: '0 80px' }}
      >
        {/* Logo */}
        <Link to="/" className="no-underline flex-shrink-0">
          <Logo size="md" variant="light" />
        </Link>

        {/* Centre nav links — hidden on mobile */}
        <ul
          className="topnav-links"
          style={{
            display: 'flex',
            gap: 8,
            margin: '0 auto',
            listStyle: 'none',
            padding: 0,
          }}
        >
          <li>
            <NavLink to="/courses" className={navLinkClass}>
              Courses
            </NavLink>
          </li>
          <li>
            <NavLink to="/courses?type=live" className={navLinkClass}>
              Live Cohorts
            </NavLink>
          </li>
          <li>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
          </li>
        </ul>

        {/* Right actions — hidden on mobile */}
        <div
          className="topnav-actions"
          style={{ display: 'flex', gap: 12, alignItems: 'center' }}
        >
          {/* Unauthenticated */}
          {!isAuthenticated && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/login')}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/login')}
              >
                Get Started
              </Button>
            </>
          )}

          {/* Admin / Super Admin */}
          {isAdmin && user && (
            <>
              <Link
                to="/admin/dashboard"
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-2',
                  'text-[14px] font-[600] no-underline transition-colors',
                  'text-[var(--color-wise-text)]',
                  'hover:bg-[var(--color-wise-mint)]',
                  'hover:text-[var(--color-wise-primary-text)]',
                )}
              >
                Admin Portal
              </Link>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  ref={dropdownTriggerRef}
                  onClick={() => setDropdownOpen((o) => !o)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  aria-label={`User menu for ${user.name}`}
                  className={cn(
                    'flex items-center gap-2 rounded-full p-1',
                    'bg-transparent border-none cursor-pointer',
                    'hover:bg-[var(--color-wise-mint)] transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-wise-primary-text)]',
                  )}
                >
                  <Avatar name={user.name} avatarUrl={user.avatarUrl} />
                </button>

                {dropdownOpen && (
                  <UserDropdown
                    items={adminDropdownItems}
                    onClose={closeDropdown}
                  />
                )}
              </div>
            </>
          )}

          {/* Student */}
          {isStudent && user && (
            <>
              <NotificationBell />

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  ref={dropdownTriggerRef}
                  onClick={() => setDropdownOpen((o) => !o)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  aria-label={`User menu for ${user.name}`}
                  className={cn(
                    'flex items-center gap-2 rounded-full py-1 px-2',
                    'bg-transparent border-none cursor-pointer',
                    'hover:bg-[var(--color-wise-mint)] transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-wise-primary-text)]',
                  )}
                >
                  <Avatar name={user.name} avatarUrl={user.avatarUrl} />
                  <span
                    className={cn(
                      'text-[14px] font-[600] text-[var(--color-wise-text)]',
                      'max-w-[120px] overflow-hidden whitespace-nowrap text-ellipsis',
                    )}
                  >
                    {user.name.split(' ')[0]}
                  </span>
                </button>

                {dropdownOpen && (
                  <UserDropdown
                    items={studentDropdownItems}
                    onClose={closeDropdown}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Hamburger — shown only on mobile */}
        <button
          type="button"
          className={cn(
            'topnav-hamburger ml-auto items-center justify-center',
            'w-9 h-9 rounded-full',
            'bg-transparent border-none cursor-pointer',
            'text-[var(--color-wise-text)]',
            'hover:bg-[var(--color-wise-mint)] hover:text-[var(--color-wise-primary-text)]',
            'transition-colors',
          )}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          {mobileMenuOpen ? (
            <X size={22} strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <Menu size={22} strokeWidth={2.25} aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      <div
        className={`topnav-mobile-menu${mobileMenuOpen ? ' open' : ''}`}
        role="menu"
      >
        <Link
          to="/courses"
          className={cn(
            'block px-4 py-3 text-[16px] font-[600] no-underline rounded-[10px] transition-colors',
            'text-[var(--color-wise-text)] hover:bg-[var(--color-wise-mint)]',
          )}
          onClick={() => setMobileMenuOpen(false)}
        >
          Courses
        </Link>
        <Link
          to="/courses?type=live"
          className={cn(
            'block px-4 py-3 text-[16px] font-[600] no-underline rounded-[10px] transition-colors',
            'text-[var(--color-wise-text)] hover:bg-[var(--color-wise-mint)]',
          )}
          onClick={() => setMobileMenuOpen(false)}
        >
          Live Cohorts
        </Link>
        <Link
          to="/about"
          className={cn(
            'block px-4 py-3 text-[16px] font-[600] no-underline rounded-[10px] transition-colors',
            'text-[var(--color-wise-text)] hover:bg-[var(--color-wise-mint)]',
          )}
          onClick={() => setMobileMenuOpen(false)}
        >
          About
        </Link>
        <div className="h-px bg-[var(--color-wise-ring)] my-2" />

        {!isAuthenticated && (
          <div className="flex flex-col gap-2 mt-1">
            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={() => {
                setMobileMenuOpen(false)
                navigate('/login')
              }}
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => {
                setMobileMenuOpen(false)
                navigate('/login')
              }}
            >
              Get Started
            </Button>
          </div>
        )}

        {isAdmin && user && (
          <>
            <Link
              to="/admin/dashboard"
              className={cn(
                'block px-4 py-3 text-[16px] font-[600] no-underline rounded-[10px] transition-colors',
                'text-[var(--color-wise-text)] hover:bg-[var(--color-wise-mint)]',
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              Admin Portal
            </Link>
            <button
              type="button"
              className={cn(
                'block w-full text-left px-4 py-3 text-[16px] font-[600] rounded-[10px]',
                'bg-transparent border-none cursor-pointer',
                'text-[var(--color-wise-danger)] hover:bg-[var(--color-wise-danger-soft)]',
              )}
              onClick={() => { setMobileMenuOpen(false); void handleLogout() }}
            >
              Sign Out
            </button>
          </>
        )}

        {isStudent && user && (
          <>
            <Link
              to="/student/dashboard"
              className={cn(
                'block px-4 py-3 text-[16px] font-[600] no-underline rounded-[10px] transition-colors',
                'text-[var(--color-wise-text)] hover:bg-[var(--color-wise-mint)]',
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              My Courses
            </Link>
            <Link
              to="/student/settings"
              className={cn(
                'block px-4 py-3 text-[16px] font-[600] no-underline rounded-[10px] transition-colors',
                'text-[var(--color-wise-text)] hover:bg-[var(--color-wise-mint)]',
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              Settings
            </Link>
            <button
              type="button"
              className={cn(
                'block w-full text-left px-4 py-3 text-[16px] font-[600] rounded-[10px]',
                'bg-transparent border-none cursor-pointer',
                'text-[var(--color-wise-danger)] hover:bg-[var(--color-wise-danger-soft)]',
              )}
              onClick={() => { setMobileMenuOpen(false); void handleLogout() }}
            >
              Sign Out
            </button>
          </>
        )}
      </div>
    </>
  )
}
