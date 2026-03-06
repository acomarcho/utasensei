# Dynamic Sidebar Scrollbar

This note explains the custom sidebar scrollbar in `apps/web-app` in plain English.

It is written for junior developers.

The goal is to explain:

1. why we did not use the browser’s normal scrollbar
2. how the custom scrollbar is positioned
3. why `min-h-0` matters
4. why `z-index` matters here
5. how the thumb size and position are calculated

Examples in this note refer to:

- `apps/web-app/src/components/ai-studio.tsx:312`
- `apps/web-app/src/styles/app.css:137`

---

## Plain English First

The sidebar has 3 main parts stacked vertically:

1. the header at the top
2. the song list in the middle
3. the `New Song` button area at the bottom

The middle part is the only part that should scroll.

We wanted the scrollbar to look more subtle than the browser default.
So instead of showing the native browser scrollbar, we:

- hid the native scrollbar
- kept normal scrolling behavior
- drew our own tiny scrollbar on top as a visual indicator

That means:

- the user still scrolls the real list
- the browser still handles the actual scrolling
- our code only draws a small “progress marker” to show where the user is in the list

That is an important design decision.
We did **not** build a fake scrolling system.
We only built a **fake-looking scrollbar** on top of a real scroll container.

---

## Terms First

### Scroll container
A box that can scroll because its content is taller than the visible area.

In our case, the song list area is the scroll container.

### Native scrollbar
The scrollbar the browser gives you automatically.
Examples are the normal macOS / Chrome / Safari scrollbar UI.

### Custom scrollbar
A scrollbar look that we draw ourselves.
In our case, it is a thin rail and a thumb.

### Rail
The full track area the thumb moves inside.
Think of it like the lane.

### Thumb
The moving piece inside the scrollbar.
It shows where you currently are in the scrollable content.

### `position: relative`
This tells the browser:

> “children with absolute positioning should use me as their positioning box.”

### `position: absolute`
This lets an element sit on top of normal layout and be placed with values like:

- `top`
- `right`
- `bottom`
- `left`

### `z-index`
This controls which element appears visually on top when elements overlap.

Higher `z-index` usually means “closer to the user” visually.

### Flex item
A child inside a flex layout.
Our sidebar is a vertical flex layout.

### `min-h-0`
Short for “minimum height: 0”.

This is a very important flexbox fix.
It tells a flex child:

> “you are allowed to shrink smaller than your content.”

Without it, a child often tries to stay as tall as its content, which can break scrolling.

### `ResizeObserver`
A browser API that lets us react when an element’s size changes.

We use it so the custom thumb updates if the sidebar size changes.

---

## Where The Logic Lives

### React logic
The sidebar scrollbar logic is in:

- `apps/web-app/src/components/ai-studio.tsx:321`
- `apps/web-app/src/components/ai-studio.tsx:328`
- `apps/web-app/src/components/ai-studio.tsx:358`
- `apps/web-app/src/components/ai-studio.tsx:362`
- `apps/web-app/src/components/ai-studio.tsx:403`
- `apps/web-app/src/components/ai-studio.tsx:438`
- `apps/web-app/src/components/ai-studio.tsx:454`

### CSS styling
The scrollbar styles are in:

- `apps/web-app/src/styles/app.css:137`
- `apps/web-app/src/styles/app.css:146`
- `apps/web-app/src/styles/app.css:152`

---

## Part 1: The Layout Structure

The sidebar is built like this:

- top header
- middle scroll area
- bottom footer button

In code, the important structure is:

- a wrapper: `relative min-h-0 flex-1`
- the real scroll area inside it
- the custom rail absolutely positioned on top of that wrapper
- the footer below it with a higher stacking order

The important lines are:

- `apps/web-app/src/components/ai-studio.tsx:403`
- `apps/web-app/src/components/ai-studio.tsx:405`
- `apps/web-app/src/components/ai-studio.tsx:441`
- `apps/web-app/src/components/ai-studio.tsx:454`

### Why this structure?

Because we needed **two different things at the same time**:

1. a real scrollable box
2. a visual scrollbar indicator that sits on top of that box

If we only had the scrollable box, the custom indicator would have nowhere clean to anchor itself.
If we only had an overlay, we would not have real scrolling.

So the wrapper becomes the “positioning parent”, and the inner div becomes the “real scroll area”.

---

## Part 2: Why `position: relative` And `position: absolute`?

At `apps/web-app/src/components/ai-studio.tsx:403`, the wrapper uses:

- `relative`

That means:

> “if a child is absolutely positioned, place it relative to this box.”

