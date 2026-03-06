# Flashcard Card Mechanics

This note explains how our flashcard card works in `apps/web-app`.

It focuses on two things:

1. how the card flips
2. how the card can be dragged left and right, with a safe zone before a swipe actually commits

---

## Plain English First

Think of the flashcard as a little stage with two paper faces:

- the **front face**
- the **back face**

Both faces exist at the same time.
We do **not** remove one and render the other.
Instead, we put them on top of each other, rotate the back face 180 degrees, and then rotate the whole card when the user flips it.

That is why the animation looks like a real card turn, not like content just swapping.

For dragging, think of the top card like a physical card on a desk:

- if you pull it a little left or right, it follows your finger
- if you let go too early, it goes back to the center
- if you drag far enough, it counts as an action
  - right = remembered
  - left = forgotten / again

That “far enough” rule is the **drag zone threshold**.

So the full behavior is:

- **flip** is a rotation animation
- **drag** is horizontal movement with rules
- **safe zone** means “not far enough yet, snap back home”

---

## Terms First

Before going deeper, here are the main terms:

### Perspective
A CSS setting that makes 3D transforms look believable.
Without perspective, a 3D rotation looks flat and fake.

### Transform
A CSS way to move, rotate, scale, or skew an element.
Examples:

- `translateX(...)`
- `rotate(...)`
- `rotateY(...)`
- `scale(...)`

### 3D transform
A transform that uses 3D space, like `rotateY(180deg)`.
That is what gives the card-flip effect.

### Backface visibility
When you rotate an element, the “back” of that element can become visible.
`backface-visibility: hidden` tells the browser to hide that reverse side.

### Motion value
A reactive value from Motion that changes continuously during interaction.
We use it for the drag position.

### Threshold
A cutoff value.
In our case: “if drag distance is more than this number, treat it as a committed swipe.”

---

## Where The Logic Lives

### CSS
The 3D flip styling is in:

- `apps/web-app/src/styles/app.css:118`
- `apps/web-app/src/styles/app.css:122`
- `apps/web-app/src/styles/app.css:129`
- `apps/web-app/src/styles/app.css:135`
- `apps/web-app/src/styles/app.css:139`
- `apps/web-app/src/styles/app.css:147`
- `apps/web-app/src/styles/app.css:187`

### React / Motion
The drag + flip behavior is in:

- `apps/web-app/src/components/ai-studio.tsx:233`
- `apps/web-app/src/components/ai-studio.tsx:251`
- `apps/web-app/src/components/ai-studio.tsx:264`
- `apps/web-app/src/components/ai-studio.tsx:288`
- `apps/web-app/src/components/ai-studio.tsx:362`

---

## Part 1: How The Flip Works

## The Basic Structure

The card is built like this:

- a **scene**
- a **shell**
- an **inner wrapper** that rotates
- two **faces** inside it

In the code:

- `.flashcard-scene` adds perspective
- `.flashcard-shell` sets up a 3D container
- `.flashcard-inner` is the part that rotates
- `.flashcard-face` is the shared face styling
- `.flashcard-face-back` is the back face, already rotated 180 degrees

### Relevant CSS

From `apps/web-app/src/styles/app.css:118`:

- `.flashcard-scene { perspective: 1800px; }`

This tells the browser:

> “Treat this area like a 3D stage.”

From `apps/web-app/src/styles/app.css:129`:

- `.flashcard-inner` has `transform-style: preserve-3d`
- it also has a transition on `transform`

That means:

- children keep their 3D positions
- when `transform` changes, the browser animates it smoothly

From `apps/web-app/src/styles/app.css:135`:

- `.flashcard-inner.is-flipped { transform: rotateY(180deg); }`

This is the whole flip.
When the `is-flipped` class appears, the entire inner card rotates around the Y axis.

From `apps/web-app/src/styles/app.css:139`:

- `.flashcard-face` is absolutely positioned
- it fills the same space as the other face
- `backface-visibility: hidden`

That means both faces are stacked exactly on top of each other, but the hidden backside is not shown during rotation.

From `apps/web-app/src/styles/app.css:147`:

- `.flashcard-face-back { transform: rotateY(180deg) translateZ(1px); }`

This rotates the back face so that when the parent flips, the back becomes readable.

### Why We Need Two Faces

A junior developer often asks:

> “Why not just toggle content with `{isFlipped ? back : front}`?”

You *can* do that, but then you are not really flipping a card.
You are just swapping text.

For a believable card flip, both faces must already exist.
The animation is then just rotation.

### How React Triggers The Flip

In `apps/web-app/src/components/ai-studio.tsx:362`, the class is toggled like this:

- `flashcard-inner`
- plus `is-flipped` when `isFlipped` is true

So React controls **state**, and CSS handles **animation**.

That separation is important:

- React decides *whether* the card is flipped
- CSS decides *how* the flip looks

---

## Part 2: How Dragging Works

## The Goal

We want the top card to behave like a swipeable flashcard.
But we do **not** want accidental swipes.

So the behavior is:

