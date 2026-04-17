import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-34 — Shared navigation — wired to auth state
// Matches design from 01-homepage.html, 02-catalog.html, 03-cohort-detail.html
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { Logo } from './Logo';
// ---------------------------------------------------------------------------
// Avatar circle — initials derived from user name
// ---------------------------------------------------------------------------
function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function Avatar({ name, avatarUrl, size = 36 }) {
    const [imgError, setImgError] = useState(false);
    if (avatarUrl && !imgError) {
        return (_jsx("img", { src: avatarUrl, alt: name, width: size, height: size, onError: () => setImgError(true), style: { width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 } }));
    }
    return (_jsx("div", { "aria-hidden": "true", style: {
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
        }, children: getInitials(name) }));
}
function UserDropdown({ items, onClose }) {
    return (_jsx("div", { role: "menu", "aria-label": "User menu", style: {
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
        }, children: items.map((item) => (_jsx("div", { role: "none", children: item.to ? (_jsx(Link, { to: item.to, role: "menuitem", onClick: onClose, style: {
                    display: 'block',
                    padding: '10px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: 'none',
                    color: item.danger ? '#d03238' : '#1a2744',
                    transition: 'background 0.15s',
                }, onMouseEnter: (e) => (e.currentTarget.style.background = '#f8f9fb'), onMouseLeave: (e) => (e.currentTarget.style.background = 'transparent'), children: item.label })) : (_jsx("button", { type: "button", role: "menuitem", onClick: () => { item.onClick?.(); onClose(); }, style: {
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
                }, onMouseEnter: (e) => (e.currentTarget.style.background = '#f8f9fb'), onMouseLeave: (e) => (e.currentTarget.style.background = 'transparent'), children: item.label })) }, item.label))) }));
}
// ---------------------------------------------------------------------------
// TopNav
// ---------------------------------------------------------------------------
export function TopNav() {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const dropdownRef = useRef(null);
    // Close mobile menu on route change / resize
    useEffect(() => {
        function handleResize() {
            if (window.innerWidth > 768)
                setMobileMenuOpen(false);
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    async function handleLogout() {
        setDropdownOpen(false);
        await logout();
        navigate('/', { replace: true });
    }
    const studentDropdownItems = [
        { label: 'My Courses', to: '/student/dashboard' },
        { label: 'Notifications', to: '/student/notifications' },
        { label: 'Settings', to: '/student/settings' },
        { label: 'Sign Out', onClick: handleLogout, danger: false },
    ];
    const adminDropdownItems = [
        { label: 'Admin Dashboard', to: '/admin/dashboard' },
        { label: 'Sign Out', onClick: handleLogout, danger: false },
    ];
    const isAdmin = isAuthenticated &&
        (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN');
    const isStudent = isAuthenticated && user?.role === 'STUDENT';
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: `
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
      ` }), _jsxs("nav", { "aria-label": "Main navigation", className: "topnav-root", style: {
                    height: 72,
                    background: '#fff',
                    boxShadow: 'inset 0 -1px 0 rgba(26,39,68,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 80px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                }, children: [_jsx(Link, { to: "/", style: { textDecoration: 'none', flexShrink: 0 }, children: _jsx(Logo, { size: "md", variant: "light" }) }), _jsxs("ul", { className: "topnav-links", style: {
                            display: 'flex',
                            gap: 32,
                            margin: '0 auto',
                            listStyle: 'none',
                            padding: 0,
                        }, children: [_jsx("li", { children: _jsx(NavLink, { to: "/courses", style: ({ isActive }) => ({
                                        fontSize: 16,
                                        fontWeight: isActive ? 700 : 500,
                                        color: isActive ? '#4a9ad4' : '#1a2744',
                                        textDecoration: 'none',
                                    }), children: "Courses" }) }), _jsx("li", { children: _jsx(Link, { to: "/courses?type=live", style: { fontSize: 16, fontWeight: 500, color: '#1a2744', textDecoration: 'none' }, children: "Live Cohorts" }) }), _jsx("li", { children: _jsx(Link, { to: "/about", style: { fontSize: 16, fontWeight: 500, color: '#1a2744', textDecoration: 'none' }, children: "About" }) })] }), _jsxs("div", { className: "topnav-actions", style: { display: 'flex', gap: 12, alignItems: 'center' }, children: [!isAuthenticated && (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/login", style: {
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
                                        }, children: "Sign In" }), _jsx(Link, { to: "/login", style: {
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
                                        }, children: "Get Started" })] })), isAdmin && user && (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/admin/dashboard", style: {
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: '#1a2744',
                                            textDecoration: 'none',
                                            padding: '8px 16px',
                                            borderRadius: 9999,
                                        }, children: "Admin Portal" }), _jsxs("div", { style: { position: 'relative' }, ref: dropdownRef, children: [_jsx("button", { type: "button", onClick: () => setDropdownOpen((o) => !o), "aria-expanded": dropdownOpen, "aria-haspopup": "menu", "aria-label": `User menu for ${user.name}`, style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    borderRadius: 9999,
                                                    padding: 4,
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }, children: _jsx(Avatar, { name: user.name, avatarUrl: user.avatarUrl }) }), dropdownOpen && (_jsx(UserDropdown, { items: adminDropdownItems, onClose: () => setDropdownOpen(false) }))] })] })), isStudent && user && (_jsxs(_Fragment, { children: [_jsx(NotificationBell, {}), _jsxs("div", { style: { position: 'relative' }, ref: dropdownRef, children: [_jsxs("button", { type: "button", onClick: () => setDropdownOpen((o) => !o), "aria-expanded": dropdownOpen, "aria-haspopup": "menu", "aria-label": `User menu for ${user.name}`, style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    borderRadius: 9999,
                                                    padding: '4px 8px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }, children: [_jsx(Avatar, { name: user.name, avatarUrl: user.avatarUrl }), _jsx("span", { style: {
                                                            fontSize: 14,
                                                            fontWeight: 600,
                                                            color: '#1a2744',
                                                            maxWidth: 120,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }, children: user.name.split(' ')[0] })] }), dropdownOpen && (_jsx(UserDropdown, { items: studentDropdownItems, onClose: () => setDropdownOpen(false) }))] })] }))] }), _jsx("button", { type: "button", className: "topnav-hamburger", "aria-label": mobileMenuOpen ? 'Close menu' : 'Open menu', "aria-expanded": mobileMenuOpen, onClick: () => setMobileMenuOpen((o) => !o), style: {
                            marginLeft: 'auto',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 24,
                            color: '#1a2744',
                            padding: '4px 8px',
                            lineHeight: 1,
                        }, children: mobileMenuOpen ? '✕' : '☰' })] }), _jsxs("div", { className: `topnav-mobile-menu${mobileMenuOpen ? ' open' : ''}`, role: "menu", children: [_jsx(Link, { to: "/courses", className: "topnav-mobile-link", onClick: () => setMobileMenuOpen(false), children: "Courses" }), _jsx(Link, { to: "/courses?type=live", className: "topnav-mobile-link", onClick: () => setMobileMenuOpen(false), children: "Live Cohorts" }), _jsx(Link, { to: "/about", className: "topnav-mobile-link", onClick: () => setMobileMenuOpen(false), children: "About" }), _jsx("div", { className: "topnav-mobile-divider" }), !isAuthenticated && (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/login", className: "topnav-mobile-btn", onClick: () => setMobileMenuOpen(false), style: { background: 'transparent', color: '#1a2744', border: '1.5px solid rgba(26,39,68,0.15)' }, children: "Sign In" }), _jsx(Link, { to: "/login", className: "topnav-mobile-btn", onClick: () => setMobileMenuOpen(false), style: { background: '#4a9ad4', color: '#0d1a3a', border: 'none' }, children: "Get Started" })] })), isAdmin && user && (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/admin/dashboard", className: "topnav-mobile-link", onClick: () => setMobileMenuOpen(false), children: "Admin Portal" }), _jsx("button", { type: "button", className: "topnav-mobile-link", style: { background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif", width: '100%', color: '#d03238', fontWeight: 600 }, onClick: () => { setMobileMenuOpen(false); void handleLogout(); }, children: "Sign Out" })] })), isStudent && user && (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/student/dashboard", className: "topnav-mobile-link", onClick: () => setMobileMenuOpen(false), children: "My Courses" }), _jsx(Link, { to: "/student/settings", className: "topnav-mobile-link", onClick: () => setMobileMenuOpen(false), children: "Settings" }), _jsx("button", { type: "button", className: "topnav-mobile-link", style: { background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif", width: '100%', color: '#d03238', fontWeight: 600 }, onClick: () => { setMobileMenuOpen(false); void handleLogout(); }, children: "Sign Out" })] }))] })] }));
}
