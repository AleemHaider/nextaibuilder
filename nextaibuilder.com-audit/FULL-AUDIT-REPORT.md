# nextaibuilder.com: SEO + GEO audit (2026-10-11)

Site: https://nextaibuilder.com (WordPress on Hostinger, block theme `nextaibuilder` + plugin `nab-core`).
Business type: online education / course provider (live cohorts + self-paced courses).

## Health score

| Category (weight) | Before | After |
|---|---|---|
| Technical SEO (22%) | 62 | 97 |
| Content quality (23%) | 70 | 70 |
| On-page SEO (20%) | 66 | 96 |
| Schema (10%) | 45 | 95 |
| Performance (10%) | 87 | 99 |
| AI search readiness (10%) | 60 | 95 |
| Images (5%) | 70 | 98 |
| **Overall** | **~66** | **~90** |

Lighthouse (live, after): Home 99/100/100/100 mobile, 100/100/100/100 desktop; course page 99/100/100/100 mobile
(was 78 performance, LCP 5.3 s → 1.8 s); guide 99/100/100/100 mobile. CLS 0, TBT 0 ms everywhere.

The content score is the only one I can't raise from code. It needs your real material (see Remaining).

## Fixed

### Technical
- XML sitemap went from 44 URLs to 11. It listed cart, checkout, my-account, dashboard, student-registration,
  duplicate cart-2/checkout-2, setup, sign-in, WooCommerce /product/ duplicates and the shop page (which
  redirect), the uncategorized product category, the author archive and 20 member-only lesson pages. Now it
  lists only canonical 200 pages and adds the /courses/ catalog.
- noindex,follow on lessons, products, product taxonomies, author/search/404 pages, transactional and student
  pages, and the free-preview/certificates/notifications/live-sessions/book-a-call/verify routes.
- Canonical tags added to the home page, /courses/ (`?format=` filters point to /courses/) and the
  /guides/ and /resources/ archives.
- 301s from the old site: /sitemap.xml → /wp-sitemap.xml; /login, /signin → /sign-in/; /register,
  /signup → /courses/; /cohorts → live courses; /pricing, /curriculum → home sections. The existing 301s
  (old /guides/*.html and /resources/*.html, shop and product URLs) were verified.
- Security headers: HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options and Permissions-Policy.
  X-Powered-By (PHP version) removed. XML-RPC disabled. http → https 301 in place.
- Hostinger's auto-generated llms.txt (which listed cart, checkout and account pages) turned off. The
  plugin's curated /llms.txt now serves instead.

### On-page
- Distinct, keyword-led titles: home "Claude AI Course: Build & Ship AI Products – nextaibuilder"; catalog
  "AI Product & Claude API Courses"; Guides and Resources archives; course pages now differ
  ("… (Live Cohort)" vs "… (Self-Paced)"). Before, both courses had the identical title.
- Course meta descriptions went from 66–71 to about 155 characters (format, what's included, price).
  Resources, Guides and Apply now have their own descriptions.

### Structured data (JSON-LD)
- Home: WebSite, EducationalOrganization (logo, image, founder, knowsAbout), FAQPage (7 Q&As that match the
  visible FAQ), Person (instructor).
- Courses: Course with provider, inLanguage, image, teaches, syllabusSections (per week), offers with
  availability, and a CourseInstance (Online, workload, weekly schedule, instructor). Plus BreadcrumbList.
- Articles: author Person, publisher with logo, image, mainEntityOfPage. Plus BreadcrumbList.
- About: AboutPage + Person.
- No ratings or reviews markup. There is no real review data yet, and fabricated ratings would break
  Google's policies.

### Performance and images
- Course covers 340 KB PNG → 14 KB WebP; instructor 240 KB → 7 KB; testimonial photos up to 118 KB → 4 KB.
- The course hero image loads with fetchpriority=high.
- Tutor LMS and WooCommerce CSS/JS (about 160 KB including React and jQuery UI) no longer load on marketing
  pages for visitors.
- Static assets cached for 1 year (they were cached for 7 days).

### AI search (GEO)
- Server-rendered content (1,229 words on the home page without JavaScript).
- GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot and
  Perplexity-User all get a 200 (none are blocked).
- /llms.txt now holds the course facts (format, length, price, weekly syllabus), key pages, guides and the
  FAQ, so AI answer engines can cite accurate facts.
- FAQ and Course schema give answer engines structured, quotable facts.

## Remaining (needs you)
1. **Add the site to Google Search Console and Bing Webmaster Tools** (owner verification), then submit
   https://nextaibuilder.com/wp-sitemap.xml. The old site's Search Console property can be reused for the
   domain.
2. **Content depth.** This is the biggest lever left.
   - About page: 228 words. Add Aleem's real bio, credentials, photo and LinkedIn link; this is the E-E-A-T
     signal for an education site.
   - Only 2 articles. Publish more answer-first guides, for example "Claude API vs …", "How to build an AI
     agent with MCP" and "Claude Code tutorial".
   - Add real student projects and outcomes when available.
3. **Real instructor photo and social profiles.** Add them in the WordPress profile (LinkedIn, X, GitHub).
   The Person schema's sameAs fills in automatically.
4. **Course image.** Upload a real featured image per course; it replaces the generated cover in
   og:image and schema.
5. **Optional AI policy.** Choose whether AI models may train on your content (robots.txt named groups or a
   Content-Signal line). Search and answer engines are currently allowed, as is training (default).
6. **Email deliverability.** Your SPF only allows Google. Mail sent by the site from Hostinger can land in
   spam, which affects sign-in codes and student email. Fix: set WordPress to send through Google Workspace
   SMTP, or add Hostinger to SPF.