Then the scrollbar rail at `apps/web-app/src/components/ai-studio.tsx:441` uses:

- `absolute`
- `right-1.5`
- `top-4`
- `bottom-4`

Plain English:

- put the rail near the right edge
- start a little below the top
- stop a little above the bottom
- do not let it affect normal layout

This is why the rail can float neatly over the scroll area without pushing any content around.

### Why not just put the rail in normal layout?

Because then it would take up space like a normal element.
That would:

- push content sideways
- make spacing harder
- make the scrollbar feel like part of the content instead of an overlay

Absolute positioning is a better fit because the rail is decorative UI, not content.

---

## Part 3: Why `min-h-0` Works

This part is not intuitive at first.

The sidebar is inside a flex layout.
The middle area is also a flex item because it sits between the header and the footer.

At `apps/web-app/src/components/ai-studio.tsx:403`, we use:

- `flex-1`
- `min-h-0`

At `apps/web-app/src/components/ai-studio.tsx:405`, we also use:

- `h-full`
- `min-h-0`
- `overflow-y-auto`

### The problem without `min-h-0`

A flex child often behaves like this:

> “I do not want to become smaller than my content.”

That sounds reasonable, but it creates a problem.
If the song list is very tall, the middle section may try to grow with the content instead of staying inside the available space.

When that happens:

- the middle area becomes too tall
- the footer can get pushed away
- the scroll area may stop behaving like a proper scroll area
- parts of the UI can become unreachable

That is basically what happened when the custom scrollbar first broke the sidebar.

### What `min-h-0` says

`min-h-0` says:

> “you are allowed to be shorter than your content.”

That gives the browser permission to do the correct thing:

- keep the middle area inside the available height
- let the content overflow inside it
- let `overflow-y-auto` take over and create scrolling

### The simplest mental model

Without `min-h-0`:

- the box says: “I want to fit all my children.”

With `min-h-0`:

- the box says: “I can stay small, and my children can scroll inside me.”

That is why `min-h-0` often fixes “why is my flex child not scrolling?” bugs.

---

## Part 4: Why We Hide The Native Scrollbar

In `apps/web-app/src/styles/app.css:137`, we have:

- `.neo-scrollbar-hidden`

This hides the browser’s default scrollbar:

- `scrollbar-width: none` for Firefox
- `::-webkit-scrollbar { display: none; }` for WebKit-based browsers

Important:

This does **not** disable scrolling.
It only hides the browser’s own scrollbar UI.

The actual scrolling still comes from:

- `overflow-y-auto` in `apps/web-app/src/components/ai-studio.tsx:405`

So again:

- browser handles scrolling
- our CSS hides the native scrollbar look
- our React code draws a subtle replacement

---

## Part 5: How The Custom Thumb Works

The state lives here:

- `apps/web-app/src/components/ai-studio.tsx:322`

We store 3 things:

- `hasOverflow`
- `thumbHeight`
- `thumbTop`

### `hasOverflow`
This means:

> “is the content taller than the visible area?”

If not, there is no reason to show a scrollbar at all.

### `thumbHeight`
This is how tall the thumb should be.

### `thumbTop`
This is how far down the rail the thumb should be placed.

---

## Part 6: How We Measure The Scroll Area

At `apps/web-app/src/components/ai-studio.tsx:334`, we read:

- `clientHeight`
- `scrollHeight`
- `scrollTop`

Here is what those mean.

### `clientHeight`
The visible height of the box.

This is the “window” the user can currently see.

### `scrollHeight`
The full height of all content inside the box.

This includes content that is currently off-screen.

### `scrollTop`
How far the user has already scrolled downward.

---

## Part 7: How We Decide Whether To Show The Scrollbar

At `apps/web-app/src/components/ai-studio.tsx:335`, we do:

- `scrollHeight > clientHeight + 1`

Plain English:

- if content is taller than the visible area, show the custom scrollbar
- otherwise, hide it

The `+ 1` is just a tiny safety buffer so we do not show the bar because of tiny rounding differences.

---

## Part 8: How We Calculate Thumb Height

At `apps/web-app/src/components/ai-studio.tsx:342`, we do:

- `(clientHeight * clientHeight) / scrollHeight`

This may look weird at first.

### Plain English idea

If the visible area is a big percentage of the full content, the thumb should be bigger.
If the visible area is a small percentage of the full content, the thumb should be smaller.

That formula gives us a proportional thumb size.

### Example

If:

- visible height = `300`
- full content height = `900`

Then the visible area is about one third of the content.
So the thumb should also feel like about one third of the rail.

### Why `Math.max(28, ...)`?

