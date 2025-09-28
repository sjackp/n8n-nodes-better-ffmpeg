## n8n-nodes-better-ffmpeg

FFmpeg community node for n8n. It runs your local FFmpeg binary to convert media or combine a video with a separate audio track.

### Install (for self-hosted n8n)
1. In n8n, go to Settings → Community Nodes → Install.
2. Enter the npm package name:
   `n8n-nodes-better-ffmpeg`
3. Accept the warning and install.

### Requirements
- FFmpeg installed and available on PATH, or provide a custom binary path in the node parameter.
- Node.js >= 20 (n8n requirement).

### Categories and operations

- Editing & Transcode
  - Convert Format: Convert media format
  - Trim / Cut: Extract a segment
  - Resize: Change resolution
  - Crop: Crop video frame
  - Speed: Change playback speed

- Muxing & Concatenate
  - Combine Video + Audio: Mux video with external audio
  - Stitch: Normalize and join clips reliably

- Overlays & PiP
  - Overlay / Watermark: Overlay image/video on a base video

- Generation
  - Thumbnail(s): Extract one or more thumbnails
  - GIF: Create animated GIF

- Compression
  - Compress/Transcode: Compress with codec profile (CRF/bitrate, presets, codecs)

- Analyze
  - Get Media Properties (ffprobe): Return detailed JSON metadata
  - Detect Silence: Output silence intervals
  - Detect Black Frames: Output black frame intervals

- Audio FX
  - Normalize Volume: Analyze then apply volume gain
  - Remove Silence: Strip silent segments
  - Noise Reduction: Reduce background noise
  - Equalizer: Adjust frequency bands (equalizer/superequalizer)
  - Dynamic Compression: Even out volume levels
  - Channel Mapping: Map or collapse channels
  - Tempo / Pitch: Change tempo and/or pitch
  - Echo / Reverb: Echo or convolution reverb
  - Volume Automate (Mute/Duck/Gain): Automate volume over a time window

- Video FX
  - Stabilize (Deshake): Reduce camera shake

- Create
  - Image + Audio → Video: Create video from image and audio
  - Waveform Image: Render waveform to PNG
  - Spectrum Image: Render spectrum to PNG

### Notes
- Uses `spawn` with argument arrays (no shell) for safety.
- Adds `-y` when overwriting and `-n` when not, to avoid prompts.
- On Windows, prefer absolute paths (e.g., `C:\\path\\to\\file.mp4`).

### License
MIT

