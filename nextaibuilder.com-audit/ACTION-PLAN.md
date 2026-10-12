# Action plan: nextaibuilder.com

## Done (2026-10-11)
- Sitemap cleaned (44 → 11 URLs). noindex on private, duplicate and lesson pages. Canonicals on archives.
- Unique titles and descriptions. Full JSON-LD (WebSite, Organization, FAQPage, Course, Article,
  Breadcrumbs, Person).
- Security headers; XML-RPC off; old-URL 301s; curated llms.txt.
- Lighthouse 99–100 on all tested pages (WebP images, asset trimming, 1-year caching).

## Critical: you, this week
1. Verify the domain in Google Search Console and Bing Webmaster Tools; submit /wp-sitemap.xml.
2. Fix outgoing email (Google Workspace SMTP or an SPF update) before relying on sign-in codes.

## High: weeks 2–3
3. Rewrite the About page with your real bio, credentials, photo and LinkedIn (E-E-A-T).
4. Add social profile URLs to your WordPress/Tutor profile; they flow into the Person schema.
5. Upload real course images.

## Medium: month 2
6. Publish 4–6 answer-first guides targeting "Claude API course", "AI agent course", "Claude Code
   tutorial" and "build an AI product".
7. Add real student projects and testimonials with outcomes.

## Ongoing
8. Re-run the audit after content changes: `apps/wordpress/tools/ui-audit` (UI) plus this SEO crawl.
9. Watch Search Console coverage. Lesson, cart and account pages should show "Excluded by noindex", which is
   intended.
