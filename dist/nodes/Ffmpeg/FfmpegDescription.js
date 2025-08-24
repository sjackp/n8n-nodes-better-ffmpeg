"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ffmpegFields = exports.ffmpegOperations = void 0;
exports.ffmpegOperations = [
    {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
            {
                name: 'Convert',
                value: 'convert',
                description: 'Convert a media file to a different format',
                action: 'Convert media format',
            },
            {
                name: 'Combine',
                value: 'combine',
                description: 'Combine a video file and an audio file into a single video',
                action: 'Combine audio and video',
            },
        ],
        default: 'convert',
    },
];
const convertFields = [
    {
        displayName: 'Input File Path',
        name: 'inputPath',
        type: 'string',
        default: '',
        required: true,
        description: 'Absolute or workspace-accessible path to the input media file',
        displayOptions: {
            show: {
                operation: ['convert'],
            },
        },
    },
    {
        displayName: 'Target Format',
        name: 'targetFormat',
        type: 'options',
        default: 'mp4',
        description: 'Container/format to convert the input into',
        options: [
            { name: 'AAC (.aac)', value: 'aac' },
            { name: 'AVI (.avi)', value: 'avi' },
            { name: 'FLAC (.flac)', value: 'flac' },
            { name: 'M4A (.m4a)', value: 'm4a' },
            { name: 'Matroska (.mkv)', value: 'mkv' },
            { name: 'MP3 (.mp3)', value: 'mp3' },
            { name: 'MP4 (.mp4)', value: 'mp4' },
            { name: 'Ogg Vorbis (.ogg)', value: 'ogg' },
            { name: 'QuickTime (.mov)', value: 'mov' },
            { name: 'WAV (.wav)', value: 'wav' },
            { name: 'WebM (.webm)', value: 'webm' },
        ],
        displayOptions: {
            show: {
                operation: ['convert'],
            },
        },
    },
    {
        displayName: 'Output File Path',
        name: 'outputPath',
        type: 'string',
        default: '',
        placeholder: 'Leave empty to derive from input path',
        description: 'Optional explicit output path; if empty, input extension will be replaced',
        displayOptions: {
            show: {
                operation: ['convert'],
            },
        },
    },
    {
        displayName: 'Overwrite Existing',
        name: 'overwrite',
        type: 'boolean',
        default: true,
        description: 'Whether to overwrite the output file if it exists',
        displayOptions: {
            show: {
                operation: ['convert'],
            },
        },
    },
];
const combineFields = [
    {
        displayName: 'Video File Path',
        name: 'videoPath',
        type: 'string',
        default: '',
        required: true,
        description: 'Path to the input video file',
        displayOptions: {
            show: {
                operation: ['combine'],
            },
        },
    },
    {
        displayName: 'Audio File Path',
        name: 'audioPath',
        type: 'string',
        default: '',
        required: true,
        description: 'Path to the input audio file',
        displayOptions: {
            show: {
                operation: ['combine'],
            },
        },
    },
    {
        displayName: 'Output File Path',
        name: 'outputPath',
        type: 'string',
        default: '',
        placeholder: 'Leave empty to derive from video file path',
        description: 'Optional explicit output video path; defaults to MP4 next to the video',
        displayOptions: {
            show: {
                operation: ['combine'],
            },
        },
    },
    {
        displayName: 'Copy Video Stream',
        name: 'copyVideo',
        type: 'boolean',
        default: true,
        description: 'Whether to copy the video stream instead of re-encoding',
        displayOptions: {
            show: {
                operation: ['combine'],
            },
        },
    },
    {
        displayName: 'Audio Codec',
        name: 'audioCodec',
        type: 'options',
        default: 'aac',
        description: 'Audio codec to use for the output',
        options: [
            { name: 'AAC', value: 'aac' },
            { name: 'Copy', value: 'copy' },
            { name: 'FLAC', value: 'flac' },
            { name: 'MP3', value: 'libmp3lame' },
            { name: 'Opus', value: 'libopus' },
            { name: 'PCM 16-Bit', value: 'pcm_s16le' },
        ],
        displayOptions: {
            show: {
                operation: ['combine'],
            },
        },
    },
    {
        displayName: 'Use Shortest Duration',
        name: 'shortest',
        type: 'boolean',
        default: true,
        description: 'Whether to stop writing the output at the shortest input duration',
        displayOptions: {
            show: {
                operation: ['combine'],
            },
        },
    },
    {
        displayName: 'Overwrite Existing',
        name: 'overwrite',
        type: 'boolean',
        default: true,
        description: 'Whether to overwrite the output file if it exists',
        displayOptions: {
            show: {
                operation: ['combine'],
            },
        },
    },
];
exports.ffmpegFields = [
    ...convertFields,
    ...combineFields,
    {
        displayName: 'FFmpeg Binary Path',
        name: 'ffmpegPath',
        type: 'string',
        default: 'ffmpeg',
        description: 'Path to ffmpeg binary; defaults to "ffmpeg" in PATH',
    },
];
//# sourceMappingURL=FfmpegDescription.js.map