# UtaSensei Design System

## Core Philosophy: "Zine Neobrutalism"

The design language of UtaSensei is rooted in **Zine Neobrutalism**. It draws inspiration from independent publishing, risograph printing, and early web aesthetics. It is raw, unpolished, yet highly structured and legible. 

Unlike traditional "harsh" neobrutalism (which relies on pure whites, pure yellows, and massive 8px borders), the "Zine" variation is softer on the eyes, favoring off-white paper tones, thinner borders, and restrained but energetic accent colors. It feels tactile, like a printed booklet.

---

## 1. Color Palette

The color palette is intentionally limited to mimic spot-color printing.

| Role | Hex Code | Description |
| :--- | :--- | :--- |
| **Paper (Background)** | `#F4F1EA` | A warm, off-white beige. Used for the app background, sidebar, and default card states. It reduces eye strain compared to pure white and gives a tactile "newsprint" feel. |
| **Paper Hover** | `#EAE5D9` | A slightly darker, muted beige used for hover states on cards and list items to indicate interactivity without relying on color shifts. |
| **Highlighter (Accent)** | `#FF8C00` | A vibrant, energetic tangerine orange. Used sparingly for primary buttons, active states, and the signature drop shadows. |
| **Ink (Primary Text & Borders)** | `#000000` | Pure black. Used for all primary typography, borders, and icons. Provides maximum contrast against the paper background. |
| **Muted Ink (Secondary Text)** | `#666666` | A mid-gray. Used for secondary information, metadata, and vocabulary explanations to establish visual hierarchy without shrinking font sizes too much. |

---

## 2. Typography

Typography is the backbone of the Zine aesthetic. It relies on a stark contrast between a quirky, geometric sans-serif and a mechanical monospace font.

### Primary Font: `Space Grotesk`
*   **Usage:** Headers, primary body text, buttons, and UI labels.
*   **Characteristics:** Geometric, slightly retro-futuristic, highly legible but with distinct personality (especially in its lowercase 'g' and 'a').
*   **Styling:** 
    *   Headers are often `uppercase` with `tracking-tighter` (negative letter spacing) to create dense, impactful blocks of text.
    *   Font weights are restricted to `Regular (400)` for body and `Bold (700)` for headers/emphasis.

### Secondary Font: `JetBrains Mono`
*   **Usage:** Translations, vocabulary explanations, metadata (like artist names or source tags), and input fields.
*   **Characteristics:** Mechanical, typewriter-esque. 
*   **Styling:** Used to separate "data" or "translation" from the primary Japanese text. It grounds the design and reinforces the "educational tool" aspect of the app.

---

## 3. UI Components & Geometry

The geometry of the app is strictly orthogonal. There are no rounded corners, no gradients, and no soft blurs.

### Borders
*   **Width:** Uniform `2px` solid black (`#000000`).
*   **Radius:** `0px` (perfectly sharp corners).
*   **Usage:** Applied to almost every distinct UI element (cards, buttons, inputs, sidebars) to create clear, comic-book-like boundaries.

### Shadows
*   **Style:** Hard, unblurred drop shadows.
*   **Offset:** `4px` down and `4px` right.
*   **Color:** Accent Orange (`#FF8C00`).
*   **Usage:** Applied to cards, buttons, and inputs to create a pseudo-3D "stacked paper" effect. 

### Buttons (`.neo-button`)
*   **Resting State:** Accent background (`#FF8C00`), black text, 2px black border, 4px orange shadow.
*   **Active/Click State:** The button physically translates `4px` down and right, and the shadow drops to `0px`. This creates a highly satisfying, tactile "click" mechanism.

### Cards (`.neo-card`)
*   **Resting State:** Paper background (`#F4F1EA`), 2px black border, 4px orange shadow.
*   **Hover State:** Background shifts to Paper Hover (`#EAE5D9`), the card translates `-2px` up and left, and the shadow expands to `6px`. This makes the card feel like it's lifting off the page.

### Inputs (`.neo-input`)
*   **Resting State:** Paper background, 2px black border.
*   **Focus State:** Gains the 4px orange shadow. No default blue browser outlines.

---

## 4. Layout & Spacing

*   **Grid & Lines:** The layout embraces visible structural lines. The sidebar is separated by a hard 2px border rather than just whitespace. Expanded accordion sections are separated by hard top-borders.
*   **Density:** The design allows for dense information (like the vocabulary grids) but uses thick padding (`p-4`, `p-6`, `p-8`) inside cards to ensure the text doesn't feel cramped against the heavy borders.
*   **Alignment:** Left-alignment is heavily favored for text to maintain a structured, editorial feel.

---

## 5. Interaction Design

*   **Tactility:** Every interactive element must have a physical reaction. Buttons press down; cards lift up.
*   **Transitions:** Fast and snappy. `transition: all 0.2s ease` is standard. It shouldn't feel floaty or overly animated; it should feel mechanical and immediate.
*   **Accordions:** Expanding a lyric line reveals the explanation in a slightly darker, muted container (`bg-[var(--bg-app)]/30` or similar visual separation) to distinguish the "deep dive" content from the surface-level lyrics.
