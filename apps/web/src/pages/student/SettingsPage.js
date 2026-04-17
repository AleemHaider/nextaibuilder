import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-171 — Student settings: Profile + Notification preferences
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../context/AuthContext';
import { fetchNotificationPreferences, updateNotificationPreferences, fetchStudentProfile, updateStudentProfile, changeStudentPassword, } from '../../lib/api';
import { cn } from '../../lib/utils';
function ToggleSwitch({ id, checked, onChange, disabled = false }) {
    return (_jsx("button", { type: "button", id: id, role: "switch", "aria-checked": checked, disabled: disabled, onClick: () => onChange(!checked), className: cn('relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent', 'transition-colors duration-200 ease-in-out cursor-pointer', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9ad4] focus-visible:ring-offset-2', checked ? 'bg-[#4a9ad4]' : 'bg-[#e8ecf4]', disabled && 'opacity-50 cursor-not-allowed'), children: _jsx("span", { "aria-hidden": "true", className: cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow', 'transition-transform duration-200 ease-in-out', checked ? 'translate-x-5' : 'translate-x-0') }) }));
}
function ToggleRow({ label, description, checked, onChange, disabled }) {
    const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (_jsxs("div", { className: "flex items-center justify-between gap-4 py-4 border-b border-[rgba(26,39,68,0.06)] last:border-b-0", children: [_jsxs("div", { className: "flex-1", children: [_jsx("label", { htmlFor: id, className: "text-[15px] font-[600] text-[#1a2744] cursor-pointer", children: label }), _jsx("p", { className: "text-[13px] text-[#717182] mt-0.5", children: description })] }), _jsx(ToggleSwitch, { id: id, checked: checked, onChange: onChange, disabled: disabled })] }));
}
function Toast({ state, onDismiss }) {
    useEffect(() => {
        if (!state)
            return;
        const timer = setTimeout(onDismiss, 3000);
        return () => clearTimeout(timer);
    }, [state, onDismiss]);
    if (!state)
        return null;
    return (_jsxs("div", { role: "status", "aria-live": "polite", className: cn('fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-[14px] shadow-lg', 'text-[14px] font-[600] max-w-[320px]', 'transition-all', state.type === 'success'
            ? 'bg-[#1a2744] text-white'
            : 'bg-[#fdeaeb] text-[#d03238]'), children: [state.type === 'success' ? '✓ ' : '✕ ', state.message] }));
}
// ---------------------------------------------------------------------------
// NotificationsTab
// ---------------------------------------------------------------------------
const DEFAULT_PREFS = {
    emailEnrollment: true,
    emailPayments: true,
    emailReminders: true,
    emailBroadcast: false,
};
function NotificationsTab() {
    const [toast, setToast] = useState(null);
    const [localPrefs, setLocalPrefs] = useState(DEFAULT_PREFS);
    const { data: prefsData, isLoading, error } = useQuery({
        queryKey: ['student', 'settings', 'notifications'],
        queryFn: fetchNotificationPreferences,
    });
    // Sync fetched preferences into local state
    useEffect(() => {
        if (prefsData?.notifications) {
            setLocalPrefs(prefsData.notifications);
        }
    }, [prefsData]);
    const mutation = useMutation({
        mutationFn: updateNotificationPreferences,
        onSuccess: () => {
            setToast({ message: 'Notification preferences saved.', type: 'success' });
        },
        onError: (err) => {
            setToast({ message: err.message || 'Failed to save preferences.', type: 'error' });
        },
    });
    function handleToggle(key, value) {
        const updated = { ...localPrefs, [key]: value };
        setLocalPrefs(updated);
        mutation.mutate(updated);
    }
    const isSaving = mutation.isPending;
    if (isLoading) {
        return (_jsx("div", { className: "animate-pulse space-y-4 py-4", children: [1, 2, 3, 4].map((i) => (_jsxs("div", { className: "flex justify-between items-center py-4 border-b border-[rgba(26,39,68,0.06)]", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("div", { className: "h-3.5 w-40 bg-[#e8ecf4] rounded-full" }), _jsx("div", { className: "h-3 w-64 bg-[#e8ecf4] rounded-full" })] }), _jsx("div", { className: "h-6 w-11 bg-[#e8ecf4] rounded-full" })] }, i))) }));
    }
    if (error) {
        return (_jsx("div", { className: "bg-[#fdeaeb] text-[#d03238] text-[14px] font-[600] rounded-[12px] px-4 py-3 mt-4", children: "Failed to load preferences. Please refresh." }));
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-5", children: [_jsx("h2", { className: "text-[18px] font-[700] text-[#1a2744] mb-1", children: "Email Notifications" }), _jsx("p", { className: "text-[14px] text-[#717182]", children: "Control which email notifications you receive from nextaibuilder." })] }), _jsxs("div", { className: "bg-white rounded-[16px] border border-[rgba(26,39,68,0.08)] px-5", children: [_jsx(ToggleRow, { label: "Enrollment & access updates", description: "Get notified when your enrollment is confirmed or your course access changes.", checked: localPrefs.emailEnrollment, onChange: (v) => handleToggle('emailEnrollment', v), disabled: isSaving }), _jsx(ToggleRow, { label: "Payment notifications", description: "Receive emails about payment approvals, receipts, and installment reminders.", checked: localPrefs.emailPayments, onChange: (v) => handleToggle('emailPayments', v), disabled: isSaving }), _jsx(ToggleRow, { label: "Course reminders", description: "Weekly course reminders and re-engagement nudges to keep you on track.", checked: localPrefs.emailReminders, onChange: (v) => handleToggle('emailReminders', v), disabled: isSaving }), _jsx(ToggleRow, { label: "Broadcast announcements", description: "Platform-wide announcements, new course launches, and important updates.", checked: localPrefs.emailBroadcast, onChange: (v) => handleToggle('emailBroadcast', v), disabled: isSaving })] }), isSaving && (_jsx("p", { className: "text-[13px] text-[#717182] mt-3 animate-pulse", children: "Saving\u2026" })), _jsx(Toast, { state: toast, onDismiss: () => setToast(null) })] }));
}
// ---------------------------------------------------------------------------
// ProfileTab — name editing + password change
// ---------------------------------------------------------------------------
function ProfileTab() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [toast, setToast] = useState(null);
    // ── Profile form state ─────────────────────────────────────────────────
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ['student', 'profile'],
        queryFn: fetchStudentProfile,
    });
    useEffect(() => {
        if (profile) {
            setFirstName(profile.firstName);
            setLastName(profile.lastName);
        }
    }, [profile]);
    const profileMutation = useMutation({
        mutationFn: updateStudentProfile,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
            setToast({ message: 'Profile updated.', type: 'success' });
        },
        onError: (err) => {
            setToast({ message: err.message || 'Failed to save profile.', type: 'error' });
        },
    });
    function handleProfileSave(e) {
        e.preventDefault();
        if (!firstName.trim())
            return;
        profileMutation.mutate({ firstName: firstName.trim(), lastName: lastName.trim() });
    }
    // ── Password form state ────────────────────────────────────────────────
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const passwordMutation = useMutation({
        mutationFn: changeStudentPassword,
        onSuccess: () => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setToast({ message: 'Password changed successfully.', type: 'success' });
        },
        onError: (err) => {
            setToast({ message: err.message || 'Failed to change password.', type: 'error' });
        },
    });
    function handlePasswordChange(e) {
        e.preventDefault();
        if (!currentPassword || !newPassword || !confirmPassword)
            return;
        passwordMutation.mutate({ currentPassword, newPassword, confirmPassword });
    }
    const inputClass = cn('w-full h-[42px] px-4 rounded-[10px] text-[14px] font-[400] text-[#1a2744]', 'bg-[#f3f3f5] border border-transparent outline-none', 'focus:border-[#4a9ad4] focus:ring-[3px] focus:ring-[#4a9ad4]/20 transition-all');
    if (profileLoading) {
        return (_jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-4 w-32 bg-[#e8ecf4] rounded-full" }), _jsx("div", { className: "h-[42px] bg-[#e8ecf4] rounded-[10px]" }), _jsx("div", { className: "h-[42px] bg-[#e8ecf4] rounded-[10px]" })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("form", { onSubmit: handleProfileSave, className: "bg-white rounded-[16px] border border-[rgba(26,39,68,0.08)] p-6", children: [_jsx("h2", { className: "text-[18px] font-[700] text-[#1a2744] mb-1", children: "Profile" }), _jsxs("p", { className: "text-[13px] text-[#717182] mb-5", children: ["Update your display name. Your email (", user?.email, ") cannot be changed here."] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "First name" }), _jsx("input", { type: "text", value: firstName, onChange: (e) => setFirstName(e.target.value), className: inputClass, placeholder: "First name", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Last name" }), _jsx("input", { type: "text", value: lastName, onChange: (e) => setLastName(e.target.value), className: inputClass, placeholder: "Last name" })] })] }), _jsx("button", { type: "submit", disabled: profileMutation.isPending, className: cn('px-6 py-2.5 rounded-full text-[14px] font-[700] border-none cursor-pointer transition-opacity', 'bg-[#1a2744] text-white hover:opacity-90', profileMutation.isPending && 'opacity-50 cursor-not-allowed'), children: profileMutation.isPending ? 'Saving…' : 'Save changes' })] }), profile?.hasPassword && (_jsxs("form", { onSubmit: handlePasswordChange, className: "bg-white rounded-[16px] border border-[rgba(26,39,68,0.08)] p-6", children: [_jsx("h2", { className: "text-[18px] font-[700] text-[#1a2744] mb-1", children: "Change Password" }), _jsx("p", { className: "text-[13px] text-[#717182] mb-5", children: "Minimum 8 characters with at least one uppercase letter and one number." }), _jsxs("div", { className: "space-y-4 mb-5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Current password" }), _jsx("input", { type: "password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), className: inputClass, placeholder: "Current password", autoComplete: "current-password" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "New password" }), _jsx("input", { type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), className: inputClass, placeholder: "New password", autoComplete: "new-password" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Confirm new password" }), _jsx("input", { type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), className: inputClass, placeholder: "Confirm new password", autoComplete: "new-password" })] })] }), _jsx("button", { type: "submit", disabled: passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword, className: cn('px-6 py-2.5 rounded-full text-[14px] font-[700] border-none cursor-pointer transition-opacity', 'bg-[#4a9ad4] text-[#0d1a3a] hover:opacity-90', (passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword) &&
                            'opacity-50 cursor-not-allowed'), children: passwordMutation.isPending ? 'Updating…' : 'Update password' })] })), _jsx(Toast, { state: toast, onDismiss: () => setToast(null) })] }));
}
// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------
const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'notifications', label: 'Notifications' },
];
export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('notifications');
    return (_jsxs("div", { className: "min-h-screen bg-[#f8f9fb]", children: [_jsx(TopNav, {}), _jsxs("main", { className: "max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-10", children: [_jsx("h1", { className: "text-[28px] sm:text-[32px] font-[800] text-[#1a2744] mb-6", children: "Settings" }), _jsx("div", { className: "flex gap-1 bg-[#e8ecf4] rounded-[12px] p-1 mb-7 w-fit", role: "tablist", "aria-label": "Settings sections", children: TABS.map(({ key, label }) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeTab === key, "aria-controls": `panel-${key}`, onClick: () => setActiveTab(key), className: cn('px-5 py-2 rounded-[9px] text-[14px] font-[600] transition-all border-none cursor-pointer', activeTab === key
                                ? 'bg-white text-[#1a2744] shadow-[0_1px_4px_rgba(26,39,68,0.12)]'
                                : 'bg-transparent text-[#717182] hover:text-[#1a2744]'), children: label }, key))) }), _jsxs("div", { id: `panel-${activeTab}`, role: "tabpanel", "aria-labelledby": `tab-${activeTab}`, children: [activeTab === 'profile' && _jsx(ProfileTab, {}), activeTab === 'notifications' && _jsx(NotificationsTab, {})] })] })] }));
}
