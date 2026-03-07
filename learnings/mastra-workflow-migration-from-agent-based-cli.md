# Migrating Our CLI AI Flow From Agent-Based To Mastra Workflows

This note is for a junior developer.

The goal is to explain:

1. what an **agent-based** flow is
2. what a **workflow-based** flow is
3. why we migrated our CLI song translation flow to a Mastra workflow
4. what changed in our codebase
5. what problems this migration solves
6. what problems it does **not** solve
7. what documents you should read next

This document assumes no prior Mastra background.

---

## Plain English First

The short version is:

- our old CLI flow used an **agent loop** for a task that already had a known sequence
- that made the code harder to reason about than it needed to be
- Mastra workflows are a better fit when the path is already known
- we still use an AI model inside the workflow steps
- but the **code** now decides the order, not the model

That is the main idea.

We did **not** remove AI.
We removed unnecessary **agentic orchestration**.

---

## Terms First

Before we talk about the migration, here are the key terms.

### Agent

An **agent** is an AI-driven loop that can decide what to do next.

In plain English:

- you give it a goal
- you give it tools
- it decides which tool to call, in what order, and when to stop

This is useful when the path is not known in advance.

Example:

- “Research this topic, browse multiple pages, compare them, then summarize the answer.”

That is open-ended.
An agent can be a good fit there.

### Workflow

A **workflow** is a fixed sequence of steps defined in code.

In plain English:

- step 1 runs first
- then step 2 runs
- then step 3 runs
- and so on

The model can still do AI work inside a step, but it does **not** decide the route.

### Step

A **step** is one unit of work inside a workflow.

Examples:

- fetch source markdown
- extract song metadata
- generate translations
- generate explanations
- save results to the database

### Orchestration

**Orchestration** means deciding how the whole process runs.

Examples:

- what runs first
- what runs next
- what data gets passed forward
- what happens if a step fails

### Schema

A **schema** is a strict definition of the shape of data.

In our codebase, we use **Zod** schemas.

Example:

- `songMetadata` must have `title` and `artist`
- `translations` must be an array
- each translation must have `original` and `translation`

### Structured output

**Structured output** means we ask the model to return data in a specific shape, not just free-form text.

Example:

Instead of:

> Here are the translations...

we want:

```json
{
  "translations": [
    {
      "original": "...",
      "translation": "..."
    }
  ]
}
```

### Tool call

A **tool call** is when the model asks the program to run a function.

In the old implementation, the model was told to call setter-style tools like:

- set song metadata
- set lyrics lines
- set translations
- set explanations

That worked, but it was being used as a way to simulate workflow state.

---

## The Old Mental Model

Our old CLI implementation for `translate-song` behaved like this:

1. fetch the page markdown
2. create a `ToolLoopAgent`
3. tell the model to call tools in a very specific order
4. validate that the model really did call them in that order
5. save the final state to the database

This is important:

the code already knew the correct sequence.

The model was not actually discovering a plan.
It was being forced through a known path.

That is why the earlier comment was correct:

> These are well-defined paths. It does not really need to be agentic. It needs a workflow.

In other words:

- we had a workflow problem
- but we were solving it with an agent loop

That mismatch made the code harder to maintain.

---

## Why Agent-Based Was The Wrong Fit Here

Agent-based systems are strongest when the next action is not obvious ahead of time.

Our CLI `translate-song` flow does not have that property.

Its path is known in advance:

1. fetch source
2. extract metadata and lyrics
3. generate translations
4. generate explanations
5. persist the result

There is no meaningful route decision there.

The old design asked the model to act like a planner even though the program already knew the plan.

That created several problems.

### Problem 1: Hidden control flow

The true process lived partly in prompt text and tool instructions instead of clearly in code.

That means a developer had to read:

- the tool definitions
- the prompt
- the validation logic

to understand one simple pipeline.

### Problem 2: Debugging was harder than necessary

If the flow failed, we had to ask:

- did the model misunderstand the instructions?
- did it skip a tool?
- did it call the wrong tool?
- did the state end up half-filled?

With a workflow, the question becomes much simpler:

- which step failed?

That is much easier to reason about.

### Problem 3: The model was controlling too much

The model should be responsible for **AI work**, not for deciding obvious program flow.

Good AI work here includes:

- extracting clean lyrics from noisy page content
- translating lines
- explaining grammar and vocabulary

Bad use of AI here would be:

- deciding whether translation should happen before lyric extraction

That is a programming decision, not an LLM decision.

### Problem 4: Validation became reactive instead of proactive

The old code mostly said:

- “LLM, please do the sequence correctly”
- “Now let me check if you did”

With a workflow, we instead say:

- “The sequence is already decided by the program”

That is a much better separation of responsibilities.

---

## The New Mental Model

The new design uses a **Mastra workflow**.

The workflow is defined as a sequence of explicit steps.

