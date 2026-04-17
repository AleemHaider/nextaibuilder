import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-158 — Student manual receipt upload page
import { useCallback, useEffect, useRef, useState, } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchCohortBySlug, submitManualPaymentRequest, } from '../lib/api';
import { cn } from '../lib/utils';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_NOTE_CHARS = 500;
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ACCEPTED_ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,application/pdf';
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
function formatFileSize(bytes) {
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function getFileTypeLabel(mime) {
    if (mime === 'application/pdf')
        return 'PDF';
    if (mime === 'image/jpeg')
        return 'JPG';
    if (mime === 'image/png')
        return 'PNG';
    if (mime === 'image/webp')
        return 'WEBP';
    return 'FILE';
}
// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
function Spinner({ className }) {
    return (_jsx("div", { className: cn('w-5 h-5 rounded-full border-[3px]', 'border-[rgba(13,26,58,0.3)] border-t-[#0d1a3a]', 'animate-spin', className), "aria-hidden": "true" }));
}
// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function ManualPaymentNav({ backSlug }) {
    return (_jsxs("nav", { className: cn('h-[72px] bg-white flex items-center px-20', 'shadow-[inset_0_-1px_0_rgba(26,39,68,0.12)]'), "aria-label": "Manual payment navigation", children: [_jsx("span", { className: "text-[22px] font-black text-[#1a2744]", children: "nextaibuilder" }), _jsx(Link, { to: `/courses/${backSlug}`, className: cn('ml-auto flex items-center gap-1.5 text-[14px] text-[#717182]', 'hover:text-[#1a2744] transition-colors no-underline'), children: "\u2190 Back to course" })] }));
}
// ---------------------------------------------------------------------------
// CohortHeaderCard
// ---------------------------------------------------------------------------
function CohortHeaderCard({ cohort }) {
    const priceLabel = `Pay in full · ${formatMoney(cohort.price)}`;
    return (_jsxs("div", { className: cn('bg-white rounded-[20px] p-7 mb-5', 'shadow-[rgba(26,39,68,0.12)_0_0_0_1px]', 'flex items-center gap-5'), children: [_jsx("div", { className: "w-20 h-16 rounded-[12px] flex-shrink-0", style: {
                    background: cohort.coverGradient ?? 'linear-gradient(135deg, #cc4a00, #ff8c5a)',
                }, "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("div", { className: "text-[12px] text-[#717182] mb-1", children: "Enrolling in" }), _jsx("div", { className: "text-[18px] font-bold text-[#1a2744] mb-1", children: cohort.title }), _jsx("div", { className: "text-[14px] font-semibold text-[#ff8c5a]", children: priceLabel })] })] }));
}
// ---------------------------------------------------------------------------
// BankInstructionsCard
// ---------------------------------------------------------------------------
function BankInstructionsCard({ amount }) {
    return (_jsxs("div", { className: cn('bg-[#eef6fd] border-l-4 border-[#4a9ad4]', 'rounded-r-[16px] p-5 mb-5'), children: [_jsx("div", { className: "text-[15px] font-bold text-[#1a2744] mb-3", children: "Bank Transfer Instructions" }), [
                { label: 'Bank name', value: 'HSBC Pakistan' },
                { label: 'Account name', value: 'NextAI Builder Ltd' },
                { label: 'Account number', value: 'PK36 SCBL 0000 0011 2345 6700' },
                { label: 'Amount', value: `${formatMoney(amount)} USD equivalent` },
            ].map(({ label, value }) => (_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-[13px] text-[#717182] font-medium", children: label }), _jsx("span", { className: cn('font-mono text-[14px] font-bold text-[#1a2744]', 'bg-[rgba(26,39,68,0.05)] px-2.5 py-1 rounded-[6px]'), children: value })] }, label))), _jsx("p", { className: "text-[13px] text-[#717182] mt-3 leading-relaxed", children: "Transfer the amount shown above and upload your receipt below. Access will be activated within 24 hours of approval." })] }));
}
function UploadZone({ onFileSelected, dragActive, onDragEnter, onDragOver, onDragLeave, onDrop, inputRef, error, }) {
    function handleInputChange(e) {
        const file = e.target.files?.[0];
        if (file)
            onFileSelected(file);
        // Reset input so re-selecting same file triggers onChange
        e.target.value = '';
    }
    return (_jsxs("div", { className: "mb-5", children: [_jsxs("div", { role: "button", tabIndex: 0, "aria-label": "Upload payment receipt \u2014 click or drag and drop", onClick: () => inputRef.current?.click(), onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                        inputRef.current?.click();
                }, onDragEnter: onDragEnter, onDragOver: onDragOver, onDragLeave: onDragLeave, onDrop: onDrop, className: cn('border-2 border-dashed rounded-[24px]', 'bg-[#f8fbff] px-10 py-14 text-center cursor-pointer', 'transition-all duration-150', dragActive
                    ? 'border-[#1a2744] bg-[#eef6fd] scale-[1.01]'
                    : error
                        ? 'border-[#d03238] bg-[#fef2f2]'
                        : 'border-[#4a9ad4] hover:bg-[#eef6fd] hover:border-[#1a2744]', 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4a9ad4]/40'), children: [_jsx("div", { className: "text-[48px] mb-4", "aria-hidden": "true", children: "\uD83D\uDCE4" }), _jsx("div", { className: "text-[18px] font-bold text-[#1a2744] mb-2", children: "Upload your payment receipt" }), _jsx("div", { className: "text-[15px] text-[#717182] mb-1.5", children: "Drag & drop your receipt here, or" }), _jsx("span", { className: "text-[15px] font-semibold text-[#4a9ad4]", children: "Browse files" }), _jsx("div", { className: "text-[12px] text-[#a3a3a3] mt-3", children: "Accepted formats: PDF, JPG, PNG \u00B7 Max size: 10MB" })] }), error && (_jsx("p", { className: "text-[13px] text-[#d03238] font-medium mt-2 ml-1", role: "alert", children: error })), _jsx("input", { ref: inputRef, type: "file", accept: ACCEPTED_ACCEPT_ATTR, className: "sr-only", "aria-hidden": "true", tabIndex: -1, onChange: handleInputChange })] }));
}
// ---------------------------------------------------------------------------
// UploadingZone — progress state
// ---------------------------------------------------------------------------
function UploadingZone({ progress }) {
    return (_jsxs("div", { className: cn('border-2 border-dashed border-[#4a9ad4] rounded-[24px] mb-5', 'px-10 py-14 text-center', 'bg-gradient-to-r from-[#eef6fd] via-[#f0f8ff] to-[#eef6fd]', 'bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]'), style: {
            backgroundSize: '200% 100%',
            animation: 'shimmer-upload 1.5s infinite',
        }, "aria-live": "polite", "aria-label": `Uploading receipt, ${progress}% complete`, children: [_jsx("style", { children: `
        @keyframes shimmer-upload {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      ` }), _jsx("div", { className: "text-[48px] mb-4", "aria-hidden": "true", children: "\u23F3" }), _jsx("div", { className: "text-[18px] font-bold text-[#1a2744] mb-3", children: "Uploading receipt..." }), _jsx("div", { className: "h-1.5 bg-[#c8dff4] rounded-full mx-auto max-w-[200px] mb-2", children: _jsx("div", { className: "h-full bg-[#4a9ad4] rounded-full transition-all duration-300", style: { width: `${progress}%` } }) }), _jsxs("div", { className: "text-[14px] font-semibold text-[#4a9ad4]", children: [progress, "%"] })] }));
}
function UploadedFilePreview({ uploadedFile, onRemove }) {
    return (_jsxs("div", { className: cn('border-2 border-[rgba(5,77,40,0.3)] rounded-[24px]', 'bg-[#e6f4ec] p-6 flex items-center gap-4 mb-5'), children: [_jsx("div", { className: cn('w-16 h-16 bg-white rounded-[12px] flex items-center justify-center', 'shadow-[rgba(26,39,68,0.12)_0_0_0_1px] flex-shrink-0 overflow-hidden'), children: uploadedFile.previewUrl ? (_jsx("img", { src: uploadedFile.previewUrl, alt: "Receipt preview", className: "w-full h-full object-cover rounded-[12px]" })) : (_jsx("span", { className: "text-[28px]", "aria-hidden": "true", children: "\uD83D\uDCC4" })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[16px] font-bold text-[#1a2744] truncate mb-0.5", children: uploadedFile.label }), _jsxs("div", { className: "text-[13px] text-[#717182]", children: [uploadedFile.sizeLabel, " \u00B7 ", uploadedFile.typeLabel] })] }), _jsx("div", { className: cn('w-8 h-8 rounded-full bg-[#054d28] flex items-center justify-center', 'text-white text-[16px] font-bold flex-shrink-0'), "aria-label": "File selected successfully", children: "\u2713" }), _jsx("button", { type: "button", onClick: onRemove, className: cn('text-[13px] font-semibold text-[#d03238] bg-none border-none cursor-pointer', 'hover:opacity-70 transition-opacity ml-3 flex-shrink-0'), "aria-label": `Remove ${uploadedFile.label}`, children: "Remove" })] }));
}
function PendingStatusCard({ requestId, onGoToCourses }) {
    return (_jsxs("div", { className: cn('bg-white rounded-[24px] p-12 text-center', 'shadow-[rgba(26,39,68,0.12)_0_0_0_1px]'), children: [_jsx("div", { className: "text-[64px] mb-5", "aria-hidden": "true", children: "\u23F3" }), _jsxs("div", { className: cn('inline-flex items-center gap-2 text-[15px] font-bold', 'px-5 py-2.5 rounded-full bg-[#fff8e6] text-[#8a5a00] mb-6'), children: [_jsx("span", { "aria-hidden": "true", children: "\uD83D\uDD50" }), " Under Review"] }), _jsx("div", { className: "text-[28px] font-extrabold text-[#1a2744] mb-2", children: "Receipt submitted!" }), _jsx("div", { className: "text-[16px] text-[#717182] leading-relaxed mb-4 max-w-sm mx-auto", children: "Your payment receipt is being reviewed by our team. You'll receive an email confirmation within 24 hours once approved." }), _jsxs("div", { className: "text-[13px] text-[#a3a3a3] mb-8", children: ["Reference:", ' ', _jsx("span", { className: "font-mono font-bold text-[#1a2744]", children: requestId })] }), _jsx("button", { type: "button", onClick: onGoToCourses, className: cn('px-9 py-4 rounded-full font-bold text-[16px] cursor-pointer border-none', 'bg-[#f8f9fb] text-[#1a2744] border-[1.5px] border-[rgba(26,39,68,0.15)]', 'hover:bg-[#eef6fd] transition-colors'), children: "Browse Courses" })] }));
}
function ErrorStatusCard({ message, onRetry }) {
    return (_jsxs("div", { className: cn('bg-white rounded-[24px] p-12 text-center', 'shadow-[rgba(26,39,68,0.12)_0_0_0_1px]'), children: [_jsx("div", { className: "text-[64px] mb-5", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("div", { className: cn('inline-flex items-center gap-2 text-[15px] font-bold', 'px-5 py-2.5 rounded-full bg-[#fdeaeb] text-[#d03238] mb-6'), children: "Submission Failed" }), _jsx("div", { className: "text-[28px] font-extrabold text-[#1a2744] mb-2", children: "Something went wrong" }), _jsxs("div", { className: cn('bg-[#fdeaeb] rounded-[14px] px-5 py-4 mb-8 text-left max-w-sm mx-auto'), children: [_jsx("div", { className: "text-[12px] font-bold text-[#d03238] uppercase tracking-wide mb-1.5", children: "Error" }), _jsx("div", { className: "text-[15px] text-[#d03238] leading-relaxed", children: message })] }), _jsx("button", { type: "button", onClick: onRetry, className: cn('px-9 py-4 rounded-full font-bold text-[16px] cursor-pointer border-none', 'bg-[#d03238] text-white hover:opacity-90 transition-opacity'), children: "Try Again" })] }));
}
// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function ManualPaymentPage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    // ---- Data ----
    const [cohort, setCohort] = useState(null);
    const [pageState, setPageState] = useState('loading_cohort');
    const [cohortError, setCohortError] = useState(null);
    // ---- File upload ----
    const [uploadedFile, setUploadedFile] = useState(null);
    const [fileError, setFileError] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const inputRef = useRef(null);
    const progressIntervalRef = useRef(null);
    // ---- Form fields ----
    const [note, setNote] = useState('');
    // ---- Result ----
    const [requestId, setRequestId] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    // Cleanup object URLs on unmount to avoid memory leaks
    const previewUrlRef = useRef(null);
    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, []);
    // Fetch cohort on mount
    useEffect(() => {
        if (!slug) {
            setCohortError('No cohort slug provided.');
            setPageState('error_cohort');
            return;
        }
        let cancelled = false;
        async function load() {
            try {
                const data = await fetchCohortBySlug(slug);
                if (cancelled)
                    return;
                if (!data) {
                    setCohortError('Course not found.');
                    setPageState('error_cohort');
                }
                else {
                    setCohort(data);
                    setPageState('idle');
                }
            }
            catch {
                if (cancelled)
                    return;
                setCohortError('Failed to load course details. Please refresh and try again.');
                setPageState('error_cohort');
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [slug]);
    // ---- File validation + selection ----
    const handleFileSelected = useCallback((file) => {
        setFileError(null);
        if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
            setFileError('Invalid file type. Please upload a PDF, JPG, or PNG.');
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            setFileError('File is too large. Maximum size is 10 MB.');
            return;
        }
        // Revoke previous preview URL if any
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
        }
        let previewUrl = null;
        if (file.type !== 'application/pdf') {
            previewUrl = URL.createObjectURL(file);
            previewUrlRef.current = previewUrl;
        }
        setUploadedFile({
            file,
            previewUrl,
            label: file.name,
            sizeLabel: formatFileSize(file.size),
            typeLabel: getFileTypeLabel(file.type),
        });
    }, []);
    const handleRemoveFile = useCallback(() => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
        }
        setUploadedFile(null);
        setFileError(null);
    }, []);
    // ---- Drag handlers ----
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    }, []);
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);
    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    }, []);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file)
            handleFileSelected(file);
    }, [handleFileSelected]);
    // ---- Submit ----
    async function handleSubmit() {
        if (!uploadedFile || !cohort)
            return;
        setPageState('uploading');
        setUploadProgress(0);
        // Simulate progress while the real upload runs
        progressIntervalRef.current = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 90) {
                    if (progressIntervalRef.current)
                        clearInterval(progressIntervalRef.current);
                    return 90;
                }
                return prev + Math.floor(Math.random() * 12) + 5;
            });
        }, 300);
        try {
            const formData = new FormData();
            formData.append('cohortId', cohort.id);
            formData.append('file', uploadedFile.file);
            if (note.trim())
                formData.append('note', note.trim());
            const result = await submitManualPaymentRequest(formData);
            if (progressIntervalRef.current)
                clearInterval(progressIntervalRef.current);
            setUploadProgress(100);
            // Brief pause so 100% is visible before transition
            await new Promise((resolve) => setTimeout(resolve, 400));
            setRequestId(result.requestId);
            setPageState('pending');
        }
        catch (err) {
            if (progressIntervalRef.current)
                clearInterval(progressIntervalRef.current);
            setUploadError(err instanceof Error ? err.message : 'An unexpected error occurred.');
            setPageState('error_upload');
        }
    }
    function handleRetry() {
        setUploadError(null);
        setUploadedFile(null);
        setNote('');
        setPageState('idle');
    }
    // ---- Loading skeleton ----
    if (pageState === 'loading_cohort') {
        return (_jsxs("div", { className: "min-h-screen bg-[#f8f9fb]", children: [_jsx("nav", { className: "h-[72px] bg-white shadow-[inset_0_-1px_0_rgba(26,39,68,0.12)] flex items-center px-20", children: _jsx("span", { className: "text-[22px] font-black text-[#1a2744]", children: "nextaibuilder" }) }), _jsx("div", { className: "flex items-center justify-center min-h-[calc(100vh-72px)]", children: _jsx(Spinner, { className: "w-10 h-10 border-4 border-[rgba(26,39,68,0.1)] border-t-[#4a9ad4]" }) })] }));
    }
    // ---- Cohort error ----
    if (pageState === 'error_cohort' || !cohort) {
        return (_jsxs("div", { className: "min-h-screen bg-[#f8f9fb]", children: [_jsx("nav", { className: "h-[72px] bg-white shadow-[inset_0_-1px_0_rgba(26,39,68,0.12)] flex items-center px-20", children: _jsx("span", { className: "text-[22px] font-black text-[#1a2744]", children: "nextaibuilder" }) }), _jsxs("div", { className: "flex flex-col items-center justify-center min-h-[calc(100vh-72px)] gap-4 px-6 text-center", children: [_jsx("div", { className: "text-[48px]", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("div", { className: "text-[22px] font-bold text-[#1a2744]", children: cohortError ?? 'Course not found' }), _jsx(Link, { to: "/courses", className: cn('px-7 py-3 rounded-full bg-[#4a9ad4] text-[#0d1a3a]', 'text-[15px] font-bold hover:opacity-90 transition-opacity no-underline'), children: "Browse Courses" })] })] }));
    }
    const canSubmit = uploadedFile !== null && pageState === 'idle';
    return (_jsxs("div", { className: "min-h-screen bg-[#f8f9fb]", children: [_jsx(ManualPaymentNav, { backSlug: slug ?? '' }), _jsx("main", { className: "px-20 py-12", children: _jsxs("div", { className: "max-w-[640px] mx-auto", children: [(pageState === 'idle' || pageState === 'uploading') && (_jsxs(_Fragment, { children: [_jsx(CohortHeaderCard, { cohort: cohort }), _jsx(BankInstructionsCard, { amount: cohort.price }), pageState === 'uploading' ? (_jsx(UploadingZone, { progress: uploadProgress })) : uploadedFile ? (_jsx(UploadedFilePreview, { uploadedFile: uploadedFile, onRemove: handleRemoveFile })) : (_jsx(UploadZone, { onFileSelected: handleFileSelected, dragActive: dragActive, onDragEnter: handleDragEnter, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, inputRef: inputRef, error: fileError })), _jsx("textarea", { value: note, onChange: (e) => setNote(e.target.value.slice(0, MAX_NOTE_CHARS)), placeholder: "Optional: Add a note about your payment (e.g., transaction reference number)", maxLength: MAX_NOTE_CHARS, rows: 4, disabled: pageState === 'uploading', "aria-label": "Optional payment note", className: cn('w-full rounded-[16px] border-[1.5px] border-[rgba(26,39,68,0.15)]', 'bg-white px-4 py-4 text-[15px] text-[#1a2744]', 'font-sans resize-none outline-none mb-5', 'placeholder:text-[#a3a3a3]', 'focus:border-[#4a9ad4] transition-colors', pageState === 'uploading' && 'opacity-50 cursor-not-allowed') }), note.length > 0 && (_jsxs("div", { className: "text-[12px] text-[#a3a3a3] text-right -mt-4 mb-4", children: [note.length, "/", MAX_NOTE_CHARS] })), _jsx("button", { type: "button", onClick: handleSubmit, disabled: !canSubmit, "aria-disabled": !canSubmit, className: cn('w-full h-14 rounded-full font-bold text-[17px] border-none cursor-pointer', 'transition-opacity font-sans', canSubmit
                                        ? 'bg-[#4a9ad4] text-[#0d1a3a] hover:opacity-90'
                                        : 'bg-[#4a9ad4] text-[#0d1a3a] opacity-50 cursor-not-allowed', pageState === 'uploading' && 'opacity-50 cursor-not-allowed'), children: pageState === 'uploading' ? (_jsxs("span", { className: "flex items-center justify-center gap-2", children: [_jsx(Spinner, {}), " Uploading..."] })) : ('Submit Receipt') })] })), pageState === 'pending' && requestId && (_jsx(PendingStatusCard, { requestId: requestId, onGoToCourses: () => navigate('/courses') })), pageState === 'error_upload' && uploadError && (_jsx(ErrorStatusCard, { message: uploadError, onRetry: handleRetry }))] }) })] }));
}
