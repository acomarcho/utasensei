# UtaSensei Design System

## Core Philosophy: "Zine Neobrutalism"

The design language of UtaSensei is rooted in **Zine Neobrutalism**. It draws inspiration from independent publishing, risograph printing, and early web aesthetics. It is raw, unpolished, yet highly structured and legible.

Unlike traditional "harsh" neobrutalism (which relies on pure whites, pure yellows, and massive 8px borders), the "Zine" variation is softer on the eyes, favoring off-white paper tones, thinner borders, and restrained but energetic accent colors. It feels tactile, like a printed booklet.

The visual language matters, but the product rules matter just as much: the interface should stay simple, learner-facing, mobile-first, and resilient under real content.

---

## 1. Product Principles

These principles override cleverness. When in doubt, follow these first.

### Keep It Simple
* Show only what helps the learner right now.
* Remove duplicate information, noisy labels, and explanatory chrome that does not improve the task.
* Prefer one clear action over multiple competing controls.
* If a UI block explains the system instead of helping the user, it probably should not exist.

### User-Facing, Not Developer-Facing
* Never expose implementation concepts such as internal flow state, review mechanics, card staging logic, run metadata, or system jargon.
* Labels and copy should describe what the learner can do, not how the app is built.
* Avoid status text that sounds like debug output, product ops language, or educational theory.

### Mobile First Always
* Design for the smallest screen first, then scale up.
* On mobile, the primary task should dominate the screen.
* Secondary guidance should be reduced or removed before the primary action gets cramped.
* Desktop can add comfort and breathing room, but mobile defines the baseline structure.

### Overflow Resilience
* Long translations, long words, metadata, and mixed-language content must wrap safely.
* No important text should clip, overflow its card, or break the layout.
* Components should stay stable even when real content is messier than mock content.

### Motion With Purpose
* Use animation whenever it helps orientation, continuity, hierarchy, or feedback.
* Motion should explain what is opening, closing, sliding, flipping, or returning.
* Avoid decorative motion that adds noise without improving comprehension.

### Interactivity Must Feel Interactive
* All interactive elements should communicate affordance clearly.
* Use `cursor: pointer` on interactable elements.
* Add hover states where hover is available.
* Interactive feedback should feel immediate and tactile, not subtle to the point of invisibility.

---

## 2. Color Palette

The color palette is intentionally limited to mimic spot-color printing.

| Role | Hex Code | Description |
| :--- | :--- | :--- |
| **Paper (Background)** | `#F4F1EA` | A warm, off-white beige. Used for the app background, sidebar, and default card states. It reduces eye strain compared to pure white and gives a tactile "newsprint" feel. |
| **Paper Hover** | `#EAE5D9` | A slightly darker, muted beige used for hover states on cards and list items to indicate interactivity without relying on color shifts. |
| **Highlighter (Accent)** | `#FF8C00` | A vibrant, energetic tangerine orange. Used sparingly for primary buttons, active states, and the signature drop shadows. |
| **Ink (Primary Text & Borders)** | `#000000` | Pure black. Used for all primary typography, borders, and icons. Provides maximum contrast against the paper background. |
| **Muted Ink (Secondary Text)** | `#666666` | A mid-gray. Used for secondary information, metadata, and vocabulary explanations to establish visual hierarchy without shrinking font sizes too much. |

---

## 3. Typography

Typography is the backbone of the Zine aesthetic. It relies on a stark contrast between a quirky, geometric sans-serif and a mechanical monospace font.

### Primary Font: `Space Grotesk`
* **Usage:** Headers, primary body text, buttons, and UI labels.
* **Characteristics:** Geometric, slightly retro-futuristic, highly legible but with distinct personality.
* **Styling:**
  * Headers are often `uppercase` with `tracking-tighter` to create dense, impactful blocks of text.
  * Font weights are restricted to `Regular (400)` for body and `Bold (700)` for headers and emphasis.

### Secondary Font: `JetBrains Mono`
* **Usage:** Translations, vocabulary explanations, metadata, and input fields.
* **Characteristics:** Mechanical, typewriter-like, and useful for separating supporting information from the primary lyric content.
* **Styling:** Use it to distinguish supporting data from the main learning surface, not to create extra visual clutter.

