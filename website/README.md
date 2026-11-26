# WhatsApp for Salesforce — website

**Live:** https://whatsapp-for-salesforce-site.vercel.app  
**Vercel project:** `fk219s-projects/whatsapp-for-salesforce-site`

A standalone, zero-dependency marketing site for the Salesforce-native WhatsApp
workspace. It lives beside the product package, not inside `force-app`.

## Concept

**The Quiet Signal.** Enterprise messaging is noisy. The site is a quiet,
editorial system built around one idea: the conversation should stay inside the
Salesforce org that owns the customer.

- Warm mineral paper, carbon ink, and a single phosphor signal accent.
- Archivo at wide display widths, Instrument Serif for italic emphasis, IBM Plex
  Mono for instrumentation and labels.
- One continuous narrative: surface → system → record → templates → enterprise →
  access.
- A product console built entirely in HTML/CSS, not screenshots.

## Run locally

No build step is required.

```bash
cd website
npx serve .
```

Or open `index.html` directly. Fonts load from Google Fonts when online and fall
back to system stacks offline.

## Deploy

This is a static site. Deploy the folder to Vercel, Netlify, Render Static Sites,
Cloudflare Pages, or any object storage + CDN.

- Build command: none
- Output directory: `website`
- Entry point: `index.html`

## Before publishing

1. Replace `hello@example.com` with the real contact address.
2. Replace the `2027` year and `W/SF` working mark if the brand changes.
3. Add a real OG image and update the meta tags.
4. Confirm the legal line with counsel. WhatsApp is a Meta trademark; this site
   is independent.
5. The site claims no AppExchange certification. Add badges only after approval.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Semantic page structure and all content |
| `styles.css` | Design system, layout, product mock, responsive rules, reduced motion |
| `main.js` | Header, mobile menu, reveals, sticky product states, cursor, magnetic buttons, countdown |
| `favicon.svg` | Minimal monogram |

## Motion

- Hero title rises line by line; the hero signal line draws.
- The product console enters with perspective and settles; pointer and scroll add
  a small tilt.
- Product features drive a sticky console through four states.
- Sections reveal with a short rise; enterprise cards stagger.
- Templates sit in a horizontal rail; the offer card counts down.
- Custom cursor and magnetic buttons are desktop-only.
- `prefers-reduced-motion` disables all of it and leaves a complete static page.
