# TanStack Query Pattern For Server State And Local UI State

This note explains the general pattern we should follow in this codebase when we use **TanStack Router** and **TanStack Query** together.

It is written for junior developers.

This is intentionally detailed.
The goal is not just to show the final code.
The goal is to help you understand **why** the pattern works.

We will cover:

1. what each tool is responsible for
2. how to separate server state from local UI state
3. how route loaders and Query should work together
4. when to use optimistic updates
5. when optimistic state should stay local vs go into the Query cache
6. common mistakes that lead to unreadable `useEffect` code

Examples in this note refer to our app:

- `apps/web-app/src/router.tsx`
- `apps/web-app/src/routes/__root.tsx`
- `apps/web-app/src/routes/song.$songId.tsx`
- `apps/web-app/src/utils/songs.query-options.ts`
- `apps/web-app/src/components/song-chat.tsx`

---

## Plain English First

If you only remember one thing, remember this:

> **TanStack Router loads data for routes. TanStack Query stores shared server data. React component state stores local UI behavior.**

That is the whole pattern.

Everything else is a detail.

When code gets messy, it is usually because we mixed those jobs together.

Examples of mixing responsibilities:

- route data copied into local `useState`
- local UI state stored in the Query cache
- optimistic updates shoved into random effects
- `router.invalidate()` used as a hammer for every mutation

When each tool does its own job, the code gets simpler.

---

## Terms First

Before we talk about the pattern, define the important words.

### Server state
Server state is data that comes from the server and can be fetched again.

Examples:

- song list
- song detail page data
- saved chat threads

Important property:

- the component does **not** truly own this data
- the server is the real source of truth

### Local UI state
Local UI state is state that only matters to the current component or current screen interaction.

Examples:

- is the modal open?
- what tab is selected?
- what text is typed into the input right now?
- which thread is currently selected in the chat panel?

Important property:

- this state belongs to the UI itself
- the server does not own it

### Query cache
The Query cache is TanStack Query's shared memory for server state.

In plain English:

- fetch once
- store the result
- let many components read it
- update it or refetch it when needed

### Loader
A loader is route-level code that makes sure data is ready before the route renders.

In our app, the loader usually calls `queryClient.ensureQueryData(...)`.

That means:

- if the query is already ready, use it
- otherwise fetch it now

### Optimistic update
An optimistic update means the UI shows a result **before the server has fully confirmed it**.

Example:

- user sends a message
- we show the user message immediately
- we show the assistant placeholder immediately
- then the real server result arrives later

### Invalidate
Invalidate means:

- mark cached server data as stale
- allow or trigger a refetch

With TanStack Query, this is usually `queryClient.invalidateQueries(...)`.

---

## The Big Mental Model

When we use Router and Query together, the jobs are:

### TanStack Router's job
Router decides:

- which route is being shown
- what data is needed before render
- when navigation happens
- when route loaders should run
- how SSR and preloading work

Router is the **coordinator**.

### TanStack Query's job
Query decides:

- how server data is cached
- who reads it
- when it becomes stale
- how to update it after mutations
- how to do optimistic cache updates and rollbacks

Query is the **server-state store**.

### React component state's job
Component state decides:

- what the user is doing right now
- what the component should look like right now

React state is the **local UI store**.

---

## A Useful Analogy

Imagine a restaurant.

### Router is the host
The host decides:

- which table you go to
- what room you enter
- which staff should prepare for you

### Query is the kitchen order board
The kitchen board stores the current known orders.
Many people can look at it.
It gets updated when something changes.

### Local React state is your table conversation
This is the stuff only your table cares about right now:

- who is about to order
- who opened the menu
- who changed their mind

If you tried to store table conversation on the kitchen board, that would be weird.
If you tried to store the kitchen board only at one table, that would also be weird.

That is exactly what happens when we mix local UI state and server state incorrectly.

---

## The Pattern We Want To Follow

This is the recommended pattern for our app.

### Step 1: define reusable query options

Put the query key and fetch function in one place.

In our app, that is:

- `apps/web-app/src/utils/songs.query-options.ts`

This file answers questions like:

- what is the query key for the songs list?
- what is the query key for a song page?
- how do we fetch that data?

Why this matters:

- every route and component uses the same query key
- every mutation updates the same cache entry
- fewer bugs from slightly different keys or slightly different fetch logic

This is one of the most important discipline rules.

Do **not** scatter query keys all over the app.

---

### Step 2: create one QueryClient for the router instance

In our app:

- `apps/web-app/src/router.tsx`

The router creates a QueryClient and puts it into router context.

Why this matters:

- loaders need access to Query
- components need the same shared cache
- SSR dehydration/hydration needs one consistent client per router instance

This matches TanStack's guidance: when using Query with Router, create the QueryClient where the router is created, especially for SSR.

---

### Step 3: route loaders should ensure critical data is in the Query cache

In our app:

