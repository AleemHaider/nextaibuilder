import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-173 — Admin sub-admin management: invite, view permissions, edit, deactivate
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { fetchSubAdmins, inviteSubAdmin, updateSubAdminPermissions, deactivateSubAdmin, } from '../../lib/api';
import { cn } from '../../lib/utils';
const PERMISSION_GROUPS = [
    {
        label: 'Courses',
        icon: '📚',
        permissions: [
            { key: 'courses:read', label: 'View courses' },
            { key: 'courses:write', label: 'Create & edit courses' },
        ],
    },
    {
        label: 'Enrollments',
        icon: '👥',
        permissions: [
            { key: 'enrollments:read', label: 'View enrollments' },
            { key: 'enrollments:write', label: 'Manage enrollments' },
        ],
    },
    {
        label: 'Payments',
        icon: '💳',
        permissions: [
            { key: 'payments:read', label: 'View payments' },
            { key: 'payments:write', label: 'Process payments' },
        ],
    },
    {
        label: 'Students',
        icon: '🎓',
        permissions: [
            { key: 'students:read', label: 'View students' },
            { key: 'students:write', label: 'Manage students' },
        ],
    },
    {
        label: 'Submissions',
        icon: '📸',
        permissions: [
            { key: 'submissions:read', label: 'View submissions' },
            { key: 'submissions:write', label: 'Review submissions' },
        ],
    },
    {
        label: 'Messages',
        icon: '💬',
        permissions: [
            { key: 'messages:read', label: 'View messages' },
            { key: 'messages:write', label: 'Send messages' },
        ],
    },
    {
        label: 'Reports',
        icon: '📊',
        permissions: [{ key: 'reports:read', label: 'View reports & revenue' }],
    },
    {
        label: 'Settings',
        icon: '⚙️',
        permissions: [
            { key: 'settings:read', label: 'View settings' },
            { key: 'settings:write', label: 'Change settings' },
        ],
    },
];
// ---------------------------------------------------------------------------
// Permission presets
// ---------------------------------------------------------------------------
const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
const PRESETS = {
    'Full Access': ALL_PERMISSIONS,
    'Read Only': ALL_PERMISSIONS.filter((p) => p.endsWith(':read')),
    'Course Manager': [
        'courses:read',
        'courses:write',
        'enrollments:read',
        'students:read',
        'submissions:read',
        'submissions:write',
    ],
    'Enrollment Manager': [
        'enrollments:read',
        'enrollments:write',
        'students:read',
        'students:write',
        'payments:read',
    ],
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #4a9ad4, #1a2744)',
    'linear-gradient(135deg, #cc4a00, #ff8c5a)',
    'linear-gradient(135deg, #054d28, #16a34a)',
    'linear-gradient(135deg, #7c3aed, #4a9ad4)',
    'linear-gradient(135deg, #8a3a00, #cc6600)',
];
function getAvatarGradient(name) {
    return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}