In plain English:

- Mastra controls **where the process goes next**
- the AI model handles **the language work inside a step**
- our application code handles **validation, persistence, and CLI behavior**

That means the responsibilities are now cleaner:

### Mastra workflow

Responsible for:

- step order
- step boundaries
- input/output shape between steps
- workflow execution and result handling

### AI SDK + Fireworks model

Responsible for:

- generating structured AI output inside steps
- doing language tasks such as extraction, translation, and explanation

### Our CLI code

Responsible for:

- validating the model output
- saving results to the database
- printing output
- exposing command-line options

---

## What We Changed In This Repo

The main files to understand are:

- `apps/cli/src/commands/translate-song.ts`
- `apps/cli/src/lib/song-generation-models.ts`
- `apps/cli/src/index.ts`

### In `translate-song.ts`

We replaced the `ToolLoopAgent` approach with a Mastra workflow.

The workflow now has explicit steps:

1. `fetch-source`
2. `extract-metadata-and-lyrics`
3. `generate-translations`
4. `generate-explanations`
5. `persist-song`

That means a developer can now open one file and immediately see the real pipeline.

### Important detail: we still use AI inside the steps

The migration was **not**:

- AI removed
- everything made fully deterministic

The migration **was**:

- orchestration moved from model-driven to code-driven

So the model still does hard language tasks.
It just does them inside a step with a known contract.

### In `song-generation-models.ts`

We added support for short model aliases like:

- `glm-5`
- `kimi-k2p5`
- `minimax-m2p5`

instead of forcing the CLI user to type the full Fireworks ID every time.

We also changed the default model to `glm-5`.

### In `index.ts`

We updated CLI parsing so both of these work:

- `--model glm-5`
- `--model accounts/fireworks/models/glm-5`

That change is not really about workflows.
It is just CLI usability improvement that happened in the same task.

---

## Why Mastra Was A Good Fit

Mastra workflows matched the real shape of our problem.

The official workflow docs describe workflows as a way to define multi-step tasks using structured steps instead of relying on one agent’s reasoning. That aligns closely with our use case. Mastra also makes step input/output schemas explicit and lets us run the workflow through a `createRun()` + `run.start()` flow. See the official docs here:

- Mastra workflows overview: https://mastra.ai/docs/workflows/overview

Here is why that mattered specifically for us.

### 1. The path was already known

This was the biggest reason.

If the path is known, a workflow is usually the right default.

### 2. Step schemas are explicit

Each step says what it needs and what it returns.

That makes it easier to see:

- what data exists at each point
- what a step depends on
- where a mismatch happens

### 3. Failure points are easier to inspect

Mastra returns workflow results with statuses like:

- `success`
- `failed`
- `suspended`
- `tripwire`

It also exposes per-step results, which makes debugging much easier. See:

- Mastra error handling docs: https://mastra.ai/docs/workflows/error-handling

### 4. We still keep the option to use agents or tools when needed

Mastra workflows do **not** mean “no agents allowed.”

Mastra explicitly supports calling agents and tools inside workflow steps when that is useful. See:

- Mastra agents and tools in workflows: https://mastra.ai/docs/workflows/agents-and-tools

That is important because the right design is often:

- workflow for the route
- agent or model call for the reasoning inside a step

not “workflow everywhere” or “agent everywhere.”

---

## What We Did **Not** Use From Mastra

We intentionally did **not** use `@mastra/ai-sdk` for this migration.

That package is useful when you already use the Vercel AI SDK directly and want to add Mastra features like processors or memory without switching to the full Mastra agent API.

Official guide:

- Mastra AI SDK integration: https://mastra.ai/guides/agent-frameworks/ai-sdk

Why we did not use it here:

- our main problem was not model wrapping
- our main problem was orchestration
- `withMastra()` would not by itself turn an agent loop into a workflow

So we kept Fireworks through the AI SDK and used Mastra only where it gave us the most value: workflow orchestration.

---

## A Very Important Lesson: Workflow Solves Routing, Not Model Intelligence

This was one of the biggest practical lessons from the migration.

Moving from an agent loop to a workflow **does not automatically make the model smarter**.

It makes the program structure better.

That is different.

### Example 1: metadata step failure

One real failure we saw was:

- the model returned `songMetadata`
- but omitted `lyricsLines`

That failed schema validation.

The workflow helped us see exactly where the failure happened.
But the workflow itself did not magically force the model to obey perfectly.

### Example 2: explanation schema mismatch

Another real failure was:

- our schema required `vocabularies`
- the model returned `vocabulary`

Again, the workflow made the bug obvious.
But the workflow did not stop the model from making that mistake.

### Example 3: model quality matters

We also learned that different models behave differently on structured tasks.

In practice:

- MiniMax was less reliable for our structured output shape
- GLM-5 behaved better

That means:

- workflow quality matters
- prompt quality matters
- schema quality matters
- **model quality also matters**