- `__root.tsx` ensures the songs list query
- `song.$songId.tsx` ensures the song page query

The key idea is:

```tsx
loader: ({ context }) => {
  return context.queryClient.ensureQueryData(someQueryOptions())
}
```

Plain English:

- before the route renders, make sure the query data exists
- if the cache already has good data, use it
- if not, fetch it now

### Why loaders should do this

Because critical render data should be ready before the page tries to render.

That helps us avoid:

- loading flashes
- component-level request waterfalls
- route screens that render before their main data is available

This is one of the biggest lessons from TanStack Router's external data loading docs.

Router should coordinate loading.
Query should store the result.

---

### Step 4: components should read server data from Query

Once the loader has ensured the query is ready, the component should read from Query using `useSuspenseQuery(...)` or another appropriate Query hook.

In our app:

- root component reads songs list from Query
- song route reads song page data from Query
- `SongChat` now reads chat threads from Query directly

Why this matters:

- the query cache becomes the shared source of truth for server state
- components do not need their own mirrored copies
- if multiple components care about the same server data, they stay in sync automatically

This is the point where many apps go wrong.

They do this:

1. fetch with Query
2. copy query data into `useState`
3. add effects to keep the copy synced

That almost always makes the code worse.

---

## The Rule: Do Not Mirror Query Data Into Local State By Default

This is worth saying very clearly.

If data already lives in TanStack Query, do **not** immediately do this:

```tsx
const { data } = useSuspenseQuery(...)
const [localCopy, setLocalCopy] = useState(data)

useEffect(() => {
  setLocalCopy(data)
}, [data])
```

This is usually bad.

### Why it is bad

Because now you have two copies:

- the Query cache copy
- the component-local copy

Then you create hard questions:

- which one is the real one?
- when should the local copy reset?
- when should the local copy survive route changes?
- what happens during mutations?
- what happens when background refetches complete?

And then the code starts growing ugly effects just to keep those copies aligned.

That is exactly the kind of pattern we are trying to avoid.

---

## What Belongs In Local State Instead?

Local state is still important.

It just needs to store the **right kind** of data.

Examples that belong in local state:

- `isOpen`
- `activeThreadId`
- `draftThread`
- `threadToDelete`
- current form input text
- whether a modal or menu is open
- temporary animation flags

These are UI concerns.
They are not shared server data.

That means React `useState` is the right place.

---

## So What About Optimistic Updates?

Optimistic updates are where this becomes interesting.

There are two broad ways to do optimistic UI with TanStack Query.

### Option 1: optimistic UI only in one component

TanStack Query docs explain that if only one place needs to show the temporary optimistic result, the simplest thing can be to render it from mutation state or local UI state.

This is the lighter approach.

Example:

- a single form shows a temporary pending item
- no other component on the screen cares yet

In that case, a local optimistic UI can be enough.

### Option 2: optimistic cache update

If multiple parts of the screen need to see the optimistic result, update the Query cache.

This is the pattern we now use for the song assistant.

Why?

- the thread list and active conversation both depend on the same thread data
- updating the cache keeps them in sync
- we do not need separate local mirrors of server data

This is the main reason Query becomes valuable.

---

## The Song Assistant As A Concrete Example

The song assistant is a good example because it has all the hard parts:

- shared server data
- local UI state
- optimistic updates
- streaming mutation results

### What is server state there?

- saved chat threads for the song

That lives in the `songPageData` query.

### What is local UI state there?

- is the assistant open?
- which thread is active?
- is there a draft thread?
- is the delete modal open?
- what error message should the widget show right now?

### What is optimistic state there?

- the temporary user message we show immediately
- the temporary assistant placeholder
- the partial assistant text as it streams in

### Where should that optimistic state live?

Because the visible chat data is shared inside the widget between the thread list and the active conversation view, we update the Query cache for the server-backed thread data.

But we still keep the **draft thread** local, because a draft thread does not exist on the server yet.

This is an important nuance.

Not all temporary state belongs in the Query cache.
Only the part that is acting like shared server data should go there.

---

## A Very Practical Rule For Mutations

When writing a mutation, ask this question:

> After this mutation starts, who needs to see the temporary result?

### If the answer is “only this one component”

Keep the temporary optimistic state local if that is simpler.

### If the answer is “multiple components or multiple views”

Update the Query cache in `onMutate`.

That is the dividing line.

---

## The Mutation Pattern We Should Use

When a mutation changes cached server data, the standard Query pattern is:

1. `onMutate`
2. update the cache optimistically
3. return rollback context
4. `onError` restores old data if needed
5. `onSuccess` writes the authoritative server result
6. optionally invalidate if a refetch is still needed

Let's explain each part in plain English.

### `onMutate`
This runs before the mutation finishes.

Use it to:

- cancel related queries if needed
- grab the previous cached value
- write an optimistic cached value
- return whatever you need for rollback

### `onError`
If the mutation fails, this should restore the old cache state if the optimistic update changed shared server data.

### `onSuccess`
If the server gives back the final correct data, write that into the cache.

### `invalidateQueries`
Use this when the cache should refetch because the mutation result did not already give you the final correct data.

This last point is important.

Do **not** invalidate automatically out of habit.

If you already have the full correct server result, updating the cache directly is often enough.

---

## When To Invalidate And When Not To

This is one of the most common sources of overcomplicated code.

### Invalidate when:

- you know cached data is stale
- you do not already have the final authoritative result
- multiple related queries may need fresh server truth

### Do not invalidate just because a mutation happened

That is too broad.

If the mutation response already includes the final thread, list item, or entity you need, you can often write that straight into the cache and stop there.

In our chat case:

- we stream temporary optimistic text
- then we receive the final resolved thread
- that final resolved thread is enough to update the cache directly

So we do not need to refetch the whole route every time a message is sent.

---

## Why This Pattern Reduces `useEffect`

Bad state architecture usually creates lots of effects.

Typical ugly pattern:

1. query loads server data
2. component copies it into local state
3. effect syncs local state when query data changes
4. another effect resets UI when props change
5. mutation invalidates everything
6. route reload causes all those effects to fire again

This becomes very hard to reason about.

The cleaner pattern is:

1. route loader ensures the query is ready
2. component reads the query directly
3. local state only stores UI behavior
4. mutation updates the cache directly if needed
5. effects are only for external systems

That last point matters.

Effects should mostly be used for things like:

- event listeners
- body scroll locking
- timers
- `ResizeObserver`
- DOM APIs

Effects should **not** be our main strategy for keeping state sources synchronized.

---

## A Step-By-Step Decision Tree

When adding new state, ask these questions in order.

### Question 1: Did this data come from the server?

If yes, start by treating it as **server state**.

### Question 2: Will more than one component or view need this server data?

If yes, it probably belongs in **TanStack Query**.

### Question 3: Is this only about what the UI is doing right now?

If yes, it belongs in **local React state**.

### Question 4: Do I need to show a temporary result before the server confirms it?

If yes, you need an **optimistic update**.

### Question 5: Who needs to see that optimistic result?

If only one component needs it:

- local optimistic UI may be enough

If many components/views need it:

- update the Query cache in `onMutate`

### Question 6: Am I about to write an effect that copies Query data into local state?

Stop.

Ask:

- can I render directly from the query?
- can I store only the small UI state I actually own?
- can I update the cache instead of making a local mirror?

Most of the time, that leads to a better design.

---

## A Good Default Structure For New Features

If you are building a new feature, this is a good default structure.

### 1. Server functions
Put the actual server work in server functions.

Examples:

- fetch entity
- create entity
- delete entity
- update entity

### 2. Query options file
Create a query-options file that defines:

- query keys
- query functions
- small helper functions for cache updates if useful

### 3. Route loader
In the route loader, call `ensureQueryData(...)` for critical render data.

### 4. Screen component
Read data from Query using `useSuspenseQuery(...)` or another appropriate Query hook.

### 5. Local UI state
Keep only local UI concerns in `useState`.

### 6. Mutations
Use `useMutation(...)`.

For each mutation, decide:

- local optimistic UI only?
- or shared cache optimistic update?

### 7. Invalidation
Only invalidate queries that actually need refetching.

This structure scales much better than random data fetching inside components.

---

## Common Mistakes To Avoid

Here is a short list of things we should watch out for.

### Mistake 1: copying query data into local state by default

This creates sync problems and unnecessary effects.

### Mistake 2: storing local UI state in Query

Examples:

- whether a modal is open
- which accordion section is expanded
- whether a panel is visible

That belongs in component state, not server cache.

### Mistake 3: invalidating everything after every mutation

This is lazy and noisy.
Invalidate only what is actually stale.

### Mistake 4: using Query cache for data that is not actually shared

If only one component needs a temporary value, local state may be simpler.

### Mistake 5: using effects to keep copies of state aligned

If you need many sync effects, that usually means the state boundaries are wrong.

### Mistake 6: query keys defined ad hoc in many places

Put them in one file so the app uses the same keys everywhere.

---

## The Main Lesson

The real lesson is not just:

> "Use TanStack Query."

The real lesson is:

> "Put each kind of state in the right place, and let each tool do its own job."

When we do that:

- Router coordinates loading
- Query stores shared server data
- component state stores local UI behavior
- optimistic updates are explicit and readable
- effects become rare and easier to understand

That is the general pattern we should keep following.

---

## Sources

- TanStack Router, "External Data Loading": https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading
- TanStack Router, "TanStack Query Integration": https://tanstack.com/router/v1/docs/integrations/query
- TanStack Router, "Data Mutations": https://tanstack.com/router/latest/docs/framework/react/guide/data-mutations
- TanStack Router, "Preloading": https://tanstack.com/router/latest/docs/framework/react/guide/preloading
- TanStack Query, "Optimistic Updates": https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