function formatRelativeTime(iso) {
    if (!iso)
        return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 2)
        return 'Just now';
    if (minutes < 60)
        return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1)
        return 'Yesterday';
    return `${days} days ago`;
}
function Toast({ toast, onDismiss }) {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 3500);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);
    return (_jsxs("div", { role: "status", "aria-live": "polite", className: cn('flex items-center gap-3 px-5 py-3.5 rounded-[14px] shadow-[rgba(26,39,68,0.2)_0_4px_20px]', 'text-[14px] font-semibold', toast.variant === 'success'
            ? 'bg-[#e6f4ec] text-[#054d28] border border-[rgba(5,77,40,0.15)]'
            : 'bg-[#fdeaeb] text-[#d03238] border border-[rgba(208,50,56,0.15)]'), children: [_jsx("span", { "aria-hidden": "true", children: toast.variant === 'success' ? '✓' : '✗' }), toast.message] }));
}
function useToast() {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, variant) => {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, variant }]);
    }, []);
    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    return { toasts, addToast, dismissToast };
}
function PermissionSelector({ selected, onChange }) {
    const [expandedGroups, setExpandedGroups] = useState(new Set(['Courses']));
    const selectedSet = new Set(selected);
    function togglePermission(key) {
        const next = new Set(selectedSet);
        if (next.has(key)) {
            next.delete(key);
        }
        else {
            next.add(key);
        }
        onChange(Array.from(next));
    }
    function toggleGroup(label) {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(label))
                next.delete(label);
            else
                next.add(label);
            return next;
        });
    }
    function applyPreset(presetName) {
        onChange(PRESETS[presetName] ?? []);
    }
    return (_jsxs("div", { children: [_jsx("div", { className: "flex flex-wrap gap-2 mb-4", children: Object.keys(PRESETS).map((preset) => {
                    const isActive = JSON.stringify([...PRESETS[preset]].sort()) ===
                        JSON.stringify([...selected].sort());
                    return (_jsx("button", { type: "button", onClick: () => applyPreset(preset), className: cn('px-4 py-2 rounded-full border-[1.5px] text-[13px] font-[600] transition-colors', isActive
                            ? 'border-[#4a9ad4] bg-[#eef6fd] text-[#4a9ad4]'
                            : 'border-[rgba(26,39,68,0.15)] text-[#717182] hover:border-[#4a9ad4] hover:text-[#4a9ad4]'), children: preset }, preset));
                }) }), _jsx("div", { className: "flex flex-col gap-2.5", children: PERMISSION_GROUPS.map((group) => {
                    const isExpanded = expandedGroups.has(group.label);
                    return (_jsxs("div", { className: "border border-[rgba(26,39,68,0.1)] rounded-[14px] overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleGroup(group.label), "aria-expanded": isExpanded, className: "flex items-center justify-between w-full px-4 py-3 bg-[#f8f9fb] hover:bg-[#f0f4f8] transition-colors text-left", children: [_jsxs("span", { className: "text-[14px] font-[700] text-[#1a2744]", children: [group.icon, " ", group.label] }), isExpanded ? (_jsx(ChevronUp, { size: 14, className: "text-[#a3a3a3]" })) : (_jsx(ChevronDown, { size: 14, className: "text-[#a3a3a3]" }))] }), isExpanded && (_jsx("div", { className: "px-4 pb-1", children: group.permissions.map((perm) => (_jsxs("label", { className: "flex items-center gap-2.5 py-2.5 border-b border-[rgba(26,39,68,0.04)] last:border-b-0 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: selectedSet.has(perm.key), onChange: () => togglePermission(perm.key), className: "w-[18px] h-[18px] rounded-[5px] accent-[#4a9ad4]" }), _jsx("span", { className: "text-[13px] font-[500] text-[#717182]", children: perm.label })] }, perm.key))) }))] }, group.label));
                }) })] }));
}
function InvitePanel({ onClose, onSuccess }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [permissions, setPermissions] = useState(PRESETS['Course Manager']);
    const { toasts, addToast, dismissToast } = useToast();
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const inviteMutation = useMutation({
        mutationFn: () => inviteSubAdmin({ email, name, permissions }),
        onSuccess: () => {
            onSuccess();
        },
        onError: (err) => {
            addToast(err instanceof Error ? err.message : 'Failed to send invite', 'error');
        },
    });
    const isValid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return (_jsxs("div", { className: "fixed inset-0 z-40 flex items-start justify-end", role: "dialog", "aria-modal": "true", "aria-label": "Invite team member", children: [_jsx("div", { className: "fixed inset-0 bg-[rgba(13,26,58,0.4)]", "aria-hidden": "true", onClick: onClose }), _jsxs("aside", { className: "relative z-50 w-full max-w-[560px] h-full bg-white shadow-[-8px_0_40px_rgba(26,39,68,0.15)] overflow-y-auto", children: [_jsx("div", { className: "fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none w-[420px]", children: toasts.map((t) => (_jsx("div", { className: "pointer-events-auto", children: _jsx(Toast, { toast: t, onDismiss: dismissToast }) }, t.id))) }), _jsxs("div", { className: "flex items-center justify-between px-7 py-6 border-b border-[rgba(26,39,68,0.08)]", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-[20px] font-[800] text-[#1a2744]", children: "Invite Team Member" }), _jsx("p", { className: "text-[14px] text-[#717182] mt-0.5", children: "They'll receive an email to set up their account." })] }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close panel", className: "w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center hover:bg-[#e8ecf4] transition-colors", children: _jsx(X, { size: 18 }) })] }), _jsxs("form", { className: "px-7 py-6", onSubmit: (e) => {
                            e.preventDefault();
                            inviteMutation.mutate();
                        }, children: [_jsxs("div", { className: "mb-5", children: [_jsx("label", { htmlFor: "invite-name", className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Full name" }), _jsx("input", { id: "invite-name", type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "Jane Smith", required: true, className: cn('w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-[#f8f9fb]', 'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none transition-colors', 'focus:border-[#4a9ad4] focus:bg-white') })] }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { htmlFor: "invite-email", className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Email address" }), _jsx("input", { id: "invite-email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "team@nextaibuilder.com", required: true, className: cn('w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-[#f8f9fb]', 'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none transition-colors', 'focus:border-[#4a9ad4] focus:bg-white') })] }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-[13px] font-[600] text-[#1a2744] mb-3", children: "Permissions" }), _jsx(PermissionSelector, { selected: permissions, onChange: setPermissions })] }), _jsxs("div", { className: "flex gap-3 justify-end pt-2 border-t border-[rgba(26,39,68,0.08)]", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-5 py-3 rounded-full bg-[#f0f0f0] text-[#717182] text-[14px] font-[700] hover:bg-[#e8ecf4] transition-colors", children: "Cancel" }), _jsx("button", { type: "submit", disabled: !isValid || inviteMutation.isPending, className: cn('px-5 py-3 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-[700] transition-colors', 'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'), children: inviteMutation.isPending ? 'Sending…' : 'Send Invite →' })] })] })] })] }));
}
// ---------------------------------------------------------------------------
// Deactivate confirm modal
// ---------------------------------------------------------------------------
function DeactivateModal({ member, onConfirm, onClose, isPending, }) {
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-[rgba(13,26,58,0.5)] flex items-center justify-center p-6", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "bg-white rounded-[20px] p-8 w-full max-w-[440px] shadow-[rgba(26,39,68,0.2)_0_20px_60px]", children: [_jsx("h2", { className: "text-[20px] font-[800] text-[#1a2744] mb-2", children: "Deactivate Member" }), _jsxs("p", { className: "text-[14px] text-[#717182] mb-6", children: ["Are you sure you want to deactivate", ' ', _jsx("span", { className: "font-semibold text-[#1a2744]", children: member.name }), "? They will lose all admin access immediately."] }), _jsxs("div", { className: "flex gap-3 justify-end", children: [_jsx("button", { type: "button", onClick: onClose, disabled: isPending, className: "px-5 py-2.5 rounded-full bg-[#f0f0f0] text-[#717182] text-[14px] font-[700] hover:bg-[#e8ecf4] transition-colors disabled:opacity-50", children: "Cancel" }), _jsx("button", { type: "button", onClick: onConfirm, disabled: isPending, className: "px-5 py-2.5 rounded-full bg-[#fdeaeb] text-[#d03238] text-[14px] font-[700] hover:bg-[#fad0d2] transition-colors disabled:opacity-50", children: isPending ? 'Deactivating…' : 'Deactivate' })] })] }) }));
}
function SubAdminRow({ member, onDeactivate, onPermissionsUpdated, isOwner }) {
    const [editExpanded, setEditExpanded] = useState(false);
    const [editPermissions, setEditPermissions] = useState(member.permissions);
    const updateMutation = useMutation({
        mutationFn: () => updateSubAdminPermissions(member.id, editPermissions),
        onSuccess: () => {
            onPermissionsUpdated(member.id, editPermissions);
            setEditExpanded(false);
        },
    });
    const statusStyles = {
        ACTIVE: 'bg-[#e6f4ec] text-[#054d28]',
        INVITED: 'bg-[#fff8e6] text-[#8a5a00]',
        INACTIVE: 'bg-[#f0f0f0] text-[#717182]',
    };
    // Derive a label to summarise permissions briefly
    const permLabel = member.permissions.length === ALL_PERMISSIONS.length
        ? 'All Access'
        : member.permissions.length === 0
            ? 'No Access'
            : `${member.permissions.length} permissions`;
    return (_jsxs(_Fragment, { children: [_jsxs("tr", { className: "hover:[&>td]:bg-[#f8fbff] transition-colors", children: [_jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsxs("div", { className: "flex items-center gap-2.5", children: [member.avatarUrl ? (_jsx("img", { src: member.avatarUrl, alt: "", className: "w-9 h-9 rounded-full flex-shrink-0" })) : (_jsx("div", { className: "w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[14px] font-[700]", style: { background: getAvatarGradient(member.name) }, "aria-hidden": "true", children: member.name.charAt(0).toUpperCase() })), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[14px] font-[700] text-[#1a2744]", children: member.name }), isOwner && (_jsx("span", { className: "text-[11px] font-[600] bg-[#1a2744] text-white px-[9px] py-[3px] rounded-full", children: "Owner" }))] }), _jsx("div", { className: "text-[12px] text-[#a3a3a3]", children: member.email })] })] }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsx("span", { className: "text-[11px] font-[600] bg-[#e8f4fd] text-[#1a2744] px-[9px] py-[3px] rounded-full", children: permLabel }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsx("span", { className: cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', statusStyles[member.status]), children: member.status === 'INVITED' ? 'Invited' : member.status === 'ACTIVE' ? 'Active' : 'Inactive' }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[12px] text-[#717182]", children: formatRelativeTime(member.lastActiveAt) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: isOwner ? (_jsxs("div", { className: "flex gap-3", children: [_jsx("span", { className: "text-[13px] text-[#d4d4d4] cursor-not-allowed", children: "Edit" }), _jsx("span", { className: "text-[13px] text-[#d4d4d4] cursor-not-allowed", children: "Deactivate" })] })) : (_jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "button", onClick: () => {
                                        setEditPermissions(member.permissions);
                                        setEditExpanded((v) => !v);
                                    }, className: "text-[13px] font-[600] text-[#4a9ad4] hover:underline", children: editExpanded ? 'Cancel' : 'Edit' }), member.status === 'ACTIVE' && (_jsx("button", { type: "button", onClick: () => onDeactivate(member), className: "text-[13px] font-[600] text-[#d03238] hover:underline", children: "Deactivate" }))] })) })] }), editExpanded && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "border-b border-[rgba(26,39,68,0.04)] bg-[#f8fbff]", children: _jsxs("div", { className: "px-5 py-5", children: [_jsx(PermissionSelector, { selected: editPermissions, onChange: setEditPermissions }), _jsxs("div", { className: "flex gap-3 justify-end mt-4", children: [_jsx("button", { type: "button", onClick: () => setEditExpanded(false), className: "px-4 py-2 rounded-full bg-[#f0f0f0] text-[#717182] text-[13px] font-[700] hover:bg-[#e8ecf4] transition-colors", children: "Cancel" }), _jsx("button", { type: "button", onClick: () => updateMutation.mutate(), disabled: updateMutation.isPending, className: "px-4 py-2 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[13px] font-[700] hover:opacity-90 transition-opacity disabled:opacity-50", children: updateMutation.isPending ? 'Saving…' : 'Save Permissions' })] })] }) }) }))] }));
}
// ---------------------------------------------------------------------------
// SubAdminPage
// ---------------------------------------------------------------------------
export default function SubAdminPage() {
    const [showInvite, setShowInvite] = useState(false);
    const [deactivateTarget, setDeactivateTarget] = useState(null);
    const { toasts, addToast, dismissToast } = useToast();
    const queryClient = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['sub-admins'],
        queryFn: fetchSubAdmins,
        staleTime: 60_000,
    });
    const deactivateMutation = useMutation({
        mutationFn: (id) => deactivateSubAdmin(id),
        onSuccess: () => {
            setDeactivateTarget(null);
            queryClient.invalidateQueries({ queryKey: ['sub-admins'] });
            addToast('Member deactivated', 'success');
        },
        onError: (err) => {
            addToast(err instanceof Error ? err.message : 'Failed to deactivate', 'error');
        },
    });
    function handleInviteSuccess() {
        setShowInvite(false);
        queryClient.invalidateQueries({ queryKey: ['sub-admins'] });
        addToast('Invitation sent!', 'success');
    }
    function handlePermissionsUpdated(id, permissions) {
        queryClient.setQueryData(['sub-admins'], (old) => {
            if (!old)
                return old;
            return {
                ...old,
                subAdmins: old.subAdmins.map((m) => (m.id === id ? { ...m, permissions } : m)),
            };
        });
        addToast('Permissions updated', 'success');
    }
    const members = data?.subAdmins ?? [];
    return (_jsxs(AdminShell, { title: "Team", actions: _jsx("button", { type: "button", onClick: () => setShowInvite(true), className: cn('px-5 py-2.5 rounded-full bg-[#4a9ad4] text-[#0d1a3a]', 'text-[14px] font-[700] hover:opacity-90 transition-opacity', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9ad4]'), children: "+ Invite Member" }), children: [_jsx("div", { "aria-live": "polite", className: "fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none", children: toasts.map((t) => (_jsx("div", { className: "pointer-events-auto", children: _jsx(Toast, { toast: t, onDismiss: dismissToast }) }, t.id))) }), showInvite && (_jsx(InvitePanel, { onClose: () => setShowInvite(false), onSuccess: handleInviteSuccess })), deactivateTarget && (_jsx(DeactivateModal, { member: deactivateTarget, onClose: () => setDeactivateTarget(null), onConfirm: () => deactivateMutation.mutate(deactivateTarget.id), isPending: deactivateMutation.isPending })), _jsxs("div", { className: "px-8 py-6", children: [isLoading && (_jsx("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", "aria-busy": "true", "aria-label": "Loading team members", children: [1, 2, 3].map((n) => (_jsxs("div", { className: "flex items-center gap-4 px-5 py-4 border-b border-[rgba(26,39,68,0.04)] last:border-b-0", "aria-hidden": "true", children: [_jsx("div", { className: "w-9 h-9 rounded-full bg-[#e8ecf4] animate-pulse flex-shrink-0" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-3.5 bg-[#e8ecf4] rounded animate-pulse w-1/4" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-1/5" })] }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-20" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-16" })] }, n))) })), isError && !isLoading && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("div", { className: "text-[40px] mb-4", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("p", { className: "text-[16px] font-[600] text-[#1a2744]", children: "Failed to load team" })] })), !isLoading && !isError && members.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("div", { className: "text-[48px] mb-4", "aria-hidden": "true", children: "\uD83D\uDC64" }), _jsx("p", { className: "text-[16px] font-[600] text-[#1a2744]", children: "No team members yet" }), _jsx("p", { className: "text-[14px] text-[#717182] mt-1", children: "Invite your first team member above." })] })), !isLoading && !isError && members.length > 0 && (_jsx("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", children: _jsxs("table", { className: "w-full border-collapse", "aria-label": "Team members", children: [_jsx("thead", { children: _jsx("tr", { children: ['Member', 'Permissions', 'Status', 'Last Active', 'Actions'].map((col) => (_jsx("th", { scope: "col", className: "text-left text-[11px] font-[600] text-[#717182] px-5 py-3 border-b border-[rgba(26,39,68,0.08)] uppercase tracking-[0.5px] bg-[#f8f9fb]", children: col }, col))) }) }), _jsx("tbody", { children: members.map((member, idx) => (_jsx(SubAdminRow, { member: member, isOwner: idx === 0, onDeactivate: setDeactivateTarget, onPermissionsUpdated: handlePermissionsUpdated }, member.id))) })] }) }))] })] }));
}
