import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-58 — Certificate page: display, share, download for completed courses
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchStudentCertificates } from '../../lib/api';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatIssuedAt(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}
// ---------------------------------------------------------------------------
// Print styles — injected into <head> once, cleaned up on unmount
// ---------------------------------------------------------------------------
const PRINT_STYLE_ID = 'certificate-print-style';
function injectPrintStyles() {
    if (document.getElementById(PRINT_STYLE_ID))
        return;
    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #certificate-print-root,
      #certificate-print-root * { visibility: visible !important; }
      #certificate-print-root {
        position: fixed !important;
        inset: 0 !important;
        padding: 32px !important;
      }
      nav, header, footer, .no-print { display: none !important; }
    }
  `;
    document.head.appendChild(style);
}
function removePrintStyles() {
    document.getElementById(PRINT_STYLE_ID)?.remove();
}
function CertificateCard({ cert, studentName }) {
    return (_jsxs("div", { id: "certificate-print-root", className: "bg-white rounded-[32px] overflow-hidden mb-8", style: { boxShadow: 'rgba(26,39,68,0.15) 0 8px 48px' }, children: [_jsxs("div", { className: "px-14 py-10 relative overflow-hidden", style: { background: 'linear-gradient(135deg,#0d1a3a 0%,#1a2744 50%,#2d4a8a 100%)' }, children: [_jsx("div", { className: "absolute rounded-full border border-[rgba(74,154,212,0.15)]", style: { top: -60, right: -60, width: 280, height: 280 } }), _jsx("div", { className: "absolute rounded-full border border-[rgba(74,154,212,0.08)]", style: { top: -100, right: -100, width: 380, height: 380 } }), _jsxs("div", { className: "relative z-10 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[14px] font-600 text-[rgba(255,255,255,0.5)] tracking-[2px] uppercase mb-1", children: "nextaibuilder" }), _jsx("p", { className: "text-[13px] text-[rgba(255,255,255,0.35)]", children: "Certificate of Completion" })] }), _jsx("div", { className: "w-14 h-14 rounded-[16px] flex items-center justify-center text-[28px]", style: { background: 'rgba(74,154,212,0.2)', border: '1px solid rgba(74,154,212,0.3)' }, children: "\uD83C\uDFC6" })] })] }), _jsxs("div", { className: "mx-8 rounded-[20px] bg-white text-center px-14 py-14 relative -mt-5", style: {
                    border: '1px solid rgba(26,39,68,0.08)',
                    boxShadow: 'rgba(26,39,68,0.08) 0 4px 20px',
                }, children: [_jsx("div", { className: "w-[72px] h-[72px] rounded-full flex items-center justify-center text-[36px] mx-auto mb-7", style: {
                            background: 'linear-gradient(135deg,#4a9ad4,#1a2744)',
                            boxShadow: 'rgba(26,39,68,0.2) 0 4px 16px',
                        }, children: "\u2713" }), _jsx("p", { className: "text-[18px] font-500 text-[#717182] mb-3 tracking-[0.5px]", children: "This is to certify that" }), _jsx("h2", { className: "text-[48px] font-900 text-[#1a2744] tracking-[-1.5px] mb-2", children: studentName }), _jsx("div", { className: "mx-auto mb-6", style: {
                            width: 240,
                            height: 2,
                            background: 'linear-gradient(90deg,transparent,#4a9ad4,transparent)',
                        } }), _jsx("p", { className: "text-[16px] text-[#717182] mb-2", children: "has successfully completed" }), _jsx("h3", { className: "text-[32px] font-900 text-[#1a2744] tracking-[-0.8px] mb-2", children: cert.cohortTitle }), _jsxs("p", { className: "text-[15px] text-[#4a9ad4] font-600 mb-8", children: ["A nextaibuilder ", cert.cohortType, " course"] }), _jsxs("div", { className: "flex justify-center gap-12 mb-10", children: [_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-[13px] text-[#a3a3a3] mb-1", children: "Completed" }), _jsx("p", { className: "text-[16px] font-700 text-[#1a2744]", children: formatIssuedAt(cert.issuedAt) })] }), _jsx("div", { className: "w-px bg-[rgba(26,39,68,0.1)]" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-[13px] text-[#a3a3a3] mb-1", children: "Lessons" }), _jsxs("p", { className: "text-[16px] font-700 text-[#1a2744]", children: [cert.lessonsCompleted, " of ", cert.totalLessons] })] }), _jsx("div", { className: "w-px bg-[rgba(26,39,68,0.1)]" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-[13px] text-[#a3a3a3] mb-1", children: "Credential ID" }), _jsx("p", { className: "text-[16px] font-700 text-[#1a2744]", style: { fontFamily: "'Courier New', monospace" }, children: cert.credentialId })] })] }), _jsx("div", { className: "flex justify-center pt-7", style: { borderTop: '1px solid rgba(26,39,68,0.08)' }, children: _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-[24px] font-900 text-[#1a2744] italic tracking-[-0.5px] mb-1.5", children: cert.instructorName }), _jsx("div", { className: "w-40 h-px bg-[rgba(26,39,68,0.2)] mx-auto mb-1.5" }), _jsx("p", { className: "text-[12px] text-[#717182]", children: "Course Instructor" })] }) })] }), _jsxs("div", { className: "px-14 py-5 flex items-center justify-between border-t border-[rgba(26,39,68,0.06)]", style: { background: '#f8f9fb' }, children: [_jsxs("p", { className: "text-[12px] text-[#a3a3a3]", children: ["Verify at nextaibuilder.com/verify/", cert.credentialId] }), _jsxs("p", { className: "text-[12px] text-[#a3a3a3]", children: ["\u00A9 ", new Date().getFullYear(), " nextaibuilder"] })] })] }));
}
function ShareSection({ cert, onCopyToast, onPrint }) {
    const verifyUrl = `${window.location.origin}/certificate/${cert.credentialId}`;
    const shareOnLinkedIn = () => {
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };
    const shareOnTwitter = () => {
        const text = `I just completed "${cert.cohortTitle}" on @nextaibuilder! 🎉 Check out my certificate:`;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(verifyUrl)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };
    const copyLink = async () => {
        await navigator.clipboard.writeText(verifyUrl);
        onCopyToast();
    };
    return (_jsxs("div", { className: "bg-white rounded-[20px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] p-7", children: [_jsx("p", { className: "text-[16px] font-700 text-[#1a2744] mb-4", children: "Share your achievement" }), _jsxs("div", { className: "flex gap-3 flex-wrap", children: [_jsx("button", { type: "button", onClick: shareOnLinkedIn, className: "px-5 py-[11px] rounded-full bg-[#0a66c2] text-white text-[14px] font-700 border-none cursor-pointer font-sans flex items-center gap-1.5 hover:opacity-90 transition-opacity", children: "\uD83D\uDD17 LinkedIn" }), _jsx("button", { type: "button", onClick: shareOnTwitter, className: "px-5 py-[11px] rounded-full bg-[#1da1f2] text-white text-[14px] font-700 border-none cursor-pointer font-sans flex items-center gap-1.5 hover:opacity-90 transition-opacity", children: "\uD83D\uDC26 Twitter / X" }), _jsx("button", { type: "button", onClick: () => void copyLink(), className: "px-5 py-[11px] rounded-full bg-[#f0f0f0] text-[#1a2744] text-[14px] font-700 border-none cursor-pointer font-sans flex items-center gap-1.5 hover:bg-[#e0e0e0] transition-colors", children: "\uD83D\uDCCB Copy Link" }), _jsx("button", { type: "button", onClick: onPrint, className: "px-5 py-[11px] rounded-full bg-[#f0f0f0] text-[#1a2744] text-[14px] font-700 border-none cursor-pointer font-sans flex items-center gap-1.5 hover:bg-[#e0e0e0] transition-colors", children: "\u2B07 Download PDF" })] }), _jsxs("div", { className: "mt-4 bg-[#f8f9fb] rounded-[10px] px-3.5 py-2.5 flex items-center gap-2", children: [_jsx("span", { className: "text-[14px]", children: "\uD83D\uDD17" }), _jsx("span", { className: "text-[12px] text-[#717182] flex-1 truncate", style: { fontFamily: "'Courier New', monospace" }, children: verifyUrl }), _jsx("button", { type: "button", onClick: () => void copyLink(), className: "text-[12px] font-600 text-[#4a9ad4] bg-transparent border-none cursor-pointer font-sans ml-auto", children: "Copy" })] })] }));
}
// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyCertificates() {
    return (_jsxs("div", { className: "bg-white rounded-[20px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] py-20 px-10 text-center", children: [_jsx("div", { className: "text-[64px] mb-5", children: "\uD83C\uDFC6" }), _jsx("h2", { className: "text-[22px] font-700 text-[#1a2744] mb-2", children: "No certificates yet" }), _jsx("p", { className: "text-[16px] text-[#717182] mb-6 max-w-sm mx-auto", children: "Complete a course to earn your certificate of completion." }), _jsx(Link, { to: "/student/dashboard", className: cn('inline-block px-8 py-3.5 rounded-full', 'bg-[#4a9ad4] text-[#0d1a3a] text-[15px] font-700', 'no-underline hover:opacity-90 transition-opacity'), children: "Go to My Courses" })] }));
}
function CertTabs({ certs, activeIndex, onChange }) {
    if (certs.length <= 1)
        return null;
    return (_jsx("div", { className: "flex gap-2 mb-6 flex-wrap", children: certs.map((c, i) => (_jsx("button", { type: "button", onClick: () => onChange(i), className: cn('px-4 py-2 rounded-full text-[14px] font-600 border cursor-pointer font-sans transition-colors', activeIndex === i
                ? 'bg-[#4a9ad4] text-[#0d1a3a] border-[#4a9ad4]'
                : 'bg-white text-[#717182] border-[rgba(26,39,68,0.15)] hover:border-[#4a9ad4] hover:text-[#4a9ad4]'), children: c.cohortTitle }, c.id))) }));
}
// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CertificatePage() {
    const [certs, setCerts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [copyToast, setCopyToast] = useState(false);
    const { user } = useAuth();
    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const data = await fetchStudentCertificates();
                if (!cancelled)
                    setCerts(data.certificates);
            }
            catch (err) {
                if (!cancelled)
                    setError(err instanceof Error ? err.message : 'Failed to load certificates');
            }
            finally {
                if (!cancelled)
                    setIsLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        injectPrintStyles();
        return removePrintStyles;
    }, []);
    function handlePrint() {
        window.print();
    }
    function handleCopyToast() {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2500);
    }
    const activeCert = certs[activeIndex];
    const studentName = user?.name ?? 'Student';
    return (_jsxs("div", { className: "min-h-screen bg-[#f8f9fb]", children: [_jsx(TopNav, {}), _jsx("main", { className: "px-20 py-12", children: _jsxs("div", { className: "max-w-[900px] mx-auto", children: [_jsx(Link, { to: "/student/dashboard", className: "text-[14px] font-600 text-[#717182] no-underline hover:text-[#1a2744] transition-colors mb-2 inline-block", children: "\u2190 My Courses" }), _jsxs("div", { className: "flex items-start justify-between mb-9", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[13px] font-600 text-[#4a9ad4] tracking-[1px] uppercase mb-2", children: "Certificate of Completion" }), activeCert ? (_jsxs(_Fragment, { children: [_jsx("h1", { className: "text-[36px] font-900 text-[#1a2744] tracking-[-1px] mb-1.5", children: activeCert.cohortTitle }), _jsxs("p", { className: "text-[16px] text-[#717182]", children: ["Completed ", formatIssuedAt(activeCert.issuedAt), " \u00B7 ", activeCert.lessonsCompleted, " of ", activeCert.totalLessons, " lessons"] })] })) : (_jsx("h1", { className: "text-[36px] font-900 text-[#1a2744] tracking-[-1px]", children: "Your Certificates" }))] }), activeCert && (_jsxs("div", { className: "flex gap-2.5 flex-shrink-0 no-print", children: [_jsx("button", { type: "button", onClick: handlePrint, className: "px-[22px] py-3 rounded-full bg-[#f0f0f0] text-[#1a2744] text-[14px] font-700 border-none cursor-pointer font-sans flex items-center gap-1.5 hover:bg-[#e0e0e0] transition-colors", children: "\u2B07 Download PDF" }), _jsx("button", { type: "button", onClick: () => { void navigator.clipboard.writeText(`${window.location.origin}/certificate/${activeCert.credentialId}`); handleCopyToast(); }, className: "px-[22px] py-3 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-700 border-none cursor-pointer font-sans flex items-center gap-1.5 hover:opacity-90 transition-opacity", children: "\uD83D\uDD17 Share" })] }))] }), error && (_jsxs("div", { className: "bg-[#fdeaeb] rounded-xl p-4 mb-6 text-[#d03238] text-[14px] font-600", children: ["\u26A0\uFE0F ", error] })), isLoading ? (_jsx("div", { className: "animate-pulse", children: _jsx("div", { className: "h-96 bg-[#e8ecf4] rounded-[32px]" }) })) : certs.length === 0 ? (_jsx(EmptyCertificates, {})) : (_jsxs(_Fragment, { children: [_jsx(CertTabs, { certs: certs, activeIndex: activeIndex, onChange: setActiveIndex }), activeCert && (_jsxs(_Fragment, { children: [_jsx(CertificateCard, { cert: activeCert, studentName: studentName }), _jsx("div", { className: "no-print", children: _jsx(ShareSection, { cert: activeCert, onCopyToast: handleCopyToast, onPrint: handlePrint }) })] }))] }))] }) }), copyToast && (_jsx("div", { className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a2744] text-white text-[14px] font-600 px-5 py-3 rounded-full shadow-lg", role: "status", "aria-live": "polite", children: "Link copied to clipboard!" }))] }));
}