Because a super tiny thumb is hard to see and feels bad to users.

So we enforce a minimum height of `28px`.
That is a usability decision.

---

## Part 9: How We Calculate Thumb Position

At `apps/web-app/src/components/ai-studio.tsx:346`, `apps/web-app/src/components/ai-studio.tsx:347`, and `apps/web-app/src/components/ai-studio.tsx:348`, we calculate:

- how far the thumb is allowed to move
- how far the content is allowed to scroll
- what percentage of the scroll journey we are currently at

Then we turn that into a `translateY(...)` value.

### Simple mental model

If the user is:

- at the top of the list → thumb should be at the top
- halfway down the list → thumb should be halfway down the rail
- at the bottom of the list → thumb should be near the bottom

That is all this math is doing.
It converts content scroll progress into thumb movement.

---

## Part 10: Why We Use `onScroll`, `useEffect`, And `ResizeObserver`

### `onScroll`
At `apps/web-app/src/components/ai-studio.tsx:406`, we update the custom thumb whenever the user scrolls.

Without that, the thumb would stay frozen.

### `useEffect` after render
At `apps/web-app/src/components/ai-studio.tsx:358`, we call `updateScrollIndicator()` after render.

Why?
Because the list might already overflow as soon as the component appears.
We need one initial measurement.

### `ResizeObserver`
At `apps/web-app/src/components/ai-studio.tsx:374`, we react when the scroll area changes size.

This matters when:

- the window resizes
- layout changes
- content height changes

Without that, the thumb could become the wrong size after layout changes.

---

## Part 11: Why The Footer Needed `z-index`

The footer is here:

- `apps/web-app/src/components/ai-studio.tsx:454`

It uses:

- `relative`
- `z-10`
- `bg-[var(--bg-sidebar)]`

The rail is here:

- `apps/web-app/src/components/ai-studio.tsx:441`

It uses:

- `z-0`

### Why?

Because visually, the rail and the footer area can overlap near the bottom edge.

When we first added the rail, it looked like it was crossing over the footer border and `New Song` area.
That felt wrong.

So we made a layering rule:

- rail stays behind
- footer stays above

That is what `z-index` is doing.

### Why give the footer a background too?

Because if an element is above something else but has a transparent background, you may still see the lower element through it.

Giving the footer the sidebar background color makes it feel solid and intentional.

---

## Part 12: Why `pointer-events: none` Matters

In `apps/web-app/src/styles/app.css:146`, the rail uses:

- `pointer-events: none`

This means:

> “pretend this overlay is not there for mouse/touch interaction.”

That matters because the rail sits on top of the scroll area visually.
Without `pointer-events: none`, it could block:

- clicks
- drags
- scroll interaction

So this is a safety decision.
The rail is visual only, not interactive.

---

## Part 13: Why These Decisions Were Chosen

### Decision 1: Keep real scrolling, fake only the look
We chose this because it is safer.
The browser is still doing the hard work of scrolling.
We are only drawing a visual indicator.

### Decision 2: Use absolute positioning for the rail
We chose this because the rail should float over the content area, not participate in normal layout.

### Decision 3: Use `min-h-0`
We chose this because flexbox often refuses to let a child shrink enough to become scrollable unless you explicitly allow it.

### Decision 4: Use `z-index` for the footer
We chose this because the bottom CTA should visually “win” over the decorative scrollbar.

### Decision 5: Use a minimum thumb size
We chose this because mathematically correct is not always visually usable.
A tiny thumb can be technically correct but bad UX.

---

## Common Junior Developer Questions

### “Why not just use `overflow-y-auto` and stop there?”
You absolutely can.
That is the simpler default.

We only added more logic because we wanted a custom scrollbar look.

### “Why not style the browser scrollbar directly?”
You can style native scrollbars a little, but behavior and appearance are inconsistent across browsers and operating systems.
We wanted a more controlled look.

### “Why is `min-h-0` always the weird fix?”
Because flex items often have a default minimum size behavior that fights scrolling.
It feels weird at first, but it is a very common real-world fix.

### “Why not make the custom thumb draggable too?”
That would be more complex.
Right now the user gets:

- normal scroll behavior
- a cleaner visual scrollbar

That is a good tradeoff for this app.

---

## The Main Takeaway

If you remember only 4 things, remember these:

1. the song list still uses **real browser scrolling**
2. the custom rail/thumb is only a **visual layer**
3. `min-h-0` is what allows the middle flex area to actually become scrollable
4. `z-index` keeps decorative UI from visually fighting important UI like the `New Song` footer

That is the real mental model behind this implementation.
