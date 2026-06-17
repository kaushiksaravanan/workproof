
# Peggy-Inspired Style Guide

A friendly, family-focused mobile style guide derived from the attached screenshots. Intended as the visual foundation for an Android app build.

## 1. Brand Personality
- Warm, playful, trustworthy — "made by a parent, for parents"
- Hand-drawn accents balanced with clean, modern UI cards
- Optimistic and energetic without feeling childish

## 2. Color Palette
Primary
- Peggy Blue (background/brand): `#5B7CFA` (soft cornflower)
- Deep Ink (headings/body): `#0E1742`
- Pure White (cards/surfaces): `#FFFFFF`
- Lavender Tint (secondary bg): `#E6ECFF`

Accents
- Sunshine Yellow (highlight/underline): `#FFD84D`
- Coral Pink (tags, "NEW" badge): `#FF6B8A`
- Mint Green (event chips): `#B8E6C1`
- Warm Amber (tab/CTA): `#C8732B`

Neutrals
- Muted Gray (secondary text): `#6B7280`
- Hairline Border: `#E5E7EB`
- Page Gray (canvas): `#F2F2F2`

## 3. Typography
- Display / Headline: a rounded geometric sans with an italic display cut (e.g. **Fraunces Italic** or **Recoleta** for the "Dad of 3" feel; **Plus Jakarta Sans ExtraBold** for stacked headlines like "Get emails that matter")
- Body: **Inter** or **Plus Jakarta Sans** Regular/Medium
- Mono accents (times, dates): **Inter Medium** small caps

Type scale (sp, Android)
- Display: 34 / 700, line 38
- H1: 28 / 700
- H2: 22 / 600
- Title: 17 / 600
- Body: 15 / 400
- Caption: 12 / 500 uppercase, +0.6 tracking

Treatment
- Mix weights inside a single headline ("**Start** your day with a **digest**") — bold + light italic
- Yellow marker underline on a key word per headline
- Sentence case for UI, ALL CAPS only for micro-labels

## 4. Iconography & Illustration
- Hand-drawn line illustrations (1.5px stroke, navy ink) of people, paper planes, notebooks
- Mixed with full-color brand logos (Google Calendar, Apple Calendar, Outlook) at their native colors
- Decorative motifs: paper planes, notebook rule lines, dashed flight paths, sparkles

## 5. Surfaces & Elevation
- Cards: white, radius 20dp, shadow `0 8 24 rgba(14,23,66,0.08)`
- Inner chips: radius 12dp, 1px border `#E5E7EB`
- Hero panels: Peggy Blue with soft inner gradient to lavender tint
- Sticker frames: white with scalloped/cloud edge for portraits and testimonials

## 6. Components (Material 3 mapping)
- TopAppBar: transparent over hero, ink text
- Buttons:
  - Primary: Peggy Blue fill, white text, radius 14dp, 48dp height
  - Secondary: white fill, ink text, 1px ink border
  - Tag/Chip CTA: pill, amber or coral fill, white text, 32dp
- List rows: leading checkbox, title 15/600, subtitle 12/500 muted, avatar stack trailing
- Tabs: pill segmented control, active = white card on blue
- Empty/Hero illustration block with handwritten caption underneath

## 7. Layout & Spacing
- 4dp base grid; common gaps 8 / 12 / 16 / 24 / 32
- Screen padding: 20dp horizontal
- Card padding: 16dp; section gap: 24dp
- Hero headlines occupy ~60% of viewport above the fold, with a single illustrated card peeking

## 8. Motion
- Gentle spring transitions (stiffness 220, damping 26)
- Paper-plane swoosh on success states
- Underline highlight draws in on screen enter (250ms)
- Cards rise 4dp on press

## 9. Imagery Style
- Portraits framed in cloud/scallop white stickers
- Hand-labeled name arrows pointing at subjects
- Notebook-paper backgrounds for "school stuff" contexts

## 10. Deliverables to set up in the app
- `colors.xml` + Compose `ColorScheme` (light first; dark optional later)
- `Type.kt` Compose typography with the scale above
- `Shapes.kt` with 12 / 20 / 28 radii
- Reusable composables: `PeggyHeadline`, `HighlightUnderline`, `StickerFrame`, `EventCard`, `ReminderRow`, `BrandChip`
- Sample screen rebuilding the "Start your day with a digest" mock to validate the system

## Technical notes
- Target Android (Jetpack Compose, Material 3). If this is the existing TanStack/web project instead, confirm — I'd then output the same tokens as CSS variables in `src/styles.css` and Tailwind theme entries rather than Android resources.

## Open questions before building
1. Is this guide for a **native Android (Kotlin/Compose)** project, or should I implement it as tokens in this existing web project?
2. Light mode only, or also define dark mode now?
3. Any locked brand fonts you own a license for, or should I pick free Google Fonts (Fraunces + Plus Jakarta Sans)?
