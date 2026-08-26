---
name: Technical Dark Mode System
colors:
  surface: '#1a120c'
  surface-dim: '#1a120c'
  surface-bright: '#423730'
  surface-container-lowest: '#150c07'
  surface-container-low: '#231a14'
  surface-container: '#271e17'
  surface-container-high: '#322821'
  surface-container-highest: '#3d332c'
  on-surface: '#f1dfd5'
  on-surface-variant: '#dbc1b2'
  inverse-surface: '#f1dfd5'
  inverse-on-surface: '#392e27'
  outline: '#a38c7e'
  outline-variant: '#554337'
  surface-tint: '#ffb783'
  primary: '#ffb887'
  on-primary: '#4f2500'
  primary-container: '#fb923c'
  on-primary-container: '#673200'
  inverse-primary: '#944a00'
  secondary: '#b9c7e0'
  on-secondary: '#233144'
  secondary-container: '#3c4a5e'
  on-secondary-container: '#abb9d2'
  tertiary: '#61d5ff'
  on-tertiary: '#003545'
  tertiary-container: '#00bbe9'
  on-tertiary-container: '#00465a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcc5'
  primary-fixed-dim: '#ffb783'
  on-primary-fixed: '#301400'
  on-primary-fixed-variant: '#713700'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#baeaff'
  tertiary-fixed-dim: '#5bd4ff'
  on-tertiary-fixed: '#001f29'
  on-tertiary-fixed-variant: '#004d62'
  background: '#1a120c'
  on-background: '#f1dfd5'
  surface-variant: '#3d332c'
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  code:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin: 32px
---

## Brand & Style

This design system is engineered for high-performance, technical environments where clarity and precision are paramount. It follows a **Modern Minimalist** aesthetic infused with **High-Contrast** functional elements. The visual narrative is built on the concept of "Command and Control"—utilizing a deep, expansive background to provide a void-like canvas where critical data and primary actions pierce through with neon intensity.

The atmosphere is professional, sharp, and uncompromising. By pairing deep navy depths with a vibrant safety orange, the UI evokes the feeling of advanced industrial interfaces or sophisticated developer tooling. It avoids unnecessary soft shadows in favor of crisp borders and structured gradients, ensuring every element feels intentional and technically grounded.

## Colors

The palette is anchored by a high-contrast relationship between the **Deep Navy** background and the **Neon Safety Orange** primary accent. 

- **Surfaces**: The primary canvas is a flat `#020617`. Containment is achieved through a 135-degree linear gradient on cards, transitioning from a muted slate to a near-black navy. This subtle shift provides internal depth without relying on traditional drop shadows.
- **Accents**: `#FB923C` is used exclusively for primary actions, critical status indicators, and active states. It should be used sparingly to maintain its impact.
- **Borders**: All structural boundaries use `#334155`. This low-to-mid-range contrast ensures the grid is visible but doesn't compete with the content.

## Typography

The typographic system utilizes a trio of technical typefaces to delineate hierarchy and function.

- **Headlines**: **Space Grotesk** provides a futuristic, geometric edge. It should be rendered in pure white (`#FFFFFF`) to maximize contrast against the dark background.
- **Body**: **Geist** is used for its exceptional readability and "developer-friendly" aesthetic. It is rendered in light gray (`#E4E4E7`) to reduce eye strain during prolonged technical tasks.
- **Labels & Data**: **JetBrains Mono** is reserved for metadata, labels, and code snippets, reinforcing the technical nature of the system. Use uppercase with generous letter spacing for small labels to ensure legibility.

## Layout & Spacing

This design system employs a **Fixed Grid** philosophy for dashboard views and a tight, logic-driven layout for data-heavy sections.

- **Grid Model**: A 12-column grid with 24px gutters. Content should align strictly to the grid to maintain a sharp, architectural feel.
- **Rhythm**: All spacing is derived from a 8px base unit. Internal card padding should be a consistent 24px (md) to allow the content to breathe against the heavy borders.
- **Visual Density**: High density is preferred for data tables and sidebars, while primary workspace areas should utilize larger vertical spacing (lg or xl) to emphasize focus.

## Elevation & Depth

In this system, depth is communicated through **Tonal Layers** and **Crisp Outlines** rather than soft shadows.

- **Layering**: The background (`#020617`) is the lowest level. Card surfaces sit "above" the background via their linear gradients and `#334155` 1px borders.
- **Active States**: Hovering over elements should not increase shadow, but rather subtly brighten the border color or increase the opacity of the gradient. 
- **Modals**: For high-elevation elements like modals, use a semi-transparent background blur (Backdrop Filter: blur(12px)) behind the surface to create a "glassmorphism" effect that maintains the technical feel while providing focus.

## Shapes

The shape language is strictly defined by an **8px (ROUND_EIGHT)** corner radius. 

- **Uniformity**: This radius applies to cards, buttons, input fields, and chips. 
- **Consistency**: Maintaining a singular radius across different component scales creates a "precision-molded" appearance. 
- **Interactive Elements**: Smaller elements like checkboxes or radio buttons follow the same geometric logic—avoid fully circular radios if possible; use octagonal or slightly rounded squares for a more unique technical identity.

## Components

- **Buttons**: Primary buttons are solid `#FB923C` with black text for maximum punch. Secondary buttons are transparent with a 1px `#334155` border and white text.
- **Input Fields**: Use the card gradient background for inputs with a 1px border. Focus state is indicated by a 1px `#FB923C` border and a subtle glow (0px 0px 8px).
- **Cards**: All cards must feature the 135deg gradient and the 1px `#334155` border. No exceptions.
- **Chips/Badges**: Use **JetBrains Mono** for text. Status badges should use the primary accent color for "active/running" states and muted grays for "inactive."
- **Data Tables**: Remove vertical grid lines. Use horizontal 1px borders in `#334155`. Header cells should use the `label-caps` typography style.
- **Scrollbars**: Custom styled scrollbars—thin (4px), dark slate tracks with `#334155` handles to blend into the interface.