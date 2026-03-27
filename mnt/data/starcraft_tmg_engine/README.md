# StarCraft TMG Engine - Phase 1 Foundation

This build is a rules-first rewrite of the uploaded grid mockup.

## What is playable right now

- alternating activation in the Movement Phase
- all units begin in reserves
- supply pool and available supply
- deployment from entry edges
- normal move for unengaged units
- disengage for engaged units
- hold
- pass and first-player-marker handoff
- AI opponent for the Movement Phase
- round advancement with supply escalation

## What is deliberately not finished yet

- Assault Phase actions
- Combat Phase actions
- marker control and scoring
- faction cards
- tactical cards
- advanced terrain interactions
- reserve arrival exceptions from special abilities

## How the board works

- the source of truth is continuous inches, not square occupancy
- the SVG grid is visual only
- movement uses a straight-line path in this build
- non-leading models are auto-set around the leading model

## Structure

- `data/` holds declarative unit, mission, and deployment data
- `engine/` holds state, supply, activation, movement, deployment, and legality logic
- `ui/` renders the board and panels
- `ai/` picks from the same action system as the player

## Suggested next step

Build Assault Phase next:

1. ranged attack declaration
2. charge declaration
3. run
4. card timing hooks
5. event-driven modifier pipeline
