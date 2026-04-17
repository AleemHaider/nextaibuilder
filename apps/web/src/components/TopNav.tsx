// FIR-34 — Shared navigation — wired to auth state
// Matches design from 01-homepage.html, 02-catalog.html, 03-cohort-detail.html
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { NotificationBell } from './NotificationBell'
import { Logo } from './Logo'

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
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: '#4a9ad4',
        color: '#0d1a3a',
        fontWeight: 700,
        fontSize: 13,
        userSelect: 'none',
      }}
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
  return (
    <div
      role="menu"
      aria-label="User menu"
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        width: 192,
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(26,39,68,0.14), 0 0 0 1px rgba(26,39,68,0.08)',
        zIndex: 50,
        paddingTop: 4,
        paddingBottom: 4,
      }}
    >
      {items.map((item) => (
        <div key={item.label} role="none">
          {item.to ? (
            <Link
              to={item.to}
              role="menuitem"
              onClick={onClose}
              style={{
                display: 'block',
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                color: item.danger ? '#d03238' : '#1a2744',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9fb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </Link>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => { item.onClick?.(); onClose() }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: item.danger ? '#d03238' : '#1a2744',
                fontFamily: "'Inter', sans-serif",
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9fb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </button>
          )}
        </div>
      ))}
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

  // Close mobile menu on route change / resize
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  return (
    <>
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
          background: #fff;
          box-shadow: 0 8px 24px rgba(26,39,68,0.12);
          z-index: 99;
          padding: 16px 20px 24px;
          flex-direction: column;
          gap: 4px;
          border-top: 1px solid rgba(26,39,68,0.08);
        }
        .topnav-mobile-menu.open { display: flex; }
        .topnav-mobile-link {
          display: block;
          padding: 12px 16px;
          font-size: 16px;
          font-weight: 600;
          color: #1a2744;
          text-decoration: none;
          border-radius: 10px;
          transition: background 0.15s;
        }
        .topnav-mobile-link:hover { background: #f0f4f8; }
        .topnav-mobile-divider {
          height: 1px;
          background: rgba(26,39,68,0.08);
          margin: 8px 0;
        }
        .topnav-mobile-btn {
          display: block;
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          text-align: center;
          text-decoration: none;
          margin-top: 4px;
          box-sizing: border-box;
        }
      `}</style>

      <nav
        aria-label="Main navigation"
        className="topnav-root"
        style={{
          height: 72,
          background: '#fff',
          boxShadow: 'inset 0 -1px 0 rgba(26,39,68,0.12)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 80px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <Logo size="md" variant="light" />
        </Link>

        {/* Centre nav links — hidden on mobile */}
        <ul
          className="topnav-links"
          style={{
            display: 'flex',
            gap: 32,
            margin: '0 auto',
            listStyle: 'none',
            padding: 0,
          }}
        >
          <li>
            <NavLink
              to="/courses"
              style={({ isActive }) => ({
                fontSize: 16,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#4a9ad4' : '#1a2744',
                textDecoration: 'none',
              })}
            >
              Courses
            </NavLink>
          </li>
          <li>
            <Link
              to="/courses?type=live"
              style={{ fontSize: 16, fontWeight: 500, color: '#1a2744', textDecoration: 'none' }}
            >
              Live Cohorts
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              style={{ fontSize: 16, fontWeight: 500, color: '#1a2744', textDecoration: 'none' }}
            >
              About
            </Link>
          </li>
        </ul>

        {/* Right actions — hidden on mobile */}
        <div className="topnav-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Unauthenticated */}
          {!isAuthenticated && (
            <>
              <Link
                to="/login"
                style={{
                  padding: '10px 22px',
                  borderRadius: 9999,
                  background: 'transparent',
                  color: '#1a2744',
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Sign In
              </Link>
              <Link
                to="/login"
                style={{
                  padding: '10px 22px',
                  borderRadius: 9999,
                  background: '#4a9ad4',
                  color: '#0d1a3a',
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Get Started
              </Link>
            </>
          )}

          {/* Admin / Super Admin */}
          {isAdmin && user && (
            <>
              <Link
                to="/admin/dashboard"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1a2744',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  borderRadius: 9999,
                }}
              >
                Admin Portal
              </Link>

              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  aria-label={`User menu for ${user.name}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 9999,
                    padding: 4,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar name={user.name} avatarUrl={user.avatarUrl} />
                </button>

                {dropdownOpen && (
                  <UserDropdown
                    items={adminDropdownItems}
                    onClose={() => setDropdownOpen(false)}
                  />
                )}
              </div>
            </>
          )}

          {/* Student */}
          {isStudent && user && (
            <>
              <NotificationBell />

              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  aria-label={`User menu for ${user.name}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 9999,
                    padding: '4px 8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar name={user.name} avatarUrl={user.avatarUrl} />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a2744',
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.name.split(' ')[0]}
                  </span>
                </button>

                {dropdownOpen && (
                  <UserDropdown
                    items={studentDropdownItems}
                    onClose={() => setDropdownOpen(false)}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Hamburger — shown only on mobile */}
        <button
          type="button"
          className="topnav-hamburger"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((o) => !o)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 24,
            color: '#1a2744',
            padding: '4px 8px',
            lineHeight: 1,
          }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      <div className={`topnav-mobile-menu${mobileMenuOpen ? ' open' : ''}`} role="menu">
        <Link to="/courses" className="topnav-mobile-link" onClick={() => setMobileMenuOpen(false)}>Courses</Link>
        <Link to="/courses?type=live" className="topnav-mobile-link" onClick={() => setMobileMenuOpen(false)}>Live Cohorts</Link>
        <Link to="/about" className="topnav-mobile-link" onClick={() => setMobileMenuOpen(false)}>About</Link>
        <div className="topnav-mobile-divider" />

        {!isAuthenticated && (
          <>
            <Link
              to="/login"
              className="topnav-mobile-btn"
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: 'transparent', color: '#1a2744', border: '1.5px solid rgba(26,39,68,0.15)' }}
            >
              Sign In
            </Link>
            <Link
              to="/login"
              className="topnav-mobile-btn"
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: '#4a9ad4', color: '#0d1a3a', border: 'none' }}
            >
              Get Started
            </Link>
          </>
        )}

        {isAdmin && user && (
          <>
            <Link to="/admin/dashboard" className="topnav-mobile-link" onClick={() => setMobileMenuOpen(false)}>Admin Portal</Link>
            <button
              type="button"
              className="topnav-mobile-link"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif", width: '100%', color: '#d03238', fontWeight: 600 }}
              onClick={() => { setMobileMenuOpen(false); void handleLogout() }}
            >
              Sign Out
            </button>
          </>
        )}

        {isStudent && user && (
          <>
            <Link to="/student/dashboard" className="topnav-mobile-link" onClick={() => setMobileMenuOpen(false)}>My Courses</Link>
            <Link to="/student/settings" className="topnav-mobile-link" onClick={() => setMobileMenuOpen(false)}>Settings</Link>
            <button
              type="button"
              className="topnav-mobile-link"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif", width: '100%', color: '#d03238', fontWeight: 600 }}
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
