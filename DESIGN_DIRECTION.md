# UI Design Direction

Reference requested by Aditya:

- Dribbble: Smart Living Motion Experience
- Similar desired feel: premium smart-home / ambient AI dashboard / soft 3D product experience

## Should our UI follow that direction?

Yes. It is a good direction for this project because content moderation is complex and serious, so the UI should feel:

- calm, not noisy
- premium, not like a basic admin form
- spatial/3D, but not gimmicky
- trust-oriented, with clear status and explainability
- human-review friendly

## Palette direction

The previous cyan/violet cyber palette looked too harsh. The updated palette moves toward a smart-living style:

- Background: warm graphite / deep charcoal
- Text: soft cream instead of pure cold white
- Primary accent: champagne amber
- Secondary accent: sage/mint green
- Support accent: soft periwinkle/indigo
- Risk colors: muted amber and soft rose
- Panels: translucent dark glass with warm borders

## Visual language

- Ambient gradient background
- Soft animated perspective grid
- Floating 3D orb/core
- Glassmorphism panels
- Large product-style hero section
- Calm KPI cards
- Clear moderation workspace
- Human review queue as a calm operations panel

## What to avoid

- Overly neon cyberpunk colors
- Plain HTML form look
- Too many glowing elements
- Random 3D without purpose
- Cluttered dashboard density

## Future best version

The built-in `/ui` is a backend demo UI. The strongest final version should be the separate Next.js frontend with:

- React Three Fiber 3D scene
- Framer Motion transitions
- Tailwind design system
- real login flow
- review queue pages
- policy editor page
- evaluation dashboard