---

## 4. UI Components & Geometry

The geometry of the app is strictly orthogonal. There are no rounded corners, no gradients, and no soft visual treatment on primary surfaces.

### Borders
* **Width:** Uniform `2px` solid black (`#000000`).
* **Radius:** `0px`.
* **Usage:** Applied to almost every distinct UI element to create clear editorial boundaries.

### Shadows
* **Style:** Hard, unblurred drop shadows.
* **Offset:** `4px` down and `4px` right.
* **Color:** Accent Orange (`#FF8C00`).
* **Usage:** Applied to cards, buttons, and inputs to create a pseudo-3D stacked-paper effect.

### Buttons (`.neo-button`)
* **Resting State:** Accent background (`#FF8C00`), dark text, black border, orange shadow.
* **Active State:** The button physically translates down and right while the shadow collapses.
* **Behavior:** Buttons should look obviously clickable and feel tactile immediately.

### Cards (`.neo-card`)
* **Resting State:** Paper background, black border, orange shadow.
* **Hover State:** Background shifts to Paper Hover, the card lifts slightly, and the shadow expands.
* **Behavior:** Cards can feel lively, but never noisy.

### Inputs (`.neo-input`)
* **Resting State:** Paper background, black border.
* **Focus State:** Gains the orange shadow. No default blue browser outline.

### Overlays
* Primary content surfaces remain crisp and sharp.
* Overlay backdrops may use dimming and subtle blur when needed to focus attention on a modal task.
* Blur is a focus tool, not a general visual style.

---

## 5. Layout & Spacing

* **Grid & Lines:** The layout embraces visible structural lines. The sidebar is separated by a hard border rather than only whitespace. Expanded sections are separated by hard top-borders.
* **Density:** Dense information is allowed, but padding must preserve readability.
* **Alignment:** Left-alignment is preferred for text and metadata to preserve the editorial feel.
* **Priority:** The most important task in a view should get the best space, not just equal space.
* **Reduction:** If a screen feels crowded, remove secondary UI before shrinking the primary content.

---

## 6. Responsive Rules

### Mobile Baseline
* Mobile is the default design target.
* Review flows, lyrics, and key controls must remain comfortable on narrow screens first.
* Statistics and metadata should be compact and high-value.
* Tips, helper copy, and decorative support blocks are optional on mobile and should be removed if they create pressure.

### Desktop Expansion
* Desktop may add breathing room, wider card stages, extra side panels, and secondary helper content.
* Desktop enhancements should never introduce jargon or duplicate content already present in the main task surface.

### Content Safety
* Use wrapping, shrinking rules, and minimum-width safeguards to prevent overflow.
* Never assume English-only, short-copy, or short-word content.

---

## 7. Interaction Design

* **Tactility:** Every interactive element should have a physical reaction. Buttons press down; cards lift or swipe; toggles reveal their content clearly.
* **Hover & Pointer:** Interactive elements should use `cursor: pointer` and have visible hover feedback where applicable.
* **Transitions:** Fast and snappy. Motion should feel mechanical, responsive, and legible rather than floaty.
* **Animated Structure:** Use animation to communicate layout changes such as sidebar slide-in, collapsible expansion, modal entrance, card flip, and swipe return.
* **Accordions:** Expanding a lyric line should reveal explanation content in a clearly separated container.
* **Safe Recovery:** Gesture-driven interactions should include a safe zone where the UI can return to its resting state if the user has not committed far enough.

---

## 8. Copywriting Rules

* Copy should be short, direct, and learner-centered.
* Avoid redundant labels when the surrounding UI already makes the meaning obvious.
* Avoid internal, system-facing, or developer-facing vocabulary.
* Avoid over-explaining mechanics that the interaction already teaches.
* Prefer plain actions like `Flip`, `Again`, and `Got it` over technical labels.

---

## 9. Flashcard Review Pattern

The flashcard review experience is a focused task surface, not a dashboard.

* The card is the hero, especially on mobile.
* Supporting statistics should stay compact and easy to scan.
* The review surface should feel lively through stacking, flipping, and swiping, but not cluttered.
* The user should never need to understand the underlying review system to use it.
* Any supporting instruction should be minimal and removable if it competes with the cards.
