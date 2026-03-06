# TanStack Start Guide For Next.js Developers

This note is for a junior developer who already knows some Next.js and is trying to understand TanStack Start.

The goal is not to explain everything.
The goal is to help you become productive quickly.

We will cover:

1. how to create new routes
2. how to fetch data from the server
3. how loading works
4. what mental model to use if you are coming from Next.js

Examples in this note refer to our current app:

- `apps/web-app/src/routes/__root.tsx:12`
- `apps/web-app/src/routes/song.$songId.tsx:5`
- `apps/web-app/src/utils/songs.functions.ts:1`
- `apps/web-app/src/utils/songs.server.ts:1`

---

## Plain English First

If you come from Next.js, here is the simplest way to think about TanStack Start:

### Next.js mental model
In Next.js App Router, you often think in terms of:

- folders as routes
- server components
- client components
- `loading.tsx`
- `Suspense`
- server actions

### TanStack Start mental model
In TanStack Start, think in terms of:

- **route files**
- **route loaders**
- **server functions**
- **route data**
- **pending UI**

A very practical summary is:

- a **route file** defines a page
- a **loader** fetches the data for that page
- a **server function** is code that definitely runs on the server
- `Route.useLoaderData()` gives you the result in the component

So instead of thinking:

> “Is this a server component or a client component?”

You often think:

> “What route is this, what data does it need, and which server function should load it?”

---

## Terms First

### Route
A route is a page or URL.
Examples:

- `/`
- `/song/1`

### Loader
A loader is a function attached to a route.
Its job is to fetch the data needed before the page renders.

### Server function
A server function is code that runs on the server.
In TanStack Start, you usually create one with `createServerFn(...)`.

### Pending state
A pending state means the route is still loading.
This is TanStack Start’s general “loading is happening” concept.

### Deferred data
Deferred data means:

- do not wait for everything before rendering
- render some UI now
- let slower pieces finish later

If you know React `Suspense`, this will feel familiar.

---

## Part 1: How To Create New Routes

In our app, routes live in `src/routes`.

### Example: home route

File:

- `apps/web-app/src/routes/index.tsx:1`

This defines `/`.

### Example: dynamic song route

File:

- `apps/web-app/src/routes/song.$songId.tsx:1`

This defines `/song/$songId`.
That means URLs like:

- `/song/1`
- `/song/2`

In plain English:

- `index.tsx` = homepage
- `$songId` = dynamic URL segment

If you want to add a new route, you usually:

1. create a file in `src/routes`
2. call `createFileRoute(...)`
3. export the route config
4. export or define the component for that page

### Example shape

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/albums/$albumId")({
  component: AlbumPage,
});