All four matter.

---

## Why We Did **Not** Break Translation Into One Line Per Step

This point is important for performance thinking.

A bad reaction to batch-output failures is:

> “Let’s make one model call per lyric line.”

That would probably increase reliability.
But it would also significantly increase:

- latency
- cost
- operational overhead
- total failure surface

For example, if a song has 30 lines and you turn that into 30 separate LLM calls, you are paying the round-trip cost 30 times.

That is usually a bad tradeoff unless you have a very strong reason.

So the better mental model is:

- keep the workflow explicit
- keep the number of model calls reasonable
- improve batch reliability before exploding the number of calls

This is a general engineering lesson:

do not fix a control-flow problem by creating a performance problem.

---

## Another Important Lesson: `generateObject` Was Deprecated

During the migration, we also updated the structured-output calls to match AI SDK 6.

The official AI SDK 6 migration guide says that `generateObject` and `streamObject` are deprecated, and recommends using `generateText` / `streamText` with an `output` setting instead.

Official guide:

- AI SDK 6 migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0

In plain English:

- old style: “generate an object”
- new style: “generate text, but require the output to match this schema”

That is why the newer code uses `generateText` with `Output.object(...)`.

This matters because a junior developer reading older examples online may still find `generateObject` in blog posts or old code.
That does not mean it is the right choice for current code.

---

## What Problems This Migration Solves

This migration improves several things.

### 1. Clearer code structure

You can now read the process as a normal pipeline.

### 2. Better separation of concerns

- workflow decides the route
- model does AI work
- app code validates and persists

### 3. Better debugging

You can inspect step boundaries and failures more easily.

### 4. Less fake “agent intelligence”

We stopped pretending the model needed to plan an already-known path.

### 5. Easier future reuse

Now that the orchestration is explicit, it is easier to imagine moving the same workflow logic into shared code and reusing it outside the CLI.

---

## What Problems This Migration Does **Not** Solve

This is just as important.

### 1. It does not guarantee perfect model output

The model can still:

- omit required fields
- use the wrong key name
- return too few items
- misunderstand a batch request

### 2. It does not eliminate prompt engineering

You still need good prompts and examples.

### 3. It does not make a weak model strong

If one model is worse at structured output, a workflow will not fully hide that.

### 4. It does not mean every AI feature should become a workflow

If a task is truly open-ended and needs exploration, an agent can still be the better fit.

---

## Practical Decision Rule

If you are unsure whether to use an agent or a workflow, use this simple rule.

### Use a workflow when:

- the path is known ahead of time
- the order of operations is fixed
- the inputs and outputs of each phase can be described clearly
- you want strong observability and step-by-step debugging

### Use an agent when:

- the next action is not known up front
- the system must choose among tools dynamically
- the task is exploratory or open-ended
- the model truly needs to plan

### Use both when:

- the outer route is known
- but one or more steps still require reasoning

That hybrid design is often the best one.

Our CLI song-translation flow is a strong example of that hybrid pattern:

- workflow outside
- LLM reasoning inside

---

## Suggested Reading Order

If you are new to Mastra, read these in this order.

### 1. Mastra Quickstart

Read this first to understand the general project structure and what Mastra creates for you.

- https://mastra.ai/guides/getting-started/quickstart

### 2. Workflows Overview

This is the most important document for understanding this migration.

- https://mastra.ai/docs/workflows/overview

Pay special attention to:

- `createStep`
- `createWorkflow`
- `.then()`
- `.commit()`
- `createRun()` + `run.start()`

### 3. Control Flow

Read this when you want to understand how steps connect and how schemas must line up.

- https://mastra.ai/docs/workflows/control-flow

This is especially important for understanding why step input/output schemas matter.

### 4. Error Handling

Read this if you want to understand how to inspect failures and why result status checks matter.

- https://mastra.ai/docs/workflows/error-handling

### 5. Agents and Tools in Workflows

Read this to understand that workflows and agents are not enemies. They can be composed together.

- https://mastra.ai/docs/workflows/agents-and-tools

### 6. AI SDK + Mastra Guide

Read this if you are already using AI SDK directly and want to understand what `withMastra()` is for.

- https://mastra.ai/guides/agent-frameworks/ai-sdk

### 7. AI SDK 6 Migration Guide

Read this so you do not copy outdated structured-output patterns.

- https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0

The most relevant part for us is the deprecation of `generateObject` in favor of `generateText` with `Output.object(...)`.

---

## Final Takeaway

The most important lesson from this migration is simple:

**Do not use an agent to simulate a workflow when the workflow is already known.**

If the route is fixed, encode the route in code.

Then let the model do the parts that are actually AI-shaped:

- extraction
- translation
- explanation

That is the architecture we moved toward here.

It is easier to debug, easier to explain, and more honest about where intelligence should live in the system.
