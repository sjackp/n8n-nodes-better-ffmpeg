## Agent: FFmpeg Node Executor (timeline runner)

Purpose: Execute a local, non-destructive edit from a timeline. Always create subclips first, apply transforms to those subclips (speed/overlay/mute), then concatenate. Do not jump straight to final concat or edits will be skipped. No cloud rendering [[memory:6992695]].

### Inputs
- Timeline JSON produced by the transcript annotator (`inputs`, `actions[]`).
- Node parameters available in the Better FFmpeg node.

### Deterministic plan (strict order)
1) Normalize timeline
   - Filter to actions we will render now: `segment` and `speed`.
   - Sort by `start`; ensure each has `0 <= start < end`.
2) Make subclips (one per window)
   - Node: Editing → Trim / Cut
   - Params: `trimInput` = source, `trimStart` = start, `trimEnd` = end, `trimCopy` = OFF (frame‑accurate), output to outbox.
3) Apply transforms on subclips
   - For every `speed` window: Node Editing → Speed on the trimmed file with `speedFactor = factor`; collect the sped output path.
   - For normal segments: keep the trimmed output path.
4) Concatenate final subclips (in order)
   - Node: Muxing → Concatenate, `concatInputMode = files`, `concatMode = complex` (re‑encode, robust).
   - Provide the ordered list of final subclip paths; set output path, overwrite on.
5) Optional finishing: compression/format change, normalize audio, global overlays, etc.

### Mapping
- `segment` {start,end} → Trim subclip.
- `speed` {start,end,factor} → Trim, then Speed on that subclip.
- (Later) `overlay`/`mute` → apply per subclip before concat.

- Trim: `trimInput`, `trimStart`, `trimEnd`, `trimCopy=false`, `trimOutput`, `trimOverwrite=true`.
- Speed: `speedInput`, `speedFactor`, `speedOutput`, `speedOverwrite=true`.
- Concat (Files List): `concatMode=complex`, `concatInputMode=files`, `concatInputs=[paths...]`, `concatOutputPath`, `concatOverwrite=true`.
- Dynamic segments (only when you have segments and no speed):
  - `concatInputMode=segments`, `concatSource`, `segmentSource=json|timeline`, `segmentsJson` or `timelineJson`, `frameAccurate=true`, `concatMode=complex`.
- Convert/Compress as needed at the end.

### Constraints and validation
- Ensure `start < end`; clamp negatives; sort windows.
- Use absolute paths inside the container.
- Keep `trimCopy` OFF for exact boundaries; rely on complex concat to avoid stream mismatch.

### Outputs
- Final video path from the last node step.
- Optional intermediate artifacts list if needed for auditing.


### Orchestration contract (no expressions)
- Ordered windows: provide a JSON array sorted by start time. Each item must include:
  - `type`: "segment" or "speed"
  - `start`: number (seconds)
  - `end`: number (seconds)
  - `factor` (only for speed): number (e.g., 4 for 4×)
- Speed factor default: if omitted for a speed window, treat as `1` (no change).
- Concat (Files List) inputs: provide an array of absolute file paths (strings) to the rendered subclips in chronological order.

### Dynamic Segments (segments only)
If your timeline has only `segment` actions (no `speed`), you may let the Concat node trim directly:
- Set `concatInputMode=segments`, `concatSource=/abs/input.mp4`.
- Choose `segmentSource=json` and provide `segmentsJson` as a JSON array like:
```
[
  { "start": 1.68, "end": 6.12 },
  { "start": 41.89, "end": 56.3 },
  { "start": 66.14, "end": 68.58 }
]
```
- Recommended: `frameAccurate=true`, `concatMode=complex`.


