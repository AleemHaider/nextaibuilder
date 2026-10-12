# nextaibuilder.com — test cases

Run them with `node qa.mjs` (see README at the bottom). **Where** says which site a
case runs on:

- **Both**: read-only, safe on the live site.
- **Local**: creates data (users, orders, applications, uploads, emails), so it
  runs only against wp-env at http://localhost:8895.
- **Manual**: needs a person (real email inbox, real card, Google account).

Screen widths for every "all widths" case: 320, 360, 390, 414 (phones), 768
(tablet), 1024, 1280, 1440, 1920 (laptop/desktop).

## A. Every page, every screen (design)

Pages: `/`, `/courses/`, `/courses/?format=live`, both course pages, `/guides/`,
`/resources/`, the 5 articles, `/about/`, `/apply/`, `/refund-policy/`,
`/sign-in/`, `/setup/` (signed out), a 404 page.

| ID | Check | Expected | Where |
|----|-------|----------|-------|
| A1 | Page loads | HTTP 200 (404 page: 404), no PHP warnings/notices in the HTML | Both |
| A2 | No sideways scroll | `scrollWidth` equals the screen width at all widths | Both |
| A3 | Nothing spills off screen | No visible element extends past the left/right edge (code blocks scroll inside their box) | Both |
| A4 | Images | Every image loads (no broken images); each has `alt` (empty only if decorative) | Both |
| A5 | Text size | Body text ≥ 14px on phones; anything smaller only in decorative mock-ups | Both |
| A6 | Tap targets | Buttons and nav links ≥ 44×44px on phones (inline text links excluded) | Both |
| A7 | One H1 | Exactly one `<h1>` per page; headings don't skip levels | Both |
| A8 | No empty sections | No section that has a heading but no content under it | Both |
| A9 | No browser errors | No JavaScript errors or failed (4xx/5xx) requests on load | Both |
| A10 | Header | Phones and tablets (≤781px): logo, Get started and ☰ in one row. Desktop: logo, 5 links, Get started in one row | Both |
| A11 | Footer | Footer links all resolve (200) | Both |
| A12 | No demo claims | No invented reviews, projects, ratings or a placeholder cohort date on the live site | Prod |

## B. Navigation

| ID | Steps | Expected | Where |
|----|-------|----------|-------|
| B1 | Phone: tap ☰ | Menu covers the whole screen; all 5 links visible and tappable | Both |
| B2 | Phone: tap ✕ in the open menu | Menu closes, page scrolls again | Both |
| B3 | Phone: open the menu, tap "Guides" | Goes to /guides/ | Both |
| B4 | Press Esc with the menu open | Menu closes | Both |
| B5 | Scroll down any page | Header stays stuck to the top | Both |
| B6 | Every internal link on every page | Resolves to 200 (or a single 301 to a 200), never 404 | Both |
| B7 | Old URLs: `/guides/<slug>.html`, `/shop/` | 301 to the current page | Both |
| B8 | Keyboard: Tab through the homepage | First Tab shows "Skip to content"; every focused element has a visible focus ring | Both |

## C. Homepage

| ID | Steps | Expected | Where |
|----|-------|----------|-------|
| C1 | Click "Join the live cohort" (hero) | Goes to the live course page | Both |
| C2 | Click "See the curriculum" | Scrolls to the curriculum timeline | Both |
| C3 | FAQ: click each question | It opens to show the answer; clicking again closes it; 13 questions | Both |
| C4 | Pricing: "Join the live cohort", "Start self-paced" | Go to the live and recorded course pages | Both |
| C5 | Final CTA buttons | Go to the live and recorded course pages | Both |

## D. Courses and course pages

| ID | Steps | Expected | Where |
|----|-------|----------|-------|
| D1 | /courses/: tabs All / Recorded / Live | Each tab shows only that kind of course; counts match | Both |
| D2 | Course page: syllabus weeks | Each week expands/collapses; the free "Watch free" lesson opens a preview | Both |
| D3 | Course page: price | Live $3,000 (3 × $1,000); recorded $200 (3 × $67) | Both |
| D4 | Phone: scroll the course page | Sticky "Enroll now" bar appears at the bottom and does not cover content at the end | Both |
| D5 | Click "Enroll" while signed out | Goes to checkout with the course in the cart (cart page is skipped) | Local |
| D6 | Click "Enroll" for a course you already own | Blocked with a clear message; no second purchase | Local |

## E. Checkout and payments