- drag a little → card moves, but not committed
- release before threshold → card returns to center
- drag beyond threshold → card is accepted as left or right swipe

### The Threshold

At the top of the file, we define:

- `REVIEW_DRAG_THRESHOLD = 110`

This is the drag zone rule.

Plain English:

- if horizontal drag is less than 110px, do nothing permanent
- if it is 110px or more to the right, count it as remembered
- if it is 110px or more to the left, count it as forgotten

This is the “safe zone.”

### Motion Values

In `apps/web-app/src/components/ai-studio.tsx:251`:

- `const dragX = useMotionValue(0);`
- `const dragRotate = useTransform(dragX, [-220, 0, 220], [-10, 0, 10]);`

This means:

- `dragX` stores the live horizontal position
- `dragRotate` maps that horizontal movement into a small rotation

So when you drag right, the card tilts a bit right.
When you drag left, it tilts left.
That makes the card feel more physical.

### Drag Constraints

In the top `motion.div`, we set:

- `drag="x"`
- `dragConstraints={{ left: 0, right: 0 }}`
- `dragElastic={0.18}`
- `dragMomentum={false}`

What these mean:

#### `drag="x"`
Only allow horizontal dragging.
No vertical dragging.

#### `dragConstraints={{ left: 0, right: 0 }}`
This sounds strange at first.
It does **not** mean the card cannot move.
Because drag is still allowed, but the movement behaves like an elastic pull around the origin.

That works well for “swipe from center” interactions.

#### `dragElastic={0.18}`
This controls how stretchy the drag feels.
A smaller number feels tighter.
A larger number feels looser.

#### `dragMomentum={false}`
When the user releases, we do not want the card to keep flying because of momentum physics.
We want our own app logic to decide:

- commit swipe
- or snap back

---

## Part 3: How The Drag Zones Work

### During Drag

In `handleDrag`, we read `info.offset.x`.
That is the current horizontal drag distance.

We then classify the drag into one of three states:

- `remembered`
- `forgotten`
- `return`

Plain English:

- far right → “this will count as known”
- far left → “this will count as again”
- moved, but not enough → “this will return”

That is what drives the small hint label.

### On Release

In `handleDragEnd`, we check the final horizontal offset.

Rules:

- `>= REVIEW_DRAG_THRESHOLD` → call `onRemember()`
- `<= -REVIEW_DRAG_THRESHOLD` → call `onForget()`
- otherwise → do nothing permanent

If we do nothing permanent, Motion naturally returns the card to its original position.
That is the snap-back behavior.

This is an important lesson:

> You do not always need special “snap back” code.
> Sometimes the animation library already returns the element to its base state when drag ends and no new state is committed.

---

## Part 4: The Visual Drag Feedback

We use more than movement.
We also use:

- tilt
- gradient glow
- hint text

### Tilt
Already covered through `dragRotate`.
This makes the card feel more like paper.

### Glow
The left and right overlay glows are controlled by motion values derived from `dragX`.

That means:

- drag left → dark left-side hint becomes stronger
- drag right → orange right-side hint becomes stronger

This gives the user a subtle preview of what action is about to happen.

### Hint Text
We show small copy like:

- `Release to mark known`
- `Release for again`
- `Release to return`

That text comes from `dragIntent`.
So the app is always telling the user:

- what their current drag means
- whether they are still in the safe zone

---

## Part 5: Why Only The Top Card Drags

Only the top card is draggable.
The cards underneath are preview cards.

That is important because it keeps the system easy to reason about:

- top card = interactive
- cards underneath = visual stack only

If every card were draggable, the stack would become confusing.

This is also why `ReviewTopCard` and `ReviewPreviewCard` are separate components.
They have different responsibilities.

---

## Part 6: Mental Model To Remember

If you are teaching this to yourself, remember it like this:

### Flip
- two faces exist at once
- the inner wrapper rotates
- hidden backfaces stop mirrored weirdness

### Drag
- track horizontal offset
- compare against a threshold
- below threshold = safe return
- beyond threshold = commit action

### UX Principle
- the user should always understand what will happen before release

That is why we combine:

- movement
- tilt
- glow
- labels

---

## Common Mistakes

### Mistake 1: Only Rendering One Face
Then you do not get a real flip. You only get a content swap.

### Mistake 2: Forgetting `backface-visibility: hidden`
Then mirrored text or weird back surfaces can show during rotation.

### Mistake 3: No Perspective
Then the flip feels flat and fake.

### Mistake 4: No Threshold
Then tiny accidental drags trigger destructive actions.

### Mistake 5: Mixing Too Much Logic Into CSS
CSS should animate the flip.
React/Motion should decide when the state changes.

---

## If You Want To Rebuild This Yourself

Build it in this order:

1. create a container with perspective
2. add an inner wrapper that can rotate
3. add front and back faces
4. hide backfaces
5. toggle a `rotateY(180deg)` class for flipping
6. add horizontal drag with Motion
7. add a threshold for commit vs return
8. add visual hints only after the behavior works

That order matters.
Get the mechanics working first, then layer in polish.
