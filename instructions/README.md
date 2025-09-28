## AI Editing Agent Instructions

This folder describes how an AI agent should transform a timestamped transcript into executable editing commands for an automated, non-destructive FFmpeg workflow using the `Better FFmpeg` node in n8n.

Key docs:
- `transcript-to-commands.md` — end-to-end pipeline, command lexicon, and execution order.
- `examples/timeline.example.json` — example machine-readable timeline the next agent can execute.

Outputs produced by the transcript agent should be:
- A textual, timestamped command script for human readability, and
- A machine-readable JSON timeline with absolute `start` and `end` times for each action.

Execution principles:
- Prefer analysis-first (probe/silence/black) to inform cuts.
- Work segment-first: extract clips losslessly (stream copy) when possible, then apply transforms.
- Keep operations idempotent and non-destructive (write to new files with suffixes or to an output directory).
- Use absolute times (start + end) in seconds (or timecode) to avoid ambiguity.

See `transcript-to-commands.md` for the detailed flow.


