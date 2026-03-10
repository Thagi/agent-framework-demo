# Agent Demo Expansion Ideas

## Purpose

This document organizes realistic feature extensions for the current Agent Framework demo.
The goal is not to list every possible idea, but to identify additions that are:

- easy to demonstrate
- clearly agentic
- incremental on top of the current architecture
- useful for future business PoCs

## Current Baseline

The current demo already covers:

- single-agent streaming chat
- parallel multi-agent analysis
- RAG-based search
- role-based group discussion
- per-session conversation memory
- backend-driven model configuration
- `podman-compose` startup

## Delivery Status

Work is being implemented in priority order. As of March 10, 2026, the status is:

| Item | Status | Notes |
|---|---|---|
| Task decomposition and plan visualization | Implemented | Visible plan panels are available in regular chat, multi-agent analysis, RAG, and the board workflow |
| Human-in-the-loop approval | Not started | Next likely priority |
| Tool trace and evidence view | Not started | Can follow approval or be developed in parallel |
| File input support | Not started | Requires UI upload and extraction pipeline work |

That means the next step is not "can it answer?", but "can it plan, act, explain, and be governed?"

## Prioritized Extensions

| Priority | Feature | Demo impact | Complexity | Goal |
|---|---|---|---|---|
| High | Task decomposition and visible execution plan | High | Medium | Make the agent feel deliberate |
| High | Human-in-the-loop approval | High | Medium | Show control and governance |
| High | Tool trace and evidence view | High | Medium | Reduce black-box behavior |
| High | File input support | High | Medium | Bring the demo closer to real work |
| Medium | Persistent memory | Medium | Medium | Keep continuity across restarts |
| Medium | Agent routing | Medium | Medium | Auto-select the best workflow |
| Medium | Async job execution | High | High | Support long-running agent tasks |
| Medium | Critic / evaluator agent | Medium | Medium | Add self-review loops |
| Low | Multi-user / access control | Low | High | More relevant for production |
| Low | Audit log / cost dashboard | Medium | Medium | More relevant for operations |

## Recommended Roadmap

### Phase 1

#### 1. Task decomposition and plan visualization

Have the system explicitly produce:

- goal
- subtasks
- tools to use
- completion criteria

Why it matters:

- it looks meaningfully agentic
- it prepares the system for approvals and execution traces

Implementation direction:

- add a planner agent in the backend
- show task states in the frontend: `pending / running / done / blocked`

#### 2. Human-in-the-loop approval

Require approval before actions such as:

- external delivery
- data updates
- long-running execution
- expensive model usage

Why it matters:

- it shows a practical operating model
- it balances autonomy with control

#### 3. Tool trace and evidence view

Expose what the agent actually did:

- which tool it called
- which query it used
- which documents it relied on
- how evidence maps to the final answer

Why it matters:

- easier to explain during demos
- makes RAG and workflow orchestration more credible

#### 4. File input support

Allow the user to upload files for analysis:

- proposal review
- specification review
- meeting memo to action items
- document summarization with multiple perspectives

Why it matters:

- it raises the demo from chat to real task support

### Phase 2

#### 5. Persistent memory

Move session state to storage such as:

- Redis
- PostgreSQL
- object storage plus metadata DB

#### 6. Agent routing

Auto-select the best workflow:

- simple question -> standard chat
- comparative reasoning -> multi-agent analysis
- policy question -> RAG
- management topic -> board workflow

#### 7. Critic / evaluator agent

Add a final quality check:

- did it answer the request?
- is evidence sufficient?
- is the wording precise?
- is the next action clear?

### Phase 3

#### 8. Async job execution

Support long-running jobs with:

- job IDs
- status API
- progress events

#### 9. Audit log and cost tracking

Track:

- model used
- token usage
- runtime
- tools invoked
- session-level execution history

#### 10. Multi-user workspace and access control

Add:

- login
- team-shared history
- access control
- shared knowledge bases

## Best Demo Scenarios

### 1. Proposal review agent

- input: proposal or requirements memo
- output: critique, upside, execution plan, risks

### 2. Policy and guidance assistant

- input: internal policy question or operational scenario
- output: grounded answer, compliance check, next action

### 3. Executive meeting simulator

- input: business issue and supporting material
- output: multi-role discussion, synthesized plan, critic review

## Recommended Order For This Repository

The most practical sequence is:

1. plan visualization
2. tool trace and evidence view
3. human approval
4. file input
5. persistent memory
6. routing

## Best Single Next Step

If only one extension is added next, the best option is:

### Plan visualization plus approval flow

Why:

- it makes the agent's thinking visible
- it shows that humans stay in control
- it is easy to explain in a demo
- it creates a clean path to future tool execution and file workflows
