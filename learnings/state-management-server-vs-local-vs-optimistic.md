# Server State vs Local State vs Optimistic Updates

This note explains how to think about state in our TanStack Start app.

It is written for junior developers.

The goal is to explain:

1. what "server state" means
2. what "local state" means
3. what an "optimistic update" is
4. when to invalidate route data
5. why copying server data into local state often causes bad `useEffect` code

Examples in this note refer to:

- `apps/web-app/src/routes/__root.tsx`
- `apps/web-app/src/routes/song.$songId.tsx`
- `apps/web-app/src/components/ai-studio.tsx`
- `apps/web-app/src/components/song-chat.tsx`

---

## Plain English First

In our app, there are three different kinds of state:

### 1. Server state
Server state is data that comes from the server.

Examples:

- the song list from the root loader
- the song lesson for `/song/$songId`
- the saved chat threads for a song

This data is not invented by the component.
The component only reads it.

### 2. Local state
Local state is UI state that only matters inside the component right now.

Examples:

- whether the chat panel is open
- which thread is currently selected
- whether the delete modal is open
- the text currently typed into an input

This data belongs to the component.

### 3. Optimistic state
Optimistic state means:

- we show the result *before* the server has finished confirming it
- we do this to make the UI feel fast
- if the server fails, we roll back to the old state

Example:

- user sends a chat message
- we show the new message immediately
- then the server streams the real assistant response

Optimistic state is usually still **local UI state**, but it is based on a server mutation.

---

## Terms First

### Loader
A loader is a route-level function that fetches data before the page renders.

In our app:

- `__root.tsx` loads the song list
- `song.$songId.tsx` loads the song page data

### Invalidate
To invalidate means:

- mark previously loaded route data as stale
- ask the router to reload it

In TanStack Router, this is usually `router.invalidate()`.

### Effect
An effect is `useEffect(...)`.

Use an effect when you are syncing with something **outside React**, such as:

- DOM APIs
- event listeners
- timers
- subscriptions
- `ResizeObserver`

Do **not** use an effect just to copy one piece of React state into another.

### Derived state
Derived state means data you can calculate from other data.

If you can compute something during render, you often should.

Example:

- combine server thread data with local optimistic overrides
- calculate the visible thread list from that combination

That is usually better than storing yet another copy in `useState`.

---

## The Mental Model We Want

The clean mental model is:

1. the **router loader** gives us the server snapshot
2. the component keeps only the **extra UI state** it truly owns
3. optimistic changes are stored as **small local overrides**
4. the visible UI is **derived** from server data + local overrides

That keeps the data flow simple:

- server data comes from loaders
- UI state stays local
- optimistic changes are temporary
- fewer effects are needed

---

## The Bad Pattern We Had

In the song assistant, we previously did something like this:

1. receive `initialThreads` from the route loader
2. copy it into local state like `threads` and `threadDetails`
3. add effects that try to "sync" local state whenever `initialThreads` changes
4. call `router.invalidate()` after chat mutations
5. let the new loader data reset the local state again

This seems reasonable at first.
But it creates a mess.

### Why this becomes a problem

Because now we have **two sources of truth**:

- the loader data
- the copied local data

Once that happens, the component starts asking confusing questions:

- which copy is the real one?
- when should local state overwrite loader data?
- when should loader data overwrite local state?
- what happens during a pending mutation?

That confusion usually leads to more `useEffect` code.

For example:

- effect A copies props into state
- effect B merges props into state
- effect C resets UI when props change
- mutation handler invalidates route data
- route reload causes effects to run again

This is how code becomes hard to read and easy to break.

---

## The Better Pattern We Switched To

In `song-chat.tsx`, we changed the model.

### Step 1: treat loader data as the server snapshot

The route already loaded the threads.
That is our server state snapshot.

We do **not** immediately copy it into local state just because it arrived.

Instead, we keep it as the base truth for rendering.

### Step 2: keep only the local state we actually own

The component still needs local state, but only for UI concerns such as:

- `isOpen`
- `activeThreadId`
- `draftThread`
- `threadToDelete`
- `isSubmitting`
- optimistic thread overrides

That is real local state.
It belongs here.

### Step 3: store optimistic changes as overlays, not as a full duplicate

Instead of storing a whole second copy of the server data and trying to keep it synced, we store only the temporary local differences.

Examples:

- a thread the user just deleted locally
- a thread that has streamed new messages not yet reflected in route data
- a draft thread that does not exist on the server yet

Then we derive the visible result from:

- `serverThreadDetails`
- `threadOverrides`
- `deletedThreadIds`

That is much easier to reason about.

### Step 4: derive what the UI should show

The visible thread list is calculated from the base data plus the local overrides.

This is important.

We are not saying:

> "Copy all the data into state, then keep mutating the copy forever."

We are saying:

> "Start from the loader snapshot, then layer temporary UI changes on top."

That is a much safer pattern.

---

## Why This Avoids Extra Effects

If you copy server data into local state, you often need an effect like this:

```tsx
useEffect(() => {
  setThreads(initialThreads)
}, [initialThreads])
```

That effect is often a code smell.

Why?

Because the component is saying:

- "I received data"
- "Now I need another state variable to hold the same data"
- "Now I need an effect to keep them aligned"

That is usually unnecessary.

Instead, ask:

1. can I render directly from the loader data?
2. if not, what is the *smallest* local state I actually need?
3. can I derive the final view from both?

