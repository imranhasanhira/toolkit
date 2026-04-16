# Design System Document: The Empathetic Interface

## 1. Overview & Creative North Star: "The Digital Sanctuary"
This design system moves away from the cold, sterile nature of traditional medical software. Our Creative North Star is **The Digital Sanctuary**. We treat the interface not as a dashboard, but as a calm, breathable environment that reduces cognitive load for caregivers and elderly users alike.

The system breaks the "template" look through **Intentional Asymmetry** and **Tonal Depth**. Rather than rigid, boxed-in grids, we use overlapping "soft-touch" surfaces and a high-contrast typography scale that prioritizes data legibility (vital signs) over decorative flair. The result is a high-end editorial experience that feels premium, intentional, and profoundly human.

---

## 2. Colors: Tonal Atmosphere
Our palette utilizes soft teals and muted greens to evoke a sense of professional care ("clinical-lite") without the anxiety of a hospital setting.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section sitting on a `surface` background provides all the definition needed.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine, heavy-weight paper.
*   **Surface (Base):** `#f8fafa` (The foundation).
*   **Surface-Container-Lowest:** `#ffffff` (Used for primary interactive cards to provide maximum "pop").
*   **Surface-Container-High:** `#e3e9ea` (Used for recessed areas like search bars or inactive background zones).

### The Glass & Gradient Rule
To move beyond a "standard" feel, use **Glassmorphism** for floating elements (e.g., bottom navigation or urgent alerts). Use semi-transparent surface colors with a `20px` backdrop-blur. 
*   **Signature Textures:** For main CTAs or Hero health summaries, use a subtle linear gradient: `primary` (#106a6a) to `primary_dim` (#005d5d) at a 135-degree angle. This adds "visual soul" and depth.

---

## 3. Typography: Editorial Legibility
We use a dual-font strategy to balance character with absolute clarity.

*   **Display & Headlines (Lexend):** A font engineered for legibility. Use `display-lg` (3.5rem) for critical vital signs (e.g., Heart Rate numbers) to make them unmissable.
*   **Body & Titles (Plus Jakarta Sans):** A modern sans-serif with an upbeat personality. 
*   **The Hierarchy Goal:** By pairing a large `headline-lg` (Lexend) with a much smaller, wide-spaced `label-md` (Plus Jakarta Sans), we create an authoritative, editorial feel that guides the eye naturally to the most important data point.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to create "height"; we use tone to create "presence."

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f0f4f4) background. This creates a soft, natural lift that is easier on elderly eyes than high-contrast shadows.
*   **Ambient Shadows:** If a "floating" effect is required (e.g., a FAB or an emergency button), use an extra-diffused shadow: `box-shadow: 0 12px 32px rgba(44, 52, 53, 0.06);`. The shadow is a tinted version of `on-surface` (#2c3435), never pure black.
*   **The "Ghost Border":** If accessibility requires a border, use `outline-variant` (#acb3b4) at **15% opacity**. 100% opaque borders are strictly forbidden.

---

## 5. Components: The Tactile Set

### Cards & Lists
*   **Standard:** Use `surface-container-lowest` with a `DEFAULT` (1rem) corner radius.
*   **Forbid Dividers:** Do not use lines to separate list items. Use 16px or 24px of vertical white space or a subtle shift to `surface-container-low` on alternating rows.

### Buttons
*   **Primary:** Uses the `primary` (#106a6a) fill with `on-primary` (#e0fffe) text. Shape: `full` (pill-style) for a friendly, non-aggressive feel.
*   **Secondary:** `secondary_container` fill with `on_secondary_container` text. No border.

### Status Badges (Pills)
*   Used for "Stable," "Attention," or "Medication Taken."
*   Styling: `sm` roundedness, using `tertiary_container` for the background to keep them "clinical-lite" and non-alarming.

### Critical Vitals Display (Custom Component)
*   A large `display-md` number (Lexend) paired with a `label-sm` unit (e.g., "BPM") positioned in the top-right of the number. This creates an asymmetrical, sophisticated data visualization.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use `xl` (3rem) roundedness for large container backgrounds to evoke "warmth."
*   **Do** use `on_surface_variant` (#596061) for secondary text to maintain a soft contrast ratio that is still AA accessible.
*   **Do** allow elements to bleed off-canvas or overlap slightly to break the "boxed-in" feel.

### Don’t
*   **Don’t** use pure black (#000000) for text. Use `on_surface` (#2c3435).
*   **Don’t** use 1px dividers. If you feel you need a line, use a 4px gap of `surface-container-high` instead.
*   **Don’t** use "Alert Red" for non-emergencies. Use the `error_container` (#fa746f) to keep the tone "caring" rather than "panic-inducing."