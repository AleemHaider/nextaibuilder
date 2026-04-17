import { useEffect } from 'react'

interface UsePageMetaOptions {
  title: string
  description?: string
  ogTitle?: string
  ogDescription?: string
}

const DEFAULT_TITLE = 'Product Builder Academy'
const DEFAULT_DESCRIPTION = 'Build products faster with AI'

function setMetaTag(name: string, content: string, property = false) {
  const attr = property ? 'property' : 'name'
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeMetaTag(name: string, property = false) {
  const attr = property ? 'property' : 'name'
  const el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (el) el.removeAttribute('content')
}

/**
 * Sets document.title and injects/updates meta tags on mount.
 * Restores defaults on unmount.
 */
export function usePageMeta({
  title,
  description,
  ogTitle,
  ogDescription,
}: UsePageMetaOptions): void {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    if (description) setMetaTag('description', description)
    if (ogTitle) setMetaTag('og:title', ogTitle, true)
    if (ogDescription) setMetaTag('og:description', ogDescription, true)

    return () => {
      document.title = previousTitle || DEFAULT_TITLE
      if (description) setMetaTag('description', DEFAULT_DESCRIPTION)
      if (ogTitle) removeMetaTag('og:title', true)
      if (ogDescription) removeMetaTag('og:description', true)
    }
  }, [title, description, ogTitle, ogDescription])
}
