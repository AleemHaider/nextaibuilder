import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-157 — Stripe Elements checkout page
import { useCallback, useEffect, useRef, useState, } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { createInstallmentCheckout, createOneTimeCheckout, fetchCohortBySlug, submitManualPayment, } from '../lib/api';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatMoney(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
function getInstallmentSchedule(baseDate = new Date()) {
    return [0, 1, 2].map((offset) => {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + offset);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    });
}
// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
function Spinner({ size = 20 }) {
    return (_jsx("div", { style: {
            width: size, height: size, borderRadius: '50%',
            border: `3px solid rgba(255,255,255,0.3)`,
            borderTopColor: '#fff',
            animation: 'spin 0.7s linear infinite',
            flexShrink: 0,
        }, "aria-hidden": "true" }));
}
// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
function CheckoutNav({ backSlug }) {
    return (_jsxs("nav", { style: {
            height: 68,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            padding: '0 32px',
            borderBottom: '1px solid rgba(26,39,68,0.10)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
        }, children: [_jsx("span", { style: { fontSize: 20, fontWeight: 900, color: '#1a2744', letterSpacing: '-0.4px' }, children: "nextaibuilder" }), _jsx("div", { style: { marginLeft: 16, display: 'flex', alignItems: 'center', gap: 6 }, children: _jsx("span", { style: {
                        background: '#e6f4ec', color: '#054d28',
                        fontSize: 11, fontWeight: 700, padding: '3px 10px',
                        borderRadius: 100, letterSpacing: '0.3px',
                    }, children: "\uD83D\uDD12 Secure checkout" }) }), _jsx(Link, { to: `/courses/${backSlug}`, style: {
                    marginLeft: 'auto',
                    fontSize: 14, color: '#717182',
                    textDecoration: 'none', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 4,
                }, children: "\u2190 Back to course" })] }));
}
const TYPE_COVER = {
    live: 'linear-gradient(145deg,#0d1b42,#1e4080,#4a9ad4)',
    combined: 'linear-gradient(145deg,#100d30,#2a1f6e,#6b5ce7)',
    recorded: 'linear-gradient(145deg,#0a2a1a,#0f5132,#16a34a)',
};
const TYPE_BADGE = {
    live: '🔴 Live Cohort',
    combined: '⚡ Combined',
    recorded: '📹 Recorded',
};
function OrderSummaryCard({ cohort, tab, installmentAmount }) {
    const schedule = getInstallmentSchedule();
    const cover = TYPE_COVER[cohort.type] ?? TYPE_COVER.recorded;
    const instAmt = installmentAmount ?? Math.ceil(cohort.price / 3);
    return (_jsxs("div", { style: {
            background: '#fff',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: 'rgba(26,39,68,0.10) 0 4px 24px, rgba(26,39,68,0.08) 0 0 0 1px',
        }, children: [_jsxs("div", { style: {
                    height: 160, background: cohort.coverGradient ?? cover,
                    position: 'relative', display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between', padding: '20px 24px',
                }, children: [_jsx("div", { style: {
                            position: 'absolute', top: -40, right: -40, width: 160, height: 160,
                            borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 70%)',
                            pointerEvents: 'none',
                        } }), _jsx("span", { style: {
                            display: 'inline-block', background: 'rgba(255,255,255,0.18)',
                            backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.28)',
                            borderRadius: 100, padding: '4px 12px',
                            fontSize: 11, fontWeight: 700, color: '#fff', alignSelf: 'flex-start',
                        }, children: TYPE_BADGE[cohort.type] ?? cohort.type }), _jsx("p", { style: { fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.3)' }, children: cohort.title })] }), _jsx("div", { style: { padding: '24px 24px 20px' }, children: tab === 'full' ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#717182' }, children: [_jsx("span", { children: "Subtotal" }), _jsx("span", { children: formatMoney(cohort.price) })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#717182' }, children: [_jsx("span", { children: "Processing fee" }), _jsx("span", { children: "$0" })] }), _jsxs("div", { style: {
                                display: 'flex', justifyContent: 'space-between',
                                borderTop: '1px solid rgba(26,39,68,0.08)', paddingTop: 16, marginBottom: 16,
                                fontSize: 18, fontWeight: 800, color: '#1a2744',
                            }, children: [_jsx("span", { children: "Total due today" }), _jsx("span", { children: formatMoney(cohort.price) })] }), _jsxs("div", { style: {
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                background: '#e6f4ec', borderRadius: 12, padding: '10px 14px',
                                fontSize: 13, color: '#054d28', fontWeight: 600,
                            }, children: [_jsx("span", { children: "\u2713" }), _jsx("span", { children: "Lifetime course access included with enrollment." })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#717182' }, children: [_jsx("span", { children: "Course total" }), _jsx("span", { children: formatMoney(cohort.price) })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#717182' }, children: [_jsx("span", { children: "3 \u00D7 monthly installments" }), _jsxs("span", { children: [formatMoney(instAmt), "/mo"] })] }), _jsxs("div", { style: {
                                display: 'flex', justifyContent: 'space-between',
                                borderTop: '1px solid rgba(26,39,68,0.08)', paddingTop: 16, marginBottom: 16,
                                fontSize: 18, fontWeight: 800, color: '#1a2744',
                            }, children: [_jsx("span", { children: "Due today" }), _jsx("span", { children: formatMoney(instAmt) })] }), _jsxs("div", { style: {
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                background: '#fff7ed', borderRadius: 12, padding: '10px 14px',
                                fontSize: 13, color: '#9a3412', fontWeight: 600,
                            }, children: [_jsx("span", { children: "\uD83D\uDCB3" }), _jsxs("span", { children: ["2nd payment ", schedule[1], " \u00B7 3rd on ", schedule[2]] })] })] })) }), _jsx("div", { style: {
                    padding: '12px 24px 20px',
                    display: 'flex', gap: 12, justifyContent: 'center',
                }, children: ['🔒 SSL encrypted', '✓ Secure checkout', '💳 Stripe protected'].map((t) => (_jsx("span", { style: { fontSize: 11, color: '#a3a3a3', fontWeight: 600 }, children: t }, t))) })] }));
}
function StripeFieldsStub({ onPay, isProcessing, buttonLabel, declined }) {
    const fieldStyle = {
        height: 48, borderRadius: 12,
        border: declined ? '1.5px solid #d03238' : '1.5px solid rgba(26,39,68,0.15)',
        background: declined ? '#fef2f2' : '#f8f9fb',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        fontSize: 15, color: '#a3a3a3', marginBottom: 14,
    };
    return (_jsxs(_Fragment, { children: [_jsx("label", { style: { fontSize: 12, fontWeight: 700, color: '#1a2744', display: 'block', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }, children: "Card number" }), _jsxs("div", { style: fieldStyle, children: [_jsx("span", { style: { flex: 1 }, children: "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022" }), _jsx("span", { style: { fontSize: 20 }, children: "\uD83D\uDCB3" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }, children: [_jsxs("div", { children: [_jsx("label", { style: { fontSize: 12, fontWeight: 700, color: '#1a2744', display: 'block', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }, children: "Expiry" }), _jsx("div", { style: { ...fieldStyle, marginBottom: 0 }, children: _jsx("span", { style: { fontSize: 14, color: '#a3a3a3' }, children: "MM / YY" }) })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: 12, fontWeight: 700, color: '#1a2744', display: 'block', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }, children: "CVC" }), _jsx("div", { style: { ...fieldStyle, marginBottom: 0 }, children: _jsx("span", { style: { fontSize: 14, color: '#a3a3a3' }, children: "\u2022\u2022\u2022" }) })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 20 }, children: [_jsx("span", { style: { fontSize: 13, color: '#717182' }, children: "Powered by" }), _jsx("span", { style: { fontSize: 13, fontWeight: 900, color: '#635bff' }, children: "stripe" }), _jsx("span", { style: { marginLeft: 'auto', fontSize: 12, color: '#a3a3a3', fontWeight: 500 }, children: "Visa \u00B7 Mastercard \u00B7 Amex" })] }), _jsx("button", { type: "button", onClick: onPay, disabled: isProcessing, style: {
                    width: '100%', height: 56, borderRadius: 100,
                    background: declined
                        ? 'linear-gradient(135deg,#d03238,#b02428)'
                        : 'linear-gradient(135deg,#1a2744,#2d4a8a)',
                    color: '#fff', border: 'none',
                    fontSize: 16, fontWeight: 800, cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    opacity: isProcessing ? 0.85 : 1,
                    boxShadow: declined
                        ? '0 4px 20px rgba(208,50,56,0.35)'
                        : '0 4px 20px rgba(26,39,68,0.30)',
                    transition: 'opacity 0.15s',
                    letterSpacing: '0.2px',
                }, children: isProcessing ? (_jsxs(_Fragment, { children: [_jsx(Spinner, {}), "Processing payment..."] })) : (buttonLabel) })] }));
}
// ---------------------------------------------------------------------------
// InstallmentSchedule
// ---------------------------------------------------------------------------
function InstallmentSchedule({ installmentAmount, currency }) {
    const schedule = getInstallmentSchedule();
    const rows = [
        { label: 'First payment', badge: true, date: schedule[0] },
        { label: 'Second payment', badge: false, date: schedule[1] },
        { label: 'Third payment', badge: false, date: schedule[2] },
    ];
    return (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsx("tr", { children: ['Payment', 'Date', 'Amount'].map((h) => (_jsx("th", { style: {
                            textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#717182',
                            padding: '0 0 10px', borderBottom: '1px solid rgba(26,39,68,0.08)',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                        }, children: h }, h))) }) }), _jsx("tbody", { children: rows.map((row, i) => (_jsxs("tr", { children: [_jsxs("td", { style: { fontSize: 14, color: '#1a2744', padding: '13px 0', borderBottom: '1px solid rgba(26,39,68,0.05)' }, children: [row.label, row.badge && (_jsx("span", { style: {
                                        marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                        borderRadius: 100, background: '#e6f4ec', color: '#054d28',
                                    }, children: "Today" }))] }), _jsx("td", { style: { fontSize: 13, color: '#717182', padding: '13px 0', borderBottom: '1px solid rgba(26,39,68,0.05)' }, children: row.date }), _jsx("td", { style: { fontSize: 15, fontWeight: 700, color: '#1a2744', padding: '13px 0', borderBottom: '1px solid rgba(26,39,68,0.05)' }, children: formatMoney(installmentAmount, currency) })] }, i))) })] }));
}
function CheckoutForm({ cohort, tab, onTabChange, onSwitchToManual, status, declined, sessionData, onInitiatePayment, onConfirmStubPayment, }) {
    const isInstallment = (d) => d !== null && 'installmentAmount' in (d ?? {});
    const installmentAmount = isInstallment(sessionData)
        ? sessionData.installmentAmount
        : Math.ceil(cohort.price / 3);
    const currency = sessionData?.currency ?? 'USD';
    const isProcessing = status === 'creating_session' || status === 'processing';
    const showStripeStub = ['stripe_stub', 'creating_session', 'processing', 'ready'].includes(status);
    const payButtonLabel = tab === 'full'
        ? `Pay ${formatMoney(cohort.price, currency)} Now`
        : `Start Plan — Pay ${formatMoney(installmentAmount, currency)} Today`;
    const cardStyle = {
        background: '#fff',
        borderRadius: 20,
        padding: '28px 28px',
        boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px, rgba(26,39,68,0.04) 0 4px 16px',
        marginBottom: 16,
    };
    return (_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("h1", { style: { fontSize: 30, fontWeight: 900, color: '#1a2744', letterSpacing: '-0.6px', margin: '0 0 6px' }, children: "Complete your enrollment" }), _jsx("p", { style: { fontSize: 15, color: '#717182', margin: '0 0 28px' }, children: "Secure checkout powered by Stripe" }), _jsx("div", { style: {
                    display: 'inline-flex',
                    background: '#f0f0f4', borderRadius: 100,
                    padding: 4, marginBottom: 24, gap: 4,
                }, children: ['full', 'installments'].map((t) => (_jsx("button", { type: "button", onClick: () => onTabChange(t), style: {
                        padding: '9px 20px', borderRadius: 100, border: 'none',
                        fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.18s',
                        background: tab === t ? '#1a2744' : 'transparent',
                        color: tab === t ? '#fff' : '#717182',
                        boxShadow: tab === t ? '0 2px 8px rgba(26,39,68,0.20)' : 'none',
                    }, children: t === 'full' ? 'Pay in Full' : 'Pay in 3 Installments' }, t))) }), declined && (_jsxs("div", { style: {
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: '#fdeaeb', border: '1px solid rgba(208,50,56,0.2)',
                    borderRadius: 14, padding: '14px 16px', marginBottom: 16,
                }, role: "alert", children: [_jsx("span", { children: "\u26A0\uFE0F" }), _jsx("p", { style: { fontSize: 14, color: '#d03238', margin: 0 }, children: "Your card was declined. Please check your card details or try a different payment method." })] })), tab === 'installments' && (_jsxs("div", { style: cardStyle, children: [_jsx("h2", { style: { fontSize: 15, fontWeight: 800, color: '#1a2744', margin: '0 0 20px' }, children: "Payment schedule" }), _jsx(InstallmentSchedule, { installmentAmount: installmentAmount, currency: currency }), _jsxs("p", { style: {
                            fontSize: 13, color: '#717182', lineHeight: 1.6,
                            background: '#f8f9fb', borderRadius: 10, padding: '12px 14px',
                            margin: '16px 0 0',
                        }, children: ["By starting this plan, you authorize nextaibuilder to charge", ' ', formatMoney(installmentAmount, currency), " today and the same amount on the following two dates."] })] })), _jsxs("div", { style: cardStyle, children: [_jsx("h2", { style: { fontSize: 15, fontWeight: 800, color: '#1a2744', margin: '0 0 22px' }, children: "Card details" }), showStripeStub && (_jsx(StripeFieldsStub, { onPay: status === 'stripe_stub' ? onConfirmStubPayment : onInitiatePayment, isProcessing: isProcessing, buttonLabel: payButtonLabel, declined: declined }))] }), _jsx("div", { style: { textAlign: 'center', marginTop: 8 }, children: _jsx("button", { type: "button", onClick: onSwitchToManual, style: {
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 14, color: '#4a9ad4', fontWeight: 600,
                    }, children: "Pay by bank transfer instead \u2192" }) })] }));
}
function ManualReceiptView({ cohort, cohortId, paymentPlanId, onBack }) {
    const [uploadState, setUploadState] = useState('idle');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [note, setNote] = useState('');
    const [errorMessage, setErrorMessage] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);
    const formatFileSize = (bytes) => {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    const validateFile = (file) => {
        if (!ACCEPTED_MIME_TYPES.includes(file.type))
            return 'Only PDF, JPG, and PNG files are accepted.';
        if (file.size > MAX_FILE_BYTES)
            return 'File size must be 10 MB or less.';
        return null;
    };
    const handleFile = useCallback((file) => {
        const err = validateFile(file);
        if (err) {
            setErrorMessage(err);
            return;
        }
        setErrorMessage(null);
        setUploadState('uploading');
        setUploadProgress(0);
        const interval = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setUploadedFile({ file, name: file.name, sizeLabel: formatFileSize(file.size) });
                    setUploadState('uploaded');
                    return 100;
                }
                return prev + Math.floor(Math.random() * 20) + 5;
            });
        }, 100);
    }, []);
    const handleInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file)
            handleFile(file);
        e.target.value = '';
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file)
            handleFile(file);
    };
    const handleSubmit = async () => {
        if (!uploadedFile)
            return;
        setUploadState('submitting');
        setErrorMessage(null);
        const formData = new FormData();
        formData.append('file', uploadedFile.file);
        formData.append('cohortId', cohortId);
        if (paymentPlanId)
            formData.append('paymentPlanId', paymentPlanId);
        if (note.trim())
            formData.append('note', note.trim());
        try {
            await submitManualPayment(formData);
            setUploadState('pending');
        }
        catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'Failed to submit receipt');
            setUploadState('uploaded');
        }
    };
    if (uploadState === 'pending') {
        return (_jsx("div", { style: { maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '60px 24px' }, children: _jsxs("div", { style: {
                    background: '#fff', borderRadius: 24,
                    padding: '56px 40px',
                    boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px, rgba(26,39,68,0.06) 0 8px 32px',
                }, children: [_jsx("div", { style: { fontSize: 56, marginBottom: 20 }, children: "\u23F3" }), _jsx("span", { style: {
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: '#fff8e6', color: '#8a5a00',
                            fontSize: 13, fontWeight: 700, padding: '6px 16px',
                            borderRadius: 100, marginBottom: 20,
                        }, children: "\uD83D\uDD50 Under Review" }), _jsx("h2", { style: { fontSize: 26, fontWeight: 900, color: '#1a2744', marginBottom: 10 }, children: "Receipt submitted!" }), _jsx("p", { style: { fontSize: 15, color: '#717182', lineHeight: 1.6, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }, children: "Your payment receipt is being reviewed. You'll receive an email within 24\u201348 hours once approved." }), _jsx("button", { type: "button", onClick: onBack, style: {
                            padding: '12px 32px', borderRadius: 100, background: '#f8f9fb',
                            color: '#1a2744', fontWeight: 700, fontSize: 15,
                            border: '1px solid rgba(26,39,68,0.15)', cursor: 'pointer',
                        }, children: "View Dashboard" })] }) }));
    }
    const isSubmitting = uploadState === 'submitting';
    const isUploading = uploadState === 'uploading';
    const cardStyle = {
        background: '#fff', borderRadius: 20,
        boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px, rgba(26,39,68,0.04) 0 4px 16px',
        marginBottom: 14,
    };
    return (_jsxs("div", { style: { maxWidth: 620, margin: '0 auto' }, children: [_jsxs("div", { style: { ...cardStyle, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18 }, children: [_jsx("div", { style: {
                            width: 72, height: 56, borderRadius: 12, flexShrink: 0,
                            background: cohort.coverGradient ?? TYPE_COVER[cohort.type] ?? TYPE_COVER.recorded,
                        } }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 12, color: '#717182', margin: '0 0 4px' }, children: "Enrolling in" }), _jsx("p", { style: { fontSize: 17, fontWeight: 800, color: '#1a2744', margin: '0 0 4px' }, children: cohort.title }), _jsxs("p", { style: { fontSize: 13, fontWeight: 700, color: '#4a9ad4', margin: 0 }, children: ["Pay in full \u00B7 ", formatMoney(cohort.price)] })] })] }), _jsxs("div", { style: {
                    ...cardStyle,
                    background: '#eef6fd', borderLeft: '4px solid #4a9ad4',
                    borderRadius: '0 16px 16px 0', padding: '20px 22px',
                }, children: [_jsx("h2", { style: { fontSize: 14, fontWeight: 800, color: '#1a2744', margin: '0 0 14px' }, children: "Bank Transfer Instructions" }), [
                        { label: 'Bank name', value: 'HSBC Pakistan' },
                        { label: 'Account name', value: 'NextAI Builder Ltd' },
                        { label: 'Account number', value: 'PK36 SCBL 0000 0011 2345 6700' },
                        { label: 'Amount', value: `${formatMoney(cohort.price)} USD equivalent` },
                    ].map(({ label, value }) => (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 13, color: '#717182' }, children: label }), _jsx("span", { style: { fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1a2744', background: 'rgba(26,39,68,0.06)', padding: '3px 8px', borderRadius: 6 }, children: value })] }, label))), _jsx("p", { style: { fontSize: 13, color: '#717182', margin: '12px 0 0', lineHeight: 1.55 }, children: "Transfer the amount shown and upload your receipt below. Access activates within 24 hours of approval." })] }), errorMessage && (_jsxs("div", { style: {
                    background: '#fdeaeb', border: '1px solid rgba(208,50,56,0.2)',
                    borderRadius: 12, padding: '12px 16px', marginBottom: 14,
                    display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: '#d03238',
                }, children: [_jsx("span", { children: "\u26A0\uFE0F" }), _jsx("p", { style: { margin: 0 }, children: errorMessage })] })), uploadState === 'idle' && (_jsxs(_Fragment, { children: [_jsx("input", { ref: fileInputRef, type: "file", accept: ".pdf,.jpg,.jpeg,.png,.webp", style: { display: 'none' }, onChange: handleInputChange }), _jsxs("div", { role: "button", tabIndex: 0, onDrop: handleDrop, onDragOver: (e) => { e.preventDefault(); setIsDragOver(true); }, onDragLeave: () => setIsDragOver(false), onClick: () => fileInputRef.current?.click(), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
                            fileInputRef.current?.click(); }, style: {
                            border: `2px dashed ${isDragOver ? '#1a2744' : '#4a9ad4'}`,
                            borderRadius: 20, padding: '48px 32px',
                            textAlign: 'center', cursor: 'pointer', marginBottom: 14,
                            background: isDragOver ? '#eef6fd' : '#f8fbff',
                            transition: 'all 0.18s',
                        }, children: [_jsx("div", { style: { fontSize: 44, marginBottom: 14 }, children: "\uD83D\uDCE4" }), _jsx("p", { style: { fontSize: 17, fontWeight: 800, color: '#1a2744', margin: '0 0 6px' }, children: "Upload your payment receipt" }), _jsxs("p", { style: { fontSize: 14, color: '#717182', margin: '0 0 6px' }, children: ["Drag & drop, or ", _jsx("span", { style: { color: '#4a9ad4', fontWeight: 700 }, children: "browse files" })] }), _jsx("p", { style: { fontSize: 12, color: '#a3a3a3', margin: 0 }, children: "PDF, JPG, PNG \u00B7 Max 10 MB" })] })] })), isUploading && (_jsxs("div", { style: {
                    border: '2px dashed #4a9ad4', borderRadius: 20,
                    padding: '40px 32px', textAlign: 'center', marginBottom: 14,
                    background: 'linear-gradient(135deg,#eef6fd,#f0f8ff)',
                }, children: [_jsx("div", { style: { fontSize: 44, marginBottom: 12 }, children: "\u23F3" }), _jsx("p", { style: { fontSize: 16, fontWeight: 700, color: '#1a2744', margin: '0 0 14px' }, children: "Uploading receipt..." }), _jsx("div", { style: { height: 6, background: '#c8dff4', borderRadius: 100, maxWidth: 240, margin: '0 auto 8px', overflow: 'hidden' }, children: _jsx("div", { style: { height: '100%', background: '#4a9ad4', borderRadius: 100, width: `${Math.min(uploadProgress, 100)}%`, transition: 'width 0.2s' } }) }), _jsxs("span", { style: { fontSize: 13, fontWeight: 700, color: '#4a9ad4' }, children: [Math.min(uploadProgress, 100), "%"] })] })), uploadState === 'uploaded' && uploadedFile && (_jsxs("div", { style: {
                    border: '2px solid rgba(5,77,40,0.25)', borderRadius: 20,
                    background: '#e6f4ec', padding: '18px 20px',
                    display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
                }, children: [_jsx("div", { style: {
                            width: 52, height: 52, background: '#fff', borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 24, flexShrink: 0,
                            boxShadow: 'rgba(26,39,68,0.10) 0 0 0 1px',
                        }, children: "\uD83D\uDCC4" }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: { fontSize: 15, fontWeight: 700, color: '#1a2744', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: uploadedFile.name }), _jsx("p", { style: { fontSize: 13, color: '#717182', margin: 0 }, children: uploadedFile.sizeLabel })] }), _jsx("div", { style: { width: 32, height: 32, borderRadius: '50%', background: '#054d28', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, flexShrink: 0 }, children: "\u2713" }), _jsx("button", { type: "button", onClick: () => { setUploadedFile(null); setUploadState('idle'); setUploadProgress(0); }, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#d03238', fontWeight: 600, flexShrink: 0 }, children: "Remove" })] })), _jsx("textarea", { value: note, onChange: (e) => setNote(e.target.value), placeholder: "Optional: Add a note (e.g. transaction reference number)", rows: 3, maxLength: 500, style: {
                    width: '100%', boxSizing: 'border-box',
                    borderRadius: 14, border: '1.5px solid rgba(26,39,68,0.15)',
                    background: '#fff', padding: '14px 16px',
                    fontSize: 14, color: '#1a2744', resize: 'none', outline: 'none',
                    fontFamily: 'inherit', marginBottom: 14,
                } }), _jsx("button", { type: "button", onClick: handleSubmit, disabled: !uploadedFile || isUploading || isSubmitting, style: {
                    width: '100%', height: 56, borderRadius: 100,
                    background: 'linear-gradient(135deg,#1a2744,#2d4a8a)',
                    color: '#fff', border: 'none', fontSize: 16, fontWeight: 800,
                    cursor: !uploadedFile || isUploading || isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: !uploadedFile || isUploading || isSubmitting ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: '0 4px 20px rgba(26,39,68,0.25)',
                }, children: isSubmitting ? _jsxs(_Fragment, { children: [_jsx(Spinner, {}), "Submitting..."] }) : 'Submit Receipt' }), _jsx("div", { style: { textAlign: 'center', marginTop: 16 }, children: _jsx("button", { type: "button", onClick: onBack, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#717182', fontWeight: 500 }, children: "\u2190 Pay by card instead" }) })] }));
}
// ---------------------------------------------------------------------------
// SuccessView
// ---------------------------------------------------------------------------
function SuccessView({ cohortTitle }) {
    const navigate = useNavigate();
    return (_jsx("div", { style: { maxWidth: 480, margin: '60px auto 0', textAlign: 'center' }, children: _jsxs("div", { style: {
                background: '#fff', borderRadius: 24, padding: '56px 40px',
                boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px, rgba(26,39,68,0.06) 0 8px 32px',
            }, children: [_jsx("div", { style: {
                        width: 80, height: 80, borderRadius: '50%', background: '#e6f4ec',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 36, margin: '0 auto 24px',
                    }, children: "\u2713" }), _jsx("h2", { style: { fontSize: 28, fontWeight: 900, color: '#1a2744', marginBottom: 10 }, children: "You're enrolled!" }), _jsxs("p", { style: { fontSize: 15, color: '#717182', lineHeight: 1.65, marginBottom: 32 }, children: ["Your payment was successful. Welcome to ", cohortTitle, ". Check your email for access details."] }), _jsx("button", { type: "button", onClick: () => navigate('/student/dashboard'), style: {
                        padding: '13px 32px', borderRadius: 100,
                        background: 'linear-gradient(135deg,#4a9ad4,#2d7ab8)',
                        color: '#fff', fontSize: 15, fontWeight: 800, border: 'none',
                        cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,154,212,0.35)',
                    }, children: "Go to My Courses \u2192" })] }) }));
}
// ---------------------------------------------------------------------------
// LoadingState / ErrorState
// ---------------------------------------------------------------------------
function LoadingState() {
    return (_jsx("div", { style: { minHeight: '100vh', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx("div", { style: {
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid rgba(26,39,68,0.10)', borderTopColor: '#4a9ad4',
                animation: 'spin 0.7s linear infinite',
            } }) }));
}
function ErrorState({ message, onRetry }) {
    return (_jsxs("div", { style: { minHeight: '100vh', background: '#f8f9fb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }, children: [_jsx("p", { style: { fontSize: 18, fontWeight: 700, color: '#1a2744' }, children: message }), _jsx("button", { type: "button", onClick: onRetry, style: {
                    padding: '10px 24px', borderRadius: 100,
                    background: '#4a9ad4', color: '#0d1a3a',
                    fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                }, children: "Try again" })] }));
}
// ---------------------------------------------------------------------------
// CheckoutPage — root
// ---------------------------------------------------------------------------
export default function CheckoutPage() {
    const { slug = '' } = useParams();
    const [searchParams] = useSearchParams();
    const paymentPlanId = searchParams.get('plan') ?? 'default';
    const [cohort, setCohort] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [status, setStatus] = useState('loading_cohort');
    const [tab, setTab] = useState('full');
    const [view, setView] = useState('checkout');
    const [declined, setDeclined] = useState(false);
    const [sessionData, setSessionData] = useState(null);
    useEffect(() => {
        let cancelled = false;
        async function load() {
            setStatus('loading_cohort');
            setLoadError(null);
            try {
                const data = await fetchCohortBySlug(slug);
                if (cancelled)
                    return;
                if (!data) {
                    setLoadError('Course not found.');
                    return;
                }
                setCohort(data);
                setStatus('ready');
            }
            catch {
                if (!cancelled)
                    setLoadError('Failed to load course. Please try again.');
            }
        }
        load();
        return () => { cancelled = true; };
    }, [slug]);
    const handleTabChange = (nextTab) => {
        setTab(nextTab);
        setSessionData(null);
        setDeclined(false);
        setStatus('ready');
    };
    const handleInitiatePayment = async () => {
        if (!cohort)
            return;
        setStatus('creating_session');
        setDeclined(false);
        try {
            const data = tab === 'full'
                ? await createOneTimeCheckout(cohort.id, paymentPlanId)
                : await createInstallmentCheckout(cohort.id, paymentPlanId);
            setSessionData(data);
            setStatus('stripe_stub');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Payment setup failed';
            if (msg.toLowerCase().includes('declined'))
                setDeclined(true);
            setStatus('ready');
        }
    };
    const handleConfirmStubPayment = () => {
        window.alert('Stripe Elements requires npm install of @stripe/react-stripe-js.\n\n' +
            'In production, replace this stub with stripe.confirmCardPayment(clientSecret).');
        setStatus('success');
    };
    if (status === 'loading_cohort')
        return _jsx(LoadingState, {});
    if (loadError || !cohort) {
        return (_jsx(ErrorState, { message: loadError ?? 'Course not found.', onRetry: () => { setLoadError(null); setStatus('loading_cohort'); setCohort(null); } }));
    }
    if (status === 'success') {
        return (_jsxs("div", { style: { minHeight: '100vh', background: '#f8f9fb' }, children: [_jsx(CheckoutNav, { backSlug: slug }), _jsx(SuccessView, { cohortTitle: cohort.title })] }));
    }
    return (_jsxs("div", { style: { minHeight: '100vh', background: '#f8f9fb' }, children: [_jsx(CheckoutNav, { backSlug: slug }), _jsx("style", { children: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .checkout-layout { flex-direction: column !important; }
          .checkout-summary { width: 100% !important; position: static !important; }
          .checkout-nav-inner { padding: 0 16px !important; }
          .checkout-page-pad { padding: 20px 16px 48px !important; }
        }
      ` }), _jsx("div", { className: "checkout-page-pad", style: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }, children: view === 'manual' ? (_jsx(ManualReceiptView, { cohort: cohort, cohortId: cohort.id, paymentPlanId: paymentPlanId, onBack: () => setView('checkout') })) : (
                /* Two-column layout */
                _jsxs("div", { className: "checkout-layout", style: {
                        display: 'flex',
                        gap: 32,
                        alignItems: 'flex-start',
                    }, children: [_jsx("div", { style: { flex: 1, minWidth: 0 }, children: _jsx(CheckoutForm, { cohort: cohort, tab: tab, onTabChange: handleTabChange, onSwitchToManual: () => setView('manual'), status: status, declined: declined, sessionData: sessionData, onInitiatePayment: handleInitiatePayment, onConfirmStubPayment: handleConfirmStubPayment }) }), _jsx("div", { className: "checkout-summary", style: { width: 360, flexShrink: 0, position: 'sticky', top: 88 }, children: _jsx(OrderSummaryCard, { cohort: cohort, tab: tab, installmentAmount: sessionData && 'installmentAmount' in sessionData
                                    ? sessionData.installmentAmount
                                    : undefined }) })] })) })] }));
}