If the answer is yes, you probably do not need that effect.

---

## When `router.invalidate()` Is Correct

TanStack Router's docs say that when a mutation makes current loader data stale, `router.invalidate()` can be used to reload the current route matches in the background. That is useful.

But it should be used deliberately.

### Good use cases for invalidation

Use invalidation when:

- a mutation changed data owned by the current route loader
- you want the route loader to fetch a fresh server snapshot
- the changed data matters to more than one part of the screen
- you do not already have the final authoritative data locally

In our app, invalidating after **song creation** or **song deletion** makes sense, because route-level data like the song list or song page data should refresh.

### Bad use cases for invalidation

Do **not** invalidate just because a mutation happened.

That is too blunt.

For the song assistant chat widget:

- the chat send mutation already gives us the final thread state
- only the chat widget cares about that temporary streaming state
- we can update the widget locally without refetching the whole route

So invalidating the whole router after every chat send or thread delete is unnecessary noise.

It adds more moving pieces without giving us better correctness.

---

## When Optimistic Updates Are a Good Idea

Optimistic updates are good when the user should see an immediate result.

In chat, that is a very good fit.

The user expects:

- their message to appear immediately
- the assistant bubble to appear immediately
- the assistant response to stream in as it arrives

Waiting for a full refetch first would feel slow and awkward.

So the optimistic flow is:

1. append the user message immediately
2. append an empty assistant placeholder immediately
3. stream text into that placeholder
4. replace the temporary optimistic state with the final server thread
5. if the mutation fails, roll back

That is exactly the kind of UI where optimistic updates help.

---

## Local Optimistic UI vs Shared Cache Optimistic UI

This distinction matters.

### Option 1: optimistic update only in one component

This is the simpler case.

If only one place on the screen needs the optimistic result, local UI state is often enough.

That is what we are doing in the chat widget right now.

Why this works:

- only the widget cares about the temporary streamed message
- the mutation result comes back directly to that widget
- we can roll back locally if needed

### Option 2: optimistic update in many places

If multiple components need to see the same optimistic result, local component state stops scaling well.

Examples:

- a thread list in one component
- a thread detail panel in another component
- an unread count badge somewhere else
- a dashboard summary elsewhere on the page

Now you have shared server state.

This is where **TanStack Query** becomes a better fit.

TanStack Query's docs say:

- if only one place needs the optimistic result, updating the UI directly is simpler
- if many places need it, update the shared cache instead

That is the key rule.

---

## So Should We Use TanStack Query Here?

Maybe later, yes.

Right now, our chat widget can still be handled cleanly without it because:

- the route loader gives us the initial server snapshot
- the widget owns the temporary optimistic state
- the mutation returns the final thread

That is still manageable.

But if chat state becomes more shared across the app, TanStack Query would probably be the cleaner long-term choice.

Why?

Because then we could:

- keep shared server state in the query cache
- do optimistic cache updates in one place
- invalidate or refetch the exact query keys we need
- avoid passing increasingly complicated state logic through one component

TanStack Router and TanStack Query work well together here:

- Router coordinates route loading
- Query owns long-lived shared server cache

That is the big idea from TanStack Router's "External Data Loading" guide.

---

## A Simple Decision Guide

When adding state, ask these questions in order.

### Question 1: Did this data come from the server?

If yes, start by treating it as **server state**.

Do not immediately copy it into local state.

### Question 2: Is this just UI behavior?

If yes, use **local state**.

Examples:

- open or closed
- selected tab
- modal visibility
- current input text

### Question 3: Do I need to show a result before the server confirms it?

If yes, use an **optimistic update**.

### Question 4: Does only one component care about that optimistic state?

If yes, local optimistic state is often fine.

### Question 5: Do many components need to see that optimistic state?

If yes, move toward **TanStack Query cache updates** instead of component-local hacks.

### Question 6: Am I about to write an effect that copies props or loader data into state?

Stop and ask:

- can I derive this instead?
- can I render directly from the source data instead?

Very often, the answer is yes.

---

## Practical Rules Of Thumb

Here are the rules I would give a junior developer.

### Rule 1
Loader data is your server snapshot, not something you should duplicate by default.

### Rule 2
Keep local state for UI concerns, not for mirrored copies of server data.

### Rule 3
If you need optimistic UI, store the smallest possible temporary override.

### Rule 4
If you are writing `useEffect(() => setSomething(propsValue), [propsValue])`, that is a warning sign.

### Rule 5
Invalidate route data when route-owned loader data is stale.
Do not invalidate just because it feels safer.

### Rule 6
If the same server data is being coordinated across many components, TanStack Query is often the right tool.

---

## The Main Lesson

The big lesson is not just "use fewer effects."

The real lesson is:

> Put each kind of state in the right place.

When state is in the wrong place, code gets weird:

- duplicated state
- sync effects
- reset effects
- invalidation everywhere
- hard-to-explain bugs

When state is in the right place, the code gets simpler:

- server snapshot from loaders
- local UI state in components
- optimistic overrides for temporary fast feedback
- derived rendering instead of sync effects

That is the pattern we want to keep following.

---

## Sources

- TanStack Router, "External Data Loading": https://tanstack.com/router/latest/docs/guide/external-data-loading
- TanStack Router, "Data Mutations": https://tanstack.com/router/latest/docs/guide/data-mutations
- TanStack Query, "Optimistic Updates": https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
