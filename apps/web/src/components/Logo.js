import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const SIZES = {
    sm: { spark: 22, wordmark: 17, pill: 8, gap: 9 },
    md: { spark: 28, wordmark: 21, pill: 9, gap: 11 },
    lg: { spark: 36, wordmark: 27, pill: 10, gap: 13 },
};
export function Logo({ variant = 'light', size = 'md', style, className }) {
    const s = SIZES[size];
    const isDark = variant === 'dark';
    const pillBg = isDark ? 'rgba(74,154,212,0.15)' : '#e8f4fd';
    const dotColor = isDark ? '#7dcbff' : '#4a9ad4';
    const tagColor = isDark ? '#7dcbff' : '#1a2744';
    const wordColor = isDark ? '#ffffff' : '#1a2744';
    return (_jsxs("div", { className: className, style: {
            display: 'flex',
            alignItems: 'center',
            gap: s.gap,
            textDecoration: 'none',
            flexShrink: 0,
            ...style,
        }, children: [_jsxs("svg", { width: s.spark, height: s.spark, viewBox: "0 0 56 56", fill: "none", "aria-hidden": "true", style: { flexShrink: 0 }, children: [_jsx("rect", { x: "24", y: "0", width: "8", height: "10", fill: "#4a9ad4" }), _jsx("rect", { x: "24", y: "46", width: "8", height: "10", fill: "#4a9ad4" }), _jsx("rect", { x: "0", y: "24", width: "10", height: "8", fill: "#4a9ad4" }), _jsx("rect", { x: "46", y: "24", width: "10", height: "8", fill: "#4a9ad4" }), _jsx("rect", { x: "8", y: "8", width: "7", height: "7", fill: "#7dcbff" }), _jsx("rect", { x: "41", y: "8", width: "7", height: "7", fill: "#7dcbff" }), _jsx("rect", { x: "8", y: "41", width: "7", height: "7", fill: "#7dcbff" }), _jsx("rect", { x: "41", y: "41", width: "7", height: "7", fill: "#7dcbff" }), _jsx("rect", { x: "16", y: "10", width: "8", height: "8", fill: "#5ab4e8" }), _jsx("rect", { x: "32", y: "10", width: "8", height: "8", fill: "#5ab4e8" }), _jsx("rect", { x: "10", y: "16", width: "8", height: "8", fill: "#5ab4e8" }), _jsx("rect", { x: "38", y: "16", width: "8", height: "8", fill: "#5ab4e8" }), _jsx("rect", { x: "16", y: "38", width: "8", height: "8", fill: "#5ab4e8" }), _jsx("rect", { x: "32", y: "38", width: "8", height: "8", fill: "#5ab4e8" }), _jsx("rect", { x: "10", y: "32", width: "8", height: "8", fill: "#5ab4e8" }), _jsx("rect", { x: "38", y: "32", width: "8", height: "8", fill: "#5ab4e8" }), _jsx("rect", { x: "18", y: "18", width: "20", height: "20", fill: isDark ? 'rgba(74,154,212,0.18)' : '#e8f4fd' }), _jsx("rect", { x: "20", y: "20", width: "16", height: "16", fill: "#4a9ad4" }), _jsx("rect", { x: "22", y: "22", width: "12", height: "12", fill: "#7dcbff" }), _jsx("rect", { x: "24", y: "24", width: "8", height: "8", fill: isDark ? '#ffffff' : '#1a2744' })] }), _jsxs("div", { style: { lineHeight: 1.1 }, children: [_jsxs("div", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: pillBg,
                            borderRadius: 20,
                            padding: '2px 8px 3px',
                            marginBottom: 3,
                        }, children: [_jsx("div", { style: {
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background: dotColor,
                                    flexShrink: 0,
                                } }), _jsx("span", { style: {
                                    fontSize: s.pill,
                                    fontWeight: 700,
                                    color: tagColor,
                                    letterSpacing: '2px',
                                    textTransform: 'uppercase',
                                    fontFamily: "'Inter', sans-serif",
                                }, children: "NEXT" })] }), _jsx("div", { style: {
                            fontSize: s.wordmark,
                            fontWeight: 900,
                            color: wordColor,
                            letterSpacing: '-0.8px',
                            fontFamily: "'Inter', sans-serif",
                            lineHeight: 1,
                        }, children: "aibuilder" })] })] }));
}
