# Candidate Assessment Brief

## Overview
This is a focused, skeleton-based full-stack assessment. You will implement the required tasks below using the pre-built codebase as your foundation.

The app displays a table of sports betting market data consisting of two datasets:

- `props` — optimal betting lines per player market (e.g. Russell Westbrook: points 19.0, rebounds 9.0)
- `alternates` — all lines offered for a market with their under/over/push probabilities

**AI coding tools are explicitly allowed.** You will be expected to walk through every part of your submission during the in-person review, including any AI-generated code. Come prepared to explain what it produced, what you changed, and where it fell short.

## Tasks

_Primary (required):_

1. Market Statistics Component — real-time display of total markets, suspension counts, and loading state; should update reactively when data changes
2. Manual Suspension API — complete the backend route and SQL implementation; proper error handling required
3. Player/Team Search — add a search input to filter markets by player name or team; integrate with the existing filter pattern

_Secondary (choose 1–2):_

4. SQL Performance — the low/high line calculation is inefficient; optimize it
5. Suspension Logic Bug — some markets that should be suspended are showing active; debug and fix
6. Race Condition — rapid suspension toggle clicks cause inconsistent state; prevent simultaneous API calls for the same market


## Business Rules

A market is automatically suspended if any of the following apply:

- `marketSuspended = 1`
- No optimal line exists for the market
- All probabilities (under, over, push) for the optimal line are ≤ 40%

Manual overrides take precedence over computed suspension status and persist in the database.

##  Submission requirements

`npm run setup && npm start` must work from a clean environment.

Along with your code, include a **decision log** — a concise written document covering:

- What you built and any architectural choices worth explaining
- At least two things you considered but decided against, and why
- Where AI helped, where it didn't, and any output you modified or threw out
- Anything you'd do differently with more time, or anything left rough that you'd want to flag

There's no right answer here and no length requirement. The log exists so we can have a more useful conversation during the in-person review. The panel will build and question directly on what you write, so more honest context makes for a better discussion.

## Evaluation
| Area | Weight |
| :--- | ---: |
| JavaScript / React / TypeScript | 70% | 
| API design and error handling | 20% |
| SQL and database | 10% |

We're looking at correctness, code quality, TypeScript usage, and how you reason about edge cases — not just whether the features work.

**Time: 4 hours suggested, up to 24 hours to submit.**