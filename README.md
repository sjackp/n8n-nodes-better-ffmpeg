## n8n-nodes-ffmpeg

FFmpeg community node for n8n. It runs your local FFmpeg binary to convert media or combine a video with a separate audio track.

### Install (for self-hosted n8n)
1. In n8n, go to Settings → Community Nodes → Install.
2. Enter the npm package name:
   `n8n-nodes-better-ffmpeg`
3. Accept the warning and install.

### Requirements
- FFmpeg installed and available on PATH, or provide a custom binary path in the node parameter.
- Node.js >= 20 (n8n requirement).

### Operations
- Convert: Convert a media file to a different format
  - Input File Path
  - Target Format (predefined list)
  - Output File Path (optional)
  - Overwrite Existing (boolean)

- Combine: Merge a video and an audio file into a single video
  - Video File Path
  - Audio File Path
  - Output File Path (optional; defaults to an mp4 next to the video)
  - Copy Video Stream (boolean; default true)
  - Audio Codec (options; default aac)
  - Use Shortest Duration (boolean; default true)
  - Overwrite Existing (boolean)

### Notes
- Uses `spawn` with argument arrays (no shell) for safety.
- Adds `-y` when overwriting and `-n` when not, to avoid prompts.
- On Windows, prefer absolute paths (e.g., `C:\\path\\to\\file.mp4`).

### License
MIT