| ID | Steps | Expected | Where |
|----|-------|----------|-------|
| E1 | Open checkout with a course | Only name, email (and phone if set) are asked; no address fields | Local |
| E2 | Pay in full by card (Stripe test card 4242…) | Order completes, student enrolled, receipt email logged | Manual (Local) |
| E3 | Choose 3 installments | First payment is ⅓ of the price; the order shows the remaining schedule | Local |
| E4 | Choose bank transfer | Order on hold; thank-you page shows bank details and a receipt upload | Local |
| E5 | Upload a receipt (PDF/JPG/PNG) | Accepted; wrong file type is rejected with a clear message | Local |
| E6 | Admin approves the receipt | Order completes, student enrolled, email logged | Local |
| E7 | Admin rejects the receipt with a reason | Student sees the reason and can upload again | Local |

## F. Sign-in and account

| ID | Steps | Expected | Where |
|----|-------|----------|-------|
| F1 | /sign-in/ shows Google, email-link and password options | All three visible and usable on phone and desktop | Both |
| F2 | Sign in with a wrong password | Clear error, stays on /sign-in/ | Local |
| F3 | Sign in with the right password | Lands on /dashboard/ (or the `redirect_to` page if local) | Local |
| F4 | `redirect_to=https://evil.example` | Ignored; lands on /dashboard/ | Local |
| F5 | Request an email sign-in link | Success message; email logged; link signs in once and expires after use | Local |
| F6 | "Continue with Google" | Google consent screen opens and returns signed in | Manual |
| F7 | Student-only pages while signed out (/dashboard/, /setup/, /notifications/, /certificates/, /live-sessions/, /book-a-call/) | Redirect to /sign-in/ with a return link (or a sign-in prompt) | Both |
| F8 | Sign out | Session ends; student pages ask to sign in again | Local |

## G. Student area (signed in, enrolled)

| ID | Steps | Expected | Where |
|----|-------|----------|-------|
| G1 | /dashboard/ | Shows the enrolled course, progress and next step; no layout issues at all widths | Local |
| G2 | Open the first lesson | Opens; next lessons are locked until the previous one is completed | Local |
| G3 | Complete all lessons | Certificate issued; appears on /certificates/ | Local |
| G4 | Certificate verify link `/verify/<code>/` | Public page confirms the certificate; a made-up code says not found | Local |
| G5 | /setup/: upload a screenshot for a step | Accepted and shown as "Checking"/"Passed" | Local |
| G6 | /notifications/ | Enrollment notification shown; mark as read clears the unread count | Local |
| G7 | /book-a-call/ | Form or booking link works; submission is logged | Local |
| G8 | Account deletion | Asks to confirm; deletes the account and signs out | Local |

## H. Forms

| ID | Steps | Expected | Where |
|----|-------|----------|-------|
| H1 | /apply/: submit empty | Browser/inline validation on name and email; nothing sent | Both (no submit on prod) |
| H2 | /apply/: submit a valid application | Success message; application saved in admin; email logged | Local |
| H3 | /apply/: invalid email | Rejected with a clear message | Local |
| H4 | Every form field has a visible label | Labels present and linked to inputs | Both |

## I. SEO and machine-readable files

| ID | Check | Expected | Where |
|----|-------|----------|-------|
| I1 | Each indexable page has a unique `<title>` and meta description | Present, unique, 70–200 characters | Both |
| I2 | Canonical tag | Present, absolute, points to the page itself | Both |
| I3 | `robots.txt`, `wp-sitemap.xml`, `llms.txt` | 200 and valid; sitemap lists every public page | Both |
| I4 | Structured data | JSON-LD parses; Course, FAQPage, Article where expected | Both |
| I5 | Social preview | `og:title`, `og:description`, `og:image` present; image loads | Both |

## J. Performance and security

| ID | Check | Expected | Where |
|----|-------|----------|-------|
| J1 | Lighthouse mobile, home and course page | Performance ≥ 90, Accessibility/Best practices/SEO ≥ 95 | Prod |
| J2 | Security headers | HSTS, X-Content-Type-Options, Referrer-Policy, frame protection present | Prod |
| J3 | http:// and www. | 301 to https://nextaibuilder.com/ | Prod |
| J4 | `/wp-json/wp/v2/users` | Does not list user accounts | Prod |
| J5 | `/?author=1` | Does not reveal a username | Prod |

## Running

```
cd apps/wordpress/tools/qa
npm install
node qa.mjs                                   # local, all automated cases
NAB_URL=https://nextaibuilder.com node qa.mjs # live site, read-only cases only
```
