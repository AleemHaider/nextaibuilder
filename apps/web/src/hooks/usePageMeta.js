// FIR-153 — SEO meta tags hook
import { useEffect } from 'react';
export function usePageMeta({ title, description }) {
    useEffect(() => {
        document.title = title ? `${title} | nextaibuilder` : 'nextaibuilder';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && description) {
            metaDesc.setAttribute('content', description);
        }
    }, [title, description]);
}
