import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'

// Loaded only for /sdk — the terminal/build-log motif on this page needs a
// monospace face, but the rest of the app has no use for it.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

// This lives here (a server component) rather than in page.tsx (a client
// component) because Open Graph tags must be present in the server-rendered
// HTML — link-preview crawlers (WhatsApp, Slack, etc.) don't execute JS, so
// a client-side useEffect setting these tags is invisible to them.
export const metadata: Metadata = {
  // { absolute } bypasses the root layout's "%s | Product Builder Academy"
  // template — nextaibuilder is a distinct brand from the course product,
  // the two shouldn't appear stitched together in a browser tab or share card.
  title: { absolute: 'Apply: Agentic AI Engineer, nextaibuilder Sadiqabad' },
  description: 'Apply for the in-person Agentic AI Engineer program in Sadiqabad, Punjab. 6-month or 1-year tracks. Hands-on instruction, small cohorts, one deployed agent.',
  alternates: {
    canonical: 'https://sdk.nextaibuilder.com/',
  },
  openGraph: {
    type: 'website',
    url: 'https://sdk.nextaibuilder.com/',
    title: 'Apply: Agentic AI Engineer, nextaibuilder Sadiqabad',
    description: 'Apply for the in-person Agentic AI Engineer program in Sadiqabad, Punjab. 6-month or 1-year tracks.',
    images: [{ url: 'https://sdk.nextaibuilder.com/photos/studio-session.jpg', width: 1440, height: 1078 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apply: Agentic AI Engineer, nextaibuilder Sadiqabad',
    description: 'Apply for the in-person Agentic AI Engineer program in Sadiqabad, Punjab.',
    images: ['https://sdk.nextaibuilder.com/photos/studio-session.jpg'],
  },
}

// Structured data for search engines and AI answer engines (Google rich
// results, Perplexity, AI Overviews, etc). This address must stay in sync
// with whatever's entered in the Google Business Profile once that's set
// up — mismatched NAP (Name/Address/Phone) data across listings actively
// hurts local ranking, so don't let these drift apart.
const STUDIO_ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: 'Plaza No. 11, Al-Haram City, Near New Bus Stand',
  addressLocality: 'Sadiqabad',
  addressRegion: 'Punjab',
  addressCountry: 'PK',
}

// Same monthly fee on both tracks — keep in sync by hand with PRICING in
// page.tsx (that one drives the visible price on the track cards + FAQ;
// this one is what search engines and AI answer engines read directly).
const COURSE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: 'Agentic AI Engineer',
  description:
    'An in-person, cohort-based program in Sadiqabad, Punjab that trains builders to design and deploy AI agents, covering Python, LangChain, LangGraph, and n8n.',
  offers: [
    {
      '@type': 'Offer',
      price: '15000',
      priceCurrency: 'PKR',
      description: 'Standard tuition, billed monthly.',
    },
    {
      '@type': 'Offer',
      price: '12000',
      priceCurrency: 'PKR',
      description: 'Discounted tuition for the first 10 students, billed monthly.',
    },
  ],
  provider: {
    '@type': 'EducationalOrganization',
    name: 'nextaibuilder',
    url: 'https://sdk.nextaibuilder.com/',
    telephone: '+923456655181',
    address: STUDIO_ADDRESS,
  },
  hasCourseInstance: [
    {
      '@type': 'CourseInstance',
      name: '6-Month Track',
      courseMode: 'Onsite',
      courseWorkload: 'P6M',
      location: { '@type': 'Place', address: STUDIO_ADDRESS },
    },
    {
      '@type': 'CourseInstance',
      name: '1-Year Track',
      courseMode: 'Onsite',
      courseWorkload: 'P12M',
      location: { '@type': 'Place', address: STUDIO_ADDRESS },
    },
  ],
}

// Google Ads conversion tracking — only loads once NEXT_PUBLIC_GOOGLE_ADS_ID
// is actually set (see .env.example). Without it, the ad campaign can't tell
// which clicks turned into applications, and can't switch off "Maximize
// Clicks" bidding to something conversion-aware later. See README note in
// AdmissionForm's onSuccess for where the actual conversion event fires.
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

export default function SdkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={jetbrainsMono.variable}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(COURSE_JSON_LD) }}
      />
      {GOOGLE_ADS_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-ads-gtag-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ADS_ID}');`}
          </Script>
        </>
      )}
      {children}
    </div>
  )
}