function AlbumPage() {
  return <div>Album page</div>;
}
```

That is the basic route pattern.

---

## Part 2: Where Shared App Layout Lives

The root route is special.

In our app:

- `apps/web-app/src/routes/__root.tsx:12`

This is where we define:

- document metadata
- global shell
- root-level data loading
- error boundaries
- not found handling

In our case, the root loader fetches the song library once:

- `getSongsListFn()` in `apps/web-app/src/routes/__root.tsx:28`

Then the root component reads it with:

- `Route.useLoaderData()` in `apps/web-app/src/routes/__root.tsx:52`

That data is passed into the shell so the sidebar has the song list.

This is similar to how you might put shared layout data in a Next.js root layout.

---

## Part 3: How To Fetch Data From The Server

## The Recommended Mental Model

In our current app, the flow is:

1. **server-only query code** lives in `songs.server.ts`
2. **TanStack server function wrappers** live in `songs.functions.ts`
3. **route loaders** call those server functions
4. **page components** read the loader result

That is a clean separation.

### Step 1: server-only database code

File:

- `apps/web-app/src/utils/songs.server.ts:1`

This file talks to Drizzle directly.
Examples:

- `listSongsForLibrary()`
- `getSongLessonById()`
- `getFlashcardRunBySongId()`
- `getSongPageData()`

This is your true data layer.

### Step 2: wrap it with `createServerFn`

File:

- `apps/web-app/src/utils/songs.functions.ts:1`

Example:

- `getSongsListFn`
- `getSongPageDataFn`

Why do this?
Because TanStack Start knows how to call these correctly from route loaders and from the client if needed.

### Step 3: call the server function in the route loader

File:

- `apps/web-app/src/routes/song.$songId.tsx:5`

We do:

- parse the `songId`
- call `getSongPageDataFn({ data: { songId } })`

### Step 4: read the data in the route component

Still in:

- `apps/web-app/src/routes/song.$songId.tsx:21`

We use:

- `Route.useLoaderData()`

That gives us:

- `songLesson`
- `flashcardRun`

### The Important Lesson

If you are coming from Next.js, this is the key shift:

- in Next.js, you often fetch directly inside a server component
- in TanStack Start, a very common pattern is: **loader → server function → data layer**

That makes route data explicit.

---

## Part 4: How Loading Works

This is the part many Next.js developers ask first.

### In Next.js
You may be used to:

- `loading.tsx`
- `Suspense`
- async server components

### In TanStack Start
The most important route-level ideas are:

- **loader** for getting data
- **pendingComponent** for loading UI
- **pendingMs** / **pendingMinMs** for loading timing control

So if you want to know:

> “How do I know something is loading?”

The short answer is:

- at the route level, use `pendingComponent`
- for slower partial data, use deferred loading + `Await`/`Suspense`
- for global awareness, TanStack Router also exposes router state APIs

## The Simple Route-Level Way

A route can define a loading UI.
Conceptually:

```tsx
export const Route = createFileRoute("/albums/$albumId")({
  loader: async ({ params }) => getAlbumFn({ data: { id: Number(params.albumId) } }),
  pendingComponent: AlbumLoading,
  component: AlbumPage,
});
```

That means:

- while the loader is still pending
- show `AlbumLoading`

This is the closest simple answer to Next.js `loading.tsx`.

## The Deferred Way

Sometimes you do not want to block the whole page.
You want:

- fast data now
- slow data later

TanStack Start supports deferred patterns.
The official examples use `Await` together with `Suspense`.
So yes, `Suspense` still exists in the React world here.
But the route system itself is the thing organizing the data.

### Practical rule

Use:

- **normal loader data** when the whole page depends on it
- **pendingComponent** for route loading UI
- **deferred data + `Await`** when only part of the page is slow

---

## Part 5: “What Is The Directive Here?”

You asked this from a Next.js perspective.

The answer is:

- there is **not** a direct one-to-one equivalent of Next’s `loading.tsx`
- the closest route-level directive is **`pendingComponent`** on the route

So the mindset is:

### Next.js
- file convention: `loading.tsx`

### TanStack Start
- route option: `pendingComponent`

And for server-side work:

### Next.js
- server component / server action

### TanStack Start
- `createServerFn(...)`

So instead of relying on special file names as much, TanStack Start tends to make the behavior part of the route definition itself.

---

## Part 6: How I Would Teach You To Build A New Feature

Let’s say you want a new page: `/artist/$artistId`.

Here is the order I would recommend.

### Step 1: define the data shape
Create or update types for what the page needs.

### Step 2: write server-only query code
Example file:

- `artist.server.ts`

This is where Drizzle or database logic should live.

### Step 3: wrap with `createServerFn`
Example file:

- `artist.functions.ts`

This gives you a safe server entrypoint.

### Step 4: create the route file
Example:

- `src/routes/artist.$artistId.tsx`

### Step 5: add a route loader
The loader should call the server function.

### Step 6: read loader data in the component
Use `Route.useLoaderData()`.

### Step 7: add pending UI if the page is slow
Use `pendingComponent`.

That is the practical TanStack Start workflow.

---

## Part 7: Mapping From Next.js To TanStack Start

Here is the easiest translation table.

### Routing
- **Next.js:** `app/song/[id]/page.tsx`
- **TanStack Start:** `src/routes/song.$songId.tsx`

### Shared layout
- **Next.js:** `layout.tsx`
- **TanStack Start:** root route like `src/routes/__root.tsx`

### Server data
- **Next.js:** fetch inside server component
- **TanStack Start:** route loader calling `createServerFn`

### Loading state
- **Next.js:** `loading.tsx`
- **TanStack Start:** `pendingComponent`

### Partial async content
- **Next.js:** `Suspense`
- **TanStack Start:** deferred data + `Await` and `Suspense`

### Server actions
- **Next.js:** server actions
- **TanStack Start:** server functions (`createServerFn`)

---

## Part 8: Common Mistakes For Next.js Developers

### Mistake 1: Treating everything like a React component problem
In TanStack Start, a lot of the real structure lives in the route config.
Look at the route file first.

### Mistake 2: Mixing DB logic directly into UI files
Keep database code in `*.server.ts` files or another server-only layer.
Then wrap it with `createServerFn`.

### Mistake 3: Forgetting the route loader
If a page needs data, the route loader is usually the first place to think.

### Mistake 4: Expecting file conventions exactly like Next.js
TanStack Start has conventions, but it is more explicit through route config.

### Mistake 5: Not distinguishing “whole page loading” from “part of page loading”
Use the right tool:

- route pending state for whole-page load
- deferred + `Await` for partial slow data

---

## Part 9: The Simple Rule Of Thumb

If you forget everything else, remember this:

### For a new page in TanStack Start
1. make a route file
2. add a loader
3. call a server function
4. read data with `Route.useLoaderData()`
5. add `pendingComponent` if needed

That will get you surprisingly far.

---

## Official Docs Worth Reading

These are the best official starting points:

- Quick start: https://tanstack.com/start/latest/docs/framework/react/quick-start
- Server functions: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
- Routing overview: https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts
- Data loading: https://tanstack.com/router/latest/docs/framework/react/guide/data-loading
- Deferred data loading: https://tanstack.com/router/latest/docs/framework/react/guide/deferred-data-loading

If you read only two, read:

1. quick start
2. server functions
