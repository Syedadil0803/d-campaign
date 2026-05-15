---
name: Ice Slate & International Orange
colors:
  surface: '#f6fafe'
  surface-dim: '#d6dade'
  surface-bright: '#f6fafe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4f8'
  surface-container: '#eaeef2'
  surface-container-high: '#e4e9ed'
  surface-container-highest: '#dfe3e7'
  on-surface: '#171c1f'
  on-surface-variant: '#5a4138'
  inverse-surface: '#2c3134'
  inverse-on-surface: '#edf1f5'
  outline: '#8e7166'
  outline-variant: '#e2bfb2'
  surface-tint: '#a73a00'
  primary: '#a33900'
  on-primary: '#ffffff'
  primary-container: '#cc4900'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb599'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#4f5d71'
  on-tertiary: '#ffffff'
  tertiary-container: '#67758b'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb599'
  on-primary-fixed: '#370e00'
  on-primary-fixed-variant: '#7f2b00'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d5e3fc'
  tertiary-fixed-dim: '#b9c7df'
  on-tertiary-fixed: '#0d1c2e'
  on-tertiary-fixed-variant: '#3a485b'
  background: '#f6fafe'
  on-background: '#171c1f'
  surface-variant: '#dfe3e7'
typography:
  h1:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style

This design system is engineered for environments where clarity, speed of thought, and professional rigor are paramount. It strikes a balance between the clinical coolness of "Ice Slate" and the high-visibility urgency of "International Orange." The aesthetic is a fusion of **Minimalism** and **Technical Modernism**, utilizing sharp geometry and a restricted color palette to convey a sense of architectural stability.

The emotional response should be one of "controlled energy"—highly legible and calm, yet punctuated by aggressive, precise accents that guide the user toward action. It is designed for technical practitioners who value density without clutter.

## Colors

The palette is anchored by the **Ice Slate** (#F1F5F9) foundation. To prevent the interface from feeling flat, a subtle radial glow is applied to the top of the viewport using International Orange at a 12% opacity.

- **Primary (International Orange):** Reserved strictly for primary actions, success states, and critical brand indicators.
- **Deep Slate:** Used for high-contrast headings to ensure a strong typographic hierarchy.
- **Slate Gray:** The primary color for long-form body text to reduce eye strain while maintaining legibility.
- **Silver Steel:** A sophisticated gradient applied to card surfaces to create a subtle sense of physical depth without relying on traditional drop shadows.

## Typography

Geist is the primary typeface, chosen for its monospaced-influenced metrics which lend a technical, developer-centric feel to the UI. 

Headings use **Deep Slate** and tighter letter spacing to command attention. Body text is set in **Slate Gray** to soften the contrast for better reading endurance. Labels and metadata should leverage the font's semi-bold weights and slight tracking increases to maintain legibility at small scales.

## Layout & Spacing

The system utilizes a **12-column fluid grid** with fixed margins. The spacing rhythm is based on a strict 4px baseline, ensuring all elements align with mathematical precision. 

Layouts should favor density and logical grouping. Use generous outer margins (40px+) to frame content, while maintaining tight internal gutters (16px-24px) to emphasize the structural relationship between data points.

## Elevation & Depth

This system rejects soft, ambient shadows in favor of **Tonal Layering** and **Steel Etching**. 

- **Depth:** Achieved through the contrast between the flat Ice Slate background and the Silver Steel gradient cards.
- **Borders:** Every container is defined by a 1px "Steel Etch" (#CBD5E1) border. 
- **Active States:** Elevation is signaled by a color shift to International Orange rather than a change in shadow, maintaining the "technical drawing" feel of the interface. 
- **Overlays:** Modals and tooltips use the same Silver Steel gradient but may include a secondary 2px solid border in Slate Gray to distinguish them from the base layout.

## Shapes

The shape language is defined by **Sharp 8px corners**. This specific radius is used across all buttons, input fields, cards, and modal windows. This uniformity reinforces the system's focus on precision and engineering. Circles are only permitted for user avatars or status indicators; all other structural UI elements must adhere to the 8px standard.