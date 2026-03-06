# Scrolling to Bottom Without useEffect

This note explains how we handle auto-scrolling in the chat UI without `useEffect`, and the React patterns behind it.

It is written for junior developers.

The goal is to explain:

1. why `useEffect` was a bad fit here
2. how to compare previous and current values with refs
3. what `queueMicrotask` does and why we need it
4. the general principle of "you might not need an effect"

Examples in this note refer to:

- `apps/web-app/src/components/chat-mock-1.tsx` (the `Conversation` component)

---

## The Problem

We have a chat message list. When a new message appears, we want to scroll to the bottom so the user sees it. Sounds simple.

## Attempt 1: useEffect with Dependencies

The first instinct is to reach for `useEffect`:

```tsx
useEffect(() => {
  scrollRef.current?.scrollTo({
    top: scrollRef.current.scrollHeight,
    behavior: "smooth",
  });
}, [thread.messages.length, isTyping]);
```

This has two problems:

1. **Biome (our linter) rejects it.** Biome's `useExhaustiveDependencies` rule considers props like `thread.messages.length` and `isTyping` to be "outer scope values" and flags them as unnecessary dependencies. This is arguably a biome limitation (ESLint's equivalent rule handles this fine), but we still need to satisfy our linter.

2. **It's conceptually the wrong tool.** We're not synchronizing with an external system (a DOM API, a subscription, a timer). We're reacting to a prop change. React has a better pattern for that.

## Attempt 2: useEffect with No Dependencies

To dodge the linter, we tried removing the dependency array entirely:

```tsx
useEffect(() => {
  endRef.current?.scrollIntoView({ behavior: "smooth" });
});
```

A `useEffect` with no dependency array runs after **every single render**. That includes renders caused by typing into the input field. So every keystroke scrolled the chat to the bottom. Terrible UX.

## Attempt 3 (Final): Ref Comparison in the Render Body

The solution is to not use `useEffect` at all. Instead, we compare the current and previous message count directly during render:

```tsx
const endRef = useRef<HTMLDivElement>(null);
const prevMessageCount = useRef(thread.messages.length);

if (thread.messages.length !== prevMessageCount.current) {
  prevMessageCount.current = thread.messages.length;
  queueMicrotask(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  });
}
```

This runs during the render itself, not in an effect. Let's break down each piece.

---

## Pattern: Using Refs to Track Previous Values

A `useRef` holds a value that **persists across renders** but **doesn't trigger a re-render** when you change it. That makes it perfect for remembering "what was the value last time?"

```tsx
const prevMessageCount = useRef(thread.messages.length);
```

On the first render, `prevMessageCount.current` is set to the initial message count. On subsequent renders, it still holds whatever we last assigned to it. So we can compare:

```tsx
if (thread.messages.length !== prevMessageCount.current) {
  // A new message appeared!
  prevMessageCount.current = thread.messages.length; // Update for next time
}
```

This comparison runs every render, but the code inside the `if` only runs when the message count actually changed. Typing into the input? `thread.messages.length` hasn't changed, so nothing happens.

### Why not useState for tracking the previous value?

If you used `useState` to store the previous count and called `setState` to update it, that would trigger **another render**, which would be wasteful. Refs let you store mutable data without causing re-renders.

---

## What is queueMicrotask?

When React renders, it builds a virtual DOM and then **commits** it to the real DOM. If we call `scrollIntoView` during the render phase (before the commit), the new message DOM node might not exist yet. The scroll would target stale content.

`queueMicrotask` schedules a function to run **after the current task completes but before the browser paints**. In practice, this means:

1. React finishes rendering and commits the new DOM (the new message node exists)
2. Our microtask runs and scrolls to it
3. The browser paints the result

```tsx
queueMicrotask(() => {
  endRef.current?.scrollIntoView({ behavior: "smooth" });
});
```

It's lighter than `setTimeout` (which waits for the next event loop tick and can cause visible flicker). It runs sooner and more predictably.

### The sentinel div pattern

Instead of calculating scroll positions manually, we place an empty div at the bottom of the message list:

```tsx
<div ref={endRef} />
```

Then `endRef.current.scrollIntoView()` simply scrolls the container until that div is visible. The browser handles all the math.

---

## The General Principle: You Might Not Need an Effect

The React docs have [a whole page](https://react.dev/learn/you-might-not-need-an-effect) about this. The rule of thumb:

- **useEffect** is for synchronizing with **external systems** (DOM APIs you don't control, network requests, subscriptions, timers).
- **Responding to prop/state changes** often belongs in the **render body** or in **event handlers**.

In our case, "scroll when message count changes" is responding to a prop change. It belongs in the render body with a ref comparison, not in an effect.

### When you would still use useEffect

- Subscribing to a WebSocket or event listener (needs cleanup)
- Fetching data on mount
- Locking body scroll when a modal opens (like we do in `ChatMock1` for the overlay)
- Setting up intersection observers or resize observers

The test: "Am I synchronizing with something outside React's control?" If yes, use an effect. If you're just reacting to React state/props changing, there's probably a better way.
