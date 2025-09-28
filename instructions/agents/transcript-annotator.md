## Agent: Transcript Annotator (commands generator)

Purpose: Convert a timestamped transcript into a clean, deterministic command script and a machine-readable timeline for local editing. No cloud/Lambda usage; all outputs target local workflows [[memory:6992695]].

### Input
- Transcript as JSON array sorted by time: `[ { start: number, end: number, text: string }, ... ]`
- Optional hints: speaker labels, tags, take metadata.
- Media path context: `{ video: string, audio?: string }` if available.

### Command Lexicon (text file output)
Emit absolute times in seconds (or HH:MM:SS.mmm consistently). One command per line:
- `/intro-in <t>`; `/intro-out <t>`
- `/skip <start> <end>`
- `/best-take <start> <end>`
- `/timelapse <start> <end> <factor>` (factor > 1 speeds up)
- `/overlay-on <start> <asset> <pos> <x> <y> <opacity> <w> <h>`
- `/overlay-off <end>`
- `/mute <start> <end>`
- `/normalize-audio`

Positions: `tl|tr|bl|br|c`. Width/height: `0` means keep aspect for unspecified dimension.

### Machine Timeline (JSON output)
Produce a strict schema for the executor agent:
```
{
  "inputs": { "video": "/abs/path/input.mp4", "audio": null },
  "actions": [
    { "type": "exclude", "start": 24.10, "end": 28.90 },
    { "type": "segment", "label": "intro", "start": 0.00, "end": 12.37 },
    { "type": "segment", "label": "best_take", "start": 33.00, "end": 54.25 },
    { "type": "speed", "start": 120.00, "end": 160.00, "factor": 4.0 },
    { "type": "overlay", "start": 210.00, "end": 238.00, "asset": "C:/media/logo.png", "position": "tr", "x": 10, "y": 10, "opacity": 0.8, "w": 320, "h": 0 },
    { "type": "mute", "start": 300.00, "end": 307.50 }
  ]
}
```

### Detection rules from transcript text
- Skip cues: phrases like "skip this take", "cut this", "do not use" → `exclude` window covering that utterance and relevant silence around it if explicitly mentioned.
- Best take cues: "this was the best take" → `segment` window for the just-finished take; if ambiguous, prefer the current sentence window.
- Speed cues: "speed up from now" → `speed` window starts at current `end`; end at the next countermand (e.g., "back to normal") or at a natural break (next section/scene) if stated.
- Silence cues: "long silence till now" → create `exclude` window from last speech token to current `start`.
- Intro/outro cues: "good intro", "outro starts now" → mark `/intro-in` and `/intro-out` around stated bounds.

Resolve overlaps deterministically:
- Merge adjacent or overlapping windows of the same type.
- For conflicting types, priority: `exclude` > `segment` > `speed/overlay/mute`.

### Validation
- Ensure all windows satisfy `0 <= start < end` and lie within media duration if known.
- Sort commands chronologically; do not emit duplicates.
- Normalize time precision to 3 decimals.

### Output artifacts
- `<basename>.commands.txt` (human-readable commands)
- `<basename>.timeline.json` (machine-readable actions)

### Procedure (deterministic)
1) Parse and normalize transcript times; merge contiguous identical speakers if helpful.
2) Scan text for cues; create raw windows per rules above.
3) Normalize and merge windows; resolve conflicts by priority.
4) Emit commands file and timeline JSON exactly matching the schema.
5) If `inputs.video` not supplied, leave placeholder `"/abs/path/input.mp4"` for the executor to fill.


