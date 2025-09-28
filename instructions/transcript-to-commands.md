## Transcript → Commands Agent

This spec defines how to convert a timestamped transcript into a set of editing commands and a machine-readable timeline for downstream automation using the `Better FFmpeg` n8n node. It assumes local processing only and does not rely on cloud render services.

### Input
- Transcript: array of entries with `start`, `end`, and `text`, e.g. WebVTT/SRT parsed to JSON.
- Optional hints: speaker tags, event markers, or prior takes metadata.

### Command Lexicon (textual output)
Use absolute seconds or `HH:MM:SS.mmm` timecodes. Examples:
- `/intro-in 0.00` and `/intro-out 12.37`
- `/skip 24.10 28.90` (exclude interval)
- `/best-take 33.00 54.25`
- `/timelapse 120.00 160.00 4.0` (speed factor 4x)
- `/overlay-on 210.00 logo.png tr 10 10 0.8 320 0` → `start path position x y opacity width height`
- `/overlay-off 238.00`
- `/mute 300.00 307.50`
- `/normalize-audio` (global)

These textual commands are for human inspection. The agent must also emit a JSON timeline.

### Machine Timeline (JSON)
Emit an ordered list of actions with absolute times:
```
{
  "inputs": { "video": "/abs/path/input.mp4", "audio": null },
  "actions": [
    { "type": "exclude", "start": 24.10, "end": 28.90 },
    { "type": "segment", "label": "intro", "start": 0.00, "end": 12.37 },
    { "type": "segment", "label": "best_take", "start": 33.00, "end": 54.25 },
    { "type": "speed", "start": 120.00, "end": 160.00, "factor": 4.0 },
    { "type": "overlay", "start": 210.00, "end": 238.00, "asset": "logo.png", "position": "tr", "x": 10, "y": 10, "opacity": 0.8, "w": 320, "h": 0 },
    { "type": "mute", "start": 300.00, "end": 307.50 }
  ]
}
```

### Execution Order (non-destructive)
1) Analyze
   - Probe media (`Analyze → Get Media Properties`).
   - Detect silence/black if helpful for segment boundaries (`Analyze → Detect Silence/Black`).

2) Plan Segments
   - Build a timeline of included segments using absolute `start`/`end` and apply `exclude` windows.
   - Prefer longer segment extraction over many short ones.

3) Extract Segments (lossless when possible)
   - Use `Editing → Trim / Cut` with `Stream Copy` on for speed when frame-exact cuts are not required.
   - For frame-accurate cuts, re-encode the boundary GOPs (disable `Stream Copy`).

4) Transform Segments
   - Apply `Speed` for each `speed` interval on its corresponding segment.
   - Apply overlays only for their active windows (`Overlays → Overlay / Watermark`), using `position`, `x`, `y`, `w`, `h`, `opacity`.
   - Apply audio fixes (`Audio FX`): normalize, denoise, silence removal, etc., on audio tracks or extracted audio.

5) Concatenate
   - Join transformed segments in order (`Muxing → Concatenate`).
   - If an external narration/music track is specified, use `Combine Video + Audio` or map audio in concat complex mode.

6) Finalize
   - Optional `Compress` to target codec/bitrate/CRF.

All outputs should write to new files with suffixes or a designated output directory.

### Mapping Commands → Node Operations
- `segment` or `best-take`: `Trim / Cut` per interval → file per segment → `Concatenate`.
- `exclude`: subtract from segments before extraction.
- `timelapse`: `Speed` with factor > 1 on the sub-clip, then stitch back.
- `overlay`: `Overlay / Watermark` on the sub-clip duration, then stitch back.
- `mute`: map to audio filter `volume=0` on that interval (via an audio FX step or by replacing with silence) before concat.
- `normalize-audio`: `Audio FX → Normalize Volume`.

### Notes
- Prefer absolute times with `start` and `end` to avoid duration math.
- Keep parallelizable steps (segment-level transforms) independent, then concat once.
- When speed-changing segments, ensure audio stays in sync (use filter graph combining `setpts` and `atempo`).


