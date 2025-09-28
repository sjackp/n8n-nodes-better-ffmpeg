import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
	IDataObject,
} from 'n8n-workflow';

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { containerFormatOptions, audioCodecOptions } from './constants/options';

export class Ffmpeg implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Better FFmpeg',
		name: 'betterFfmpeg',
		icon: { light: 'file:ffmpeg.svg', dark: 'file:ffmpeg.svg' },
		group: ['transform'],
		version: 3,
		description: 'Run FFmpeg media operations',
		defaults: {
			name: 'FFmpeg',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Category',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Editing & Transcode', value: 'edit' },
					{ name: 'Muxing & Concatenate', value: 'mux' },
					{ name: 'Overlays & PiP', value: 'overlay' },
					{ name: 'Generation', value: 'generate' },
					{ name: 'Compression', value: 'compress' },
					{ name: 'Analyze', value: 'analyze' },
					{ name: 'Audio FX', value: 'audiofx' },
					{ name: 'Video FX', value: 'videofx' },
					{ name: 'Create', value: 'create' },
				],
				default: 'edit',
				description: 'Choose a category to see related actions',
			},
			{
				displayName: 'FFmpeg Binary Path',
				name: 'ffmpegPath',
				type: 'string',
				default: 'ffmpeg',
				description: 'Path to FFmpeg binary (or keep as "ffmpeg" if in PATH)'
			},
			{
				displayName: 'FFprobe Binary Path',
				name: 'ffprobePath',
				type: 'string',
				default: 'ffprobe',
				description: 'Path to FFprobe binary (or keep as "ffprobe" if in PATH)'
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Convert Format', value: 'convert', action: 'Convert media format' },
					{ name: 'Trim / Cut', value: 'trim', action: 'Extract a segment' },
					{ name: 'Resize', value: 'resize', action: 'Change resolution' },
					{ name: 'Crop', value: 'crop', action: 'Crop video frame' },
					{ name: 'Speed', value: 'speed', action: 'Change playback speed' },
				],
				default: 'convert',
				displayOptions: { show: { resource: ['edit'] } },
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Combine Video + Audio', value: 'combine', action: 'Mux video with external audio' },
					{ name: 'Stitch', value: 'stitch', action: 'Normalize and join clips reliably' },
				],
				default: 'combine',
				displayOptions: { show: { resource: ['mux'] } },
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Overlay / Watermark', value: 'overlay', action: 'Overlay image video on a base video' },
				],
				default: 'overlay',
				displayOptions: { show: { resource: ['overlay'] } },
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Thumbnail(s)', value: 'thumbnail', action: 'Extract one or more thumbnails' },
					{ name: 'GIF', value: 'gif', action: 'Create animated GIF' },
				],
				default: 'thumbnail',
				displayOptions: { show: { resource: ['generate'] } },
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Compress/Transcode', value: 'compressOp', action: 'Compress with codec profile' },
				],
				default: 'compressOp',
				displayOptions: { show: { resource: ['compress'] } },
			},
			// Audio FX
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Normalize Volume', value: 'normalize', action: 'Analyze then apply volume gain' },
					{ name: 'Remove Silence', value: 'removeSilenceFx', action: 'Strip silent segments' },
					{ name: 'Noise Reduction', value: 'denoise', action: 'Reduce background noise' },
					{ name: 'Equalizer', value: 'equalize', action: 'Adjust frequency bands' },
					{ name: 'Dynamic Compression', value: 'compressorFx', action: 'Even out volume levels' },
					{ name: 'Channel Mapping', value: 'channel', action: 'Map or collapse channels' },
					{ name: 'Tempo / Pitch', value: 'tempoPitch', action: 'Change tempo pitch' },
					{ name: 'Echo / Reverb', value: 'echoReverb', action: 'Add echo or convolution reverb' },
					{ name: 'Volume Automate (Mute/Duck/Gain)', value: 'volumeAutomate', action: 'Automate volume over a time window' },
				],
				default: 'normalize',
				displayOptions: { show: { resource: ['audiofx'] } },
			},
			{
				displayName: 'Input Audio/Video Path',
				name: 'audioFxInput',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['audiofx'] } },
			},
			// Normalize
			{
				displayName: 'Target Mode',
				name: 'normMode',
				type: 'options',
				options: [
					{ name: 'Peak', value: 'peak' },
					{ name: 'RMS (Mean Volume)', value: 'rms' },
				],
				default: 'peak',
				displayOptions: { show: { operation: ['normalize'] } },
			},
			{
				displayName: 'Target Level (dBFS)',
				name: 'normTargetDb',
				type: 'number',
				default: -1,
				description: 'For Peak: e.g., -1 dBFS; For RMS: typical -20 to -14 dBFS',
				displayOptions: { show: { operation: ['normalize'] } },
			},

			// Remove Silence
			{
				displayName: 'Auto Threshold',
				name: 'silenceAuto',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['removeSilenceFx'] } },
			},
			{
				displayName: 'Noise Threshold (dB)',
				name: 'silenceThreshDb',
				type: 'number',
				default: -35,
				displayOptions: { show: { operation: ['removeSilenceFx'], silenceAuto: [false] } },
			},
			{
				displayName: 'Min Start Silence (S)',
				name: 'silenceStartDur',
				type: 'number',
				default: 0.5,
				displayOptions: { show: { operation: ['removeSilenceFx'] } },
			},
			{
				displayName: 'Min Stop Silence (S)',
				name: 'silenceStopDur',
				type: 'number',
				default: 0.5,
				displayOptions: { show: { operation: ['removeSilenceFx'] } },
			},

			// Denoise
			{
				displayName: 'Method',
				name: 'denoiseMethod',
				type: 'options',
				options: [
					{ name: 'ANLMDN', value: 'anlmdn' },
					{ name: 'AFFTDN', value: 'afftdn' },
				],
				default: 'anlmdn',
				displayOptions: { show: { operation: ['denoise'] } },
			},

			// Equalizer
			{
				displayName: 'Mode',
				name: 'eqMode',
				type: 'options',
				options: [
					{ name: 'Single Band (Equalizer)', value: 'equalizer' },
					{ name: 'Multi-Band (Superequalizer)', value: 'superequalizer' },
				],
				default: 'equalizer',
				displayOptions: { show: { operation: ['equalize'] } },
			},
			{
				displayName: 'Frequency (Hz)',
				name: 'eqFreq',
				type: 'number',
				default: 1000,
				displayOptions: { show: { operation: ['equalize'], eqMode: ['equalizer'] } },
			},
			{
				displayName: 'Width (Q)',
				name: 'eqWidth',
				type: 'number',
				default: 1,
				displayOptions: { show: { operation: ['equalize'], eqMode: ['equalizer'] } },
			},
			{
				displayName: 'Gain (dB)',
				name: 'eqGain',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['equalize'], eqMode: ['equalizer'] } },
			},
			{
				displayName: 'Superequalizer Params',
				name: 'supEqParams',
				type: 'string',
				default: '1b=0:2b=0:3b=0:4b=0:5b=0:6b=0:7b=0:8b=0:9b=0:10b=0',
				description: 'Raw superequalizer args like 1b=0:2b=1:'
				,
				displayOptions: { show: { operation: ['equalize'], eqMode: ['superequalizer'] } },
			},

			// Compressor
			{
				displayName: 'Threshold (dB)',
				name: 'compThreshold',
				type: 'number',
				default: -18,
				displayOptions: { show: { operation: ['compressorFx'] } },
			},
			{
				displayName: 'Ratio',
				name: 'compRatio',
				type: 'number',
				default: 4,
				displayOptions: { show: { operation: ['compressorFx'] } },
			},
			{
				displayName: 'Attack (Ms)',
				name: 'compAttack',
				type: 'number',
				default: 10,
				displayOptions: { show: { operation: ['compressorFx'] } },
			},
			{
				displayName: 'Release (Ms)',
				name: 'compRelease',
				type: 'number',
				default: 200,
				displayOptions: { show: { operation: ['compressorFx'] } },
			},

			// Channel mapping
			{
				displayName: 'Channel Op',
				name: 'chanOp',
				type: 'options',
				options: [
					{ name: 'Stereo to Mono (Average)', value: 'stereoToMono' },
					{ name: 'Channel Map', value: 'channelmap' },
					{ name: 'Stereo Widen', value: 'stereowiden' },
				],
				default: 'stereoToMono',
				displayOptions: { show: { operation: ['channel'] } },
			},
			{
				displayName: 'Channel Map String',
				name: 'channelMapStr',
				type: 'string',
				default: 'FL-FR|FR-FL',
				description: 'Example: FL-FR|FR-FL',
				displayOptions: { show: { operation: ['channel'], chanOp: ['channelmap'] } },
			},
			{
				displayName: 'Stereo Widen Amount (0-1)',
				name: 'stereoWidenAmt',
				type: 'number',
				default: 0.3,
				displayOptions: { show: { operation: ['channel'], chanOp: ['stereowiden'] } },
			},

			// Tempo / Pitch
			{
				displayName: 'Mode',
				name: 'tpMode',
				type: 'options',
				options: [
					{ name: 'Tempo Only (Atempo)', value: 'tempo' },
					{ name: 'Pitch + Tempo (Asetrate Trick)', value: 'pitchTempo' },
				],
				default: 'tempo',
				displayOptions: { show: { operation: ['tempoPitch'] } },
			},
			{
				displayName: 'Tempo Factor',
				name: 'tempoFactor',
				type: 'number',
				default: 1,
				description: '0.5–2.0 per atempo instance; chaining is handled automatically',
				displayOptions: { show: { operation: ['tempoPitch'], tpMode: ['tempo'] } },
			},
			{
				displayName: 'Pitch Factor',
				name: 'pitchFactor',
				type: 'number',
				default: 1,
				description: '1.1 ≈ +1 semitone',
				displayOptions: { show: { operation: ['tempoPitch'], tpMode: ['pitchTempo'] } },
			},

			// Echo / Reverb
			{
				displayName: 'Effect',
				name: 'echoMode',
				type: 'options',
				options: [
					{ name: 'Echo (Aecho)', value: 'aecho' },
					{ name: 'Convolution Reverb (Afir)', value: 'afir' },
				],
				default: 'aecho',
				displayOptions: { show: { operation: ['echoReverb'] } },
			},
			{
				displayName: 'Echo Params (in_gain:out_gain:delays:Decays)',
				name: 'aechoParams',
				type: 'string',
				default: '0.8:0.9:1000:0.3',
				displayOptions: { show: { operation: ['echoReverb'], echoMode: ['aecho'] } },
			},
			{
				displayName: 'Impulse Response Path (WAV)',
				name: 'irPath',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['echoReverb'], echoMode: ['afir'] } },
			},

			// Volume Automate
			{
				displayName: 'Input Audio/Video Path',
				name: 'vaInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['volumeAutomate'] } },
			},
			{
				displayName: 'Start (Seconds)',
				name: 'vaStart',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['volumeAutomate'] } },
			},
			{
				displayName: 'End (Seconds)',
				name: 'vaEnd',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['volumeAutomate'] } },
			},
			{
				displayName: 'Mode',
				name: 'vaMode',
				type: 'options',
				options: [
					{ name: 'Mute', value: 'mute' },
					{ name: 'Duck (Negative dB)', value: 'duck' },
					{ name: 'Gain (Positive dB)', value: 'gain' },
				],
				default: 'mute',
				displayOptions: { show: { operation: ['volumeAutomate'] } },
			},
			{
				displayName: 'dB Amount (for Duck/Gain)',
				name: 'vaDb',
				type: 'number',
				default: -12,
				displayOptions: { show: { operation: ['volumeAutomate'], vaMode: ['duck', 'gain'] } },
			},
			{
				displayName: 'Fade (Ms)',
				name: 'vaFadeMs',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['volumeAutomate'] } },
			},

			// Video FX
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Stabilize (Deshake)', value: 'stabilize', action: 'Reduce camera shake' },
				],
				default: 'stabilize',
				displayOptions: { show: { resource: ['videofx'] } },
			},
			{
				displayName: 'Input Video Path',
				name: 'videoFxInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['stabilize'] } },
			},
			{
				displayName: 'Deshake Region X',
				name: 'deshakeX',
				type: 'number',
				default: 16,
				displayOptions: { show: { operation: ['stabilize'] } },
			},
			{
				displayName: 'Deshake Region Y',
				name: 'deshakeY',
				type: 'number',
				default: 16,
				displayOptions: { show: { operation: ['stabilize'] } },
			},
			{
				displayName: 'Search Range X',
				name: 'deshakeRx',
				type: 'number',
				default: 32,
				displayOptions: { show: { operation: ['stabilize'] } },
			},
			{
				displayName: 'Search Range Y',
				name: 'deshakeRy',
				type: 'number',
				default: 32,
				displayOptions: { show: { operation: ['stabilize'] } },
			},

			// Create
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Image + Audio → Video', value: 'imageAudioVideo', action: 'Create video from image and audio' },
					{ name: 'Waveform Image', value: 'waveImage', action: 'Render waveform to PNG' },
					{ name: 'Spectrum Image', value: 'spectrumImage', action: 'Render spectrum to PNG' },
				],
				default: 'imageAudioVideo',
				displayOptions: { show: { resource: ['create'] } },
			},
			{
				displayName: 'Image Path',
				name: 'createImagePath',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['imageAudioVideo'] } },
			},
			{
				displayName: 'Audio Path',
				name: 'createAudioPath',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['imageAudioVideo'] } },
			},
			{
				displayName: 'Output Video Path',
				name: 'createOutputPath',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['imageAudioVideo'] } },
			},
			{
				displayName: 'Waveform Input Audio Path',
				name: 'waveInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['waveImage'] } },
			},
			{
				displayName: 'Waveform Size (e.g., 1920x300)',
				name: 'waveSize',
				type: 'string',
				default: '1920x300',
				displayOptions: { show: { operation: ['waveImage'] } },
			},
			{
				displayName: 'Waveform Color',
				name: 'waveColor',
				type: 'color',
				default: 'white',
				displayOptions: { show: { operation: ['waveImage'] } },
			},
			{
				displayName: 'Waveform Output PNG Path',
				name: 'waveOutput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['waveImage'] } },
			},
			{
				displayName: 'Spectrum Input Audio Path',
				name: 'specInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['spectrumImage'] } },
			},
			{
				displayName: 'Spectrum Size (e.g., 1920x1080)',
				name: 'specSize',
				type: 'string',
				default: '1920x1080',
				displayOptions: { show: { operation: ['spectrumImage'] } },
			},
			{
				displayName: 'Spectrum Output PNG Path',
				name: 'specOutput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['spectrumImage'] } },
			},
			// Analyze
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Get Media Properties (Ffprobe)', value: 'mediaProps', action: 'Return detailed JSON metadata' },
					{ name: 'Detect Silence', value: 'detectSilence', action: 'Output silence intervals' },
					{ name: 'Detect Black Frames', value: 'detectBlack', action: 'Output black frame intervals' },
				],
				default: 'mediaProps',
				displayOptions: { show: { resource: ['analyze'] } },
			},
			{
				displayName: 'Input File Path',
				name: 'anInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['mediaProps', 'detectSilence', 'detectBlack'] } },
			},
			{
				displayName: 'Silence Noise Threshold (dB)',
				name: 'silenceNoiseDb',
				type: 'number',
				default: -30,
				description: 'Lower is quieter; typical -30 to -50',
				displayOptions: { show: { operation: ['detectSilence'] } },
			},
			{
				displayName: 'Min Silence Duration (S)',
				name: 'silenceMinDur',
				type: 'number',
				default: 0.5,
				displayOptions: { show: { operation: ['detectSilence'] } },
			},
			{
				displayName: 'Black Min Duration (S)',
				name: 'blackMinDur',
				type: 'number',
				default: 0.1,
				displayOptions: { show: { operation: ['detectBlack'] } },
			},
			{
				displayName: 'Black Picture Threshold (0-1)',
				name: 'blackPicTh',
				type: 'number',
				default: 0.98,
				displayOptions: { show: { operation: ['detectBlack'] } },
			},
			// Convert
			{
				displayName: 'Input File Path',
				name: 'inputPath',
				type: 'string',
				default: '',
				description: 'Path to source media file',
				displayOptions: {
					show: { operation: ['convert'] },
				},
			},
			{
				displayName: 'Target Format',
				name: 'targetFormat',
				type: 'options',
				options: containerFormatOptions,
				default: 'mp4',
				description: 'Output container/format',
				displayOptions: {
					show: { operation: ['convert'] },
				},
			},
			// Trim
			{
				displayName: 'Input File Path',
				name: 'trimInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['trim'] } },
			},
			{
				displayName: 'Start (Seconds)',
				name: 'trimStart',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['trim'] } },
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'trimDuration',
				type: 'number',
				default: 0,
				description: '0 means until end',
				displayOptions: { show: { operation: ['trim'] } },
			},
			{
				displayName: 'End (Seconds)',
				name: 'trimEnd',
				type: 'number',
				default: 0,
				description: 'If set, Duration is computed as end - start',
				displayOptions: { show: { operation: ['trim'] } },
			},
			{
				displayName: 'Stream Copy (No Re-Encode)',
				name: 'trimCopy',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['trim'] } },
			},
			{
				displayName: 'Output File Path',
				name: 'trimOutput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['trim'] } },
			},
			{
				displayName: 'Overwrite Existing',
				name: 'trimOverwrite',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['trim'] } },
			},
			// Resize
			{
				displayName: 'Input File Path',
				name: 'resizeInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['resize'] } },
			},
			{
				displayName: 'Width (Px, 0 to Auto)',
				name: 'resizeW',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['resize'] } },
			},
			{
				displayName: 'Height (Px, 0 to Auto)',
				name: 'resizeH',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['resize'] } },
			},
			{
				displayName: 'Output File Path',
				name: 'resizeOutput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['resize'] } },
			},
			{
				displayName: 'Overwrite Existing',
				name: 'resizeOverwrite',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['resize'] } },
			},
			// Crop
			{
				displayName: 'Input File Path',
				name: 'cropInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['crop'] } },
			},
			{
				displayName: 'Width (Px)',
				name: 'cropW',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['crop'] } },
			},
			{
				displayName: 'Height (Px)',
				name: 'cropH',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['crop'] } },
			},
			{
				displayName: 'X (Px)',
				name: 'cropX',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['crop'] } },
			},
			{
				displayName: 'Y (Px)',
				name: 'cropY',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['crop'] } },
			},
			{
				displayName: 'Output File Path',
				name: 'cropOutput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['crop'] } },
			},
			{
				displayName: 'Overwrite Existing',
				name: 'cropOverwrite',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['crop'] } },
			},
			// Speed
			{
				displayName: 'Input File Path',
				name: 'speedInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['speed'] } },
			},
			{
				displayName: 'Speed Factor',
				name: 'speedFactor',
				type: 'number',
				default: 1,
				description: '2 = 2x faster, 0.5 = half speed',
				displayOptions: { show: { operation: ['speed'] } },
			},
			{
				displayName: 'Output File Path',
				name: 'speedOutput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['speed'] } },
			},
			{
				displayName: 'Overwrite Existing',
				name: 'speedOverwrite',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['speed'] } },
			},
			{
				displayName: 'Output File Path',
				name: 'outputPath',
				type: 'string',
				default: '',
				description: 'If empty, will use input filename with new extension',
				displayOptions: {
					show: { operation: ['convert'] },
				},
			},
			{
				displayName: 'Overwrite Existing',
				name: 'overwrite',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: { operation: ['convert'] },
				},
			},
			// Thumbnail(s)
			{
				displayName: 'Input File Path',
				name: 'thumbInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['thumbnail'] } },
			},
			{
				displayName: 'Mode',
				name: 'thumbMode',
				type: 'options',
				options: [
					{ name: 'Single at Time', value: 'single' },
					{ name: 'Every N Seconds', value: 'interval' },
				],
				default: 'single',
				displayOptions: { show: { operation: ['thumbnail'] } },
			},
			{
				displayName: 'Time (Seconds)',
				name: 'thumbTime',
				type: 'number',
				default: 1,
				displayOptions: { show: { operation: ['thumbnail'], thumbMode: ['single'] } },
			},
			{
				displayName: 'Every N Seconds',
				name: 'thumbInterval',
				type: 'number',
				default: 5,
				displayOptions: { show: { operation: ['thumbnail'], thumbMode: ['interval'] } },
			},
			{
				displayName: 'Output Pattern (e.g. /tmp/frame_%03d.png)',
				name: 'thumbPattern',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['thumbnail'] } },
			},
			{
				displayName: 'Image Format',
				name: 'thumbFormat',
				type: 'options',
				options: [
					{ name: 'PNG', value: 'png' },
					{ name: 'JPG', value: 'jpg' },
				],
				default: 'png',
				displayOptions: { show: { operation: ['thumbnail'] } },
			},
			// GIF
			{
				displayName: 'Input File Path',
				name: 'gifInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['gif'] } },
			},
			{
				displayName: 'Start (Seconds)',
				name: 'gifStart',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['gif'] } },
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'gifDuration',
				type: 'number',
				default: 5,
				displayOptions: { show: { operation: ['gif'] } },
			},
			{
				displayName: 'End (Seconds)',
				name: 'gifEnd',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['gif'] } },
			},
			{
				displayName: 'Scale Width (Px, 0 Keep)',
				name: 'gifW',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['gif'] } },
			},
			{
				displayName: 'FPS',
				name: 'gifFps',
				type: 'number',
				default: 12,
				displayOptions: { show: { operation: ['gif'] } },
			},
			{
				displayName: 'Output GIF Path',
				name: 'gifOutput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['gif'] } },
			},
			// Compress
			{
				displayName: 'Input File Path',
				name: 'compressInput',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['compressOp'] } },
			},
			{
				displayName: 'Video Codec',
				name: 'compressVCodec',
				type: 'options',
				options: [
					{ name: 'LIBX264', value: 'libx264' },
					{ name: 'LIBX265', value: 'libx265' },
					{ name: 'LIBVPX-VP9', value: 'libvpx-vp9' },
					{ name: 'LIBAOM-AV1', value: 'libaom-av1' },
				],
				default: 'libx264',
				displayOptions: { show: { operation: ['compressOp'] } },
			},
			{
				displayName: 'Mode',
				name: 'compressMode',
				type: 'options',
				options: [
					{ name: 'CRF (Quality)', value: 'crf' },
					{ name: 'Bitrate (Kbps)', value: 'vbr' },
				],
				default: 'crf',
				displayOptions: { show: { operation: ['compressOp'] } },
			},
			{
				displayName: 'CRF (Lower = Better)',
				name: 'compressCrf',
				type: 'number',
				default: 23,
				displayOptions: { show: { operation: ['compressOp'], compressMode: ['crf'] } },
			},
			{
				displayName: 'Preset',
				name: 'compressPreset',
				type: 'options',
				options: [
					{ name: 'ULTRAFAST', value: 'ultrafast' },
					{ name: 'SUPERFAST', value: 'superfast' },
					{ name: 'VERYFAST', value: 'veryfast' },
					{ name: 'FASTER', value: 'faster' },
					{ name: 'FAST', value: 'fast' },
					{ name: 'MEDIUM', value: 'medium' },
					{ name: 'SLOW', value: 'slow' },
					{ name: 'SLOWER', value: 'slower' },
					{ name: 'VERYSLOW', value: 'veryslow' },
				],
				default: 'medium',
				displayOptions: { show: { operation: ['compressOp'] } },
			},
			{
				displayName: 'Video Bitrate (Kbps)',
				name: 'compressBitrate',
				type: 'number',
				default: 2000,
				displayOptions: { show: { operation: ['compressOp'], compressMode: ['vbr'] } },
			},
			{
				displayName: 'Two-Pass',
				name: 'compressTwoPass',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['compressOp'], compressMode: ['vbr'] } },
			},
			// Combine
			{
				displayName: 'Video File Path',
				name: 'videoPath',
				type: 'string',
				default: '',
				placeholder: '/path/to/video.mp4',
				displayOptions: {
					show: { operation: ['combine'] },
				},
			},
			{
				displayName: 'Audio File Path',
				name: 'audioPath',
				type: 'string',
				default: '',
				placeholder: '/path/to/audio.aac',
				displayOptions: {
					show: { operation: ['combine'] },
				},
			},
			// Concat (removed)
			// Overlay
			{
				displayName: 'Base Video Path',
				name: 'baseVideoPath',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Overlay Path (Image or Video)',
				name: 'overlayPath',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Position',
				name: 'overlayPosition',
				type: 'options',
				options: [
					{ name: 'TOP_LEFT', value: 'tl' },
					{ name: 'TOP_RIGHT', value: 'tr' },
					{ name: 'BOTTOM_LEFT', value: 'bl' },
					{ name: 'BOTTOM_RIGHT', value: 'br' },
					{ name: 'CENTER', value: 'c' },
				],
				default: 'tr',
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'X Offset',
				name: 'overlayX',
				type: 'number',
				default: 10,
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Y Offset',
				name: 'overlayY',
				type: 'number',
				default: 10,
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Overlay Scale Width (Px)',
				name: 'overlayScaleW',
				type: 'number',
				default: 0,
				description: '0 to keep original',
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Overlay Scale Height (Px)',
				name: 'overlayScaleH',
				type: 'number',
				default: 0,
				description: '0 to keep original',
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Opacity (0-1)',
				name: 'overlayOpacity',
				type: 'number',
				default: 1,
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Overlay Start (Seconds)',
				name: 'overlayStart',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Overlay End (Seconds)',
				name: 'overlayEnd',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Inherit Base Audio',
				name: 'overlayInheritAudio',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Output File Path',
				name: 'overlayOutputPath',
				type: 'string',
				default: '',
				description: 'If empty, will derive from base video with -overlay',
				displayOptions: { show: { operation: ['overlay'] } },
			},
			{
				displayName: 'Overwrite Existing',
				name: 'overlayOverwrite',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['overlay'] } },
			},
			// Concat params removed
			// Stitch (Safe)
			{
				displayName: 'Inputs (One Path per Line)',
				name: 'stitchInputsText',
				type: 'string',
				default: '',
				description: 'Absolute file paths, in order. One per line.',
				displayOptions: { show: { operation: ['stitch'] } },
			},
			{
				displayName: 'Inputs (Array)',
				name: 'stitchInputs',
				type: 'string',
				typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Path' },
				default: [],
				description: 'Alternative to the text field. Array of absolute paths.',
				displayOptions: { show: { operation: ['stitch'] } },
			},
			{
				displayName: 'Output File Path',
				name: 'stitchOutputPath',
				type: 'string',
				default: '',
				description: 'Absolute path for the final stitched video',
				displayOptions: { show: { operation: ['stitch'] } },
			},
			{
				displayName: 'Overwrite Existing',
				name: 'stitchOverwrite',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['stitch'] } },
			},
			{
				displayName: 'Include Audio (Best Effort)',
				name: 'stitchWithAudio',
				type: 'boolean',
				default: false,
				description: 'If off, outputs video-only to maximize reliability',
				displayOptions: { show: { operation: ['stitch'] } },
			},
			{
				displayName: 'Target FPS',
				name: 'stitchFps',
				type: 'number',
				default: 30,
				description: 'Normalize all clips to this FPS',
				displayOptions: { show: { operation: ['stitch'] } },
			},
			{
				displayName: 'Copy Video Stream',
				name: 'copyVideo',
				type: 'boolean',
				default: true,
				description: 'Whether to copy the original video stream without re-encoding',
				displayOptions: {
					show: { operation: ['combine'] },
				},
			},
			{
				displayName: 'Audio Codec',
				name: 'audioCodec',
				type: 'options',
				options: audioCodecOptions,
				default: 'aac',
				displayOptions: {
					show: { operation: ['combine'] },
				},
			},
			{
				displayName: 'Stop at Shortest Stream',
				name: 'shortest',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: { operation: ['combine'] },
				},
			},
			{
				displayName: 'Output File Path',
				name: 'outputPath',
				type: 'string',
				default: '',
				description: 'If empty, will use video filename with -combined.mp4',
				displayOptions: {
					show: { operation: ['combine'] },
				},
			},
			{
				displayName: 'Overwrite Existing',
				name: 'overwrite',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: { operation: ['combine'] },
				},
			},
			// Concat segment-related params removed
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as 'convert' | 'combine' | 'stitch' | 'trim' | 'resize' | 'crop' | 'speed' | 'overlay' | 'thumbnail' | 'gif' | 'compressOp' | 'mediaProps' | 'detectSilence' | 'detectBlack' | 'normalize' | 'removeSilenceFx' | 'denoise' | 'equalize' | 'compressorFx' | 'channel' | 'tempoPitch' | 'echoReverb' | 'volumeAutomate' | 'stabilize' | 'imageAudioVideo' | 'waveImage' | 'spectrumImage';
				const ffmpegPath = (this.getNodeParameter('ffmpegPath', itemIndex, 'ffmpeg') as string) || 'ffmpeg';
				const ffprobePath = (this.getNodeParameter('ffprobePath', itemIndex, 'ffprobe') as string) || 'ffprobe';

				let args: string[] = [];
				let resolvedOutputPath = '';
				let concatListForCleanup: string | undefined;
				let stitchTempsForCleanup: string[] | undefined;

				if (operation === 'convert') {
					const inputPath = this.getNodeParameter('inputPath', itemIndex) as string;
					const targetFormat = this.getNodeParameter('targetFormat', itemIndex) as string;
					const overwrite = this.getNodeParameter('overwrite', itemIndex, true) as boolean;
					const explicitOutput = (this.getNodeParameter('outputPath', itemIndex, '') as string) || '';

					await assertFileReadable(inputPath, this, itemIndex);

					resolvedOutputPath = explicitOutput || replaceExtension(inputPath, `.${targetFormat}`);
					args = [];
					if (overwrite) args.push('-y'); else args.push('-n');
					args.push('-i', inputPath);
					args.push(resolvedOutputPath);
				} else if (operation === 'combine') {
					const videoPath = this.getNodeParameter('videoPath', itemIndex) as string;
					const audioPath = this.getNodeParameter('audioPath', itemIndex) as string;
					const copyVideo = this.getNodeParameter('copyVideo', itemIndex, true) as boolean;
					const audioCodec = this.getNodeParameter('audioCodec', itemIndex, 'aac') as string;
					const shortest = this.getNodeParameter('shortest', itemIndex, true) as boolean;
					const overwrite = this.getNodeParameter('overwrite', itemIndex, true) as boolean;
					const explicitOutput = (this.getNodeParameter('outputPath', itemIndex, '') as string) || '';

					await assertFileReadable(videoPath, this, itemIndex);
					await assertFileReadable(audioPath, this, itemIndex);

					resolvedOutputPath = explicitOutput || deriveCombinedOutputPath(videoPath);
					args = [];
					if (overwrite) args.push('-y'); else args.push('-n');
					args.push('-i', videoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0');
					if (copyVideo) args.push('-c:v', 'copy');
					args.push('-c:a', audioCodec);
					if (shortest) args.push('-shortest');
					args.push(resolvedOutputPath);
				} else if (operation === 'stitch') {
					const overwrite = this.getNodeParameter('stitchOverwrite', itemIndex, true) as boolean;
					const withAudio = this.getNodeParameter('stitchWithAudio', itemIndex, false) as boolean;
					const targetFps = this.getNodeParameter('stitchFps', itemIndex, 30) as number;
					const outputPath = (this.getNodeParameter('stitchOutputPath', itemIndex, '') as string) || '';
					const inputsText = (this.getNodeParameter('stitchInputsText', itemIndex, '') as string) || '';
					const inputsArray = (this.getNodeParameter('stitchInputs', itemIndex, []) as string[]) || [];

					const listFromText = (inputsText || '')
						.split(/\r?\n/)
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					const providedInputs = Array.from(new Set([...(inputsArray || []), ...listFromText]));
					if (!Array.isArray(providedInputs) || providedInputs.length < 2) {
						throw new NodeOperationError(this.getNode(), 'Provide at least two input files to stitch', { itemIndex });
					}
					for (const p of providedInputs) await assertFileReadable(p, this, itemIndex);
					if (!outputPath) {
						throw new NodeOperationError(this.getNode(), 'Output File Path is required for Stitch', { itemIndex });
					}

					// Determine target width/height using first input; fallback to 1280x720
					let targetW = 1280;
					let targetH = 720;
					try {
						const probe = await runFfprobe(ffprobePath, ['-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', providedInputs[0]]);
						if (probe.exitCode === 0) {
							try {
								const parsed = JSON.parse(probe.stdout || '{}') as any;
								const st = parsed?.streams?.[0];
								if (st?.width && st?.height) { targetW = Number(st.width) || targetW; targetH = Number(st.height) || targetH; }
							} catch {}
						}
					} catch {}

					// Normalize all inputs
					stitchTempsForCleanup = [];
					const normalized: string[] = [];
					for (const p of providedInputs) {
						// Check if input has audio and duration when withAudio
						let hasAudio = false;
						let durationSec = 0;
						if (withAudio) {
							try {
								const probe = await runFfprobe(ffprobePath, ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', p]);
								if (probe.exitCode === 0) {
									const meta = JSON.parse(probe.stdout || '{}') as any;
									hasAudio = Array.isArray(meta?.streams) && meta.streams.some((s: any) => s?.codec_type === 'audio');
									const d = Number(meta?.format?.duration);
									if (Number.isFinite(d) && d > 0) durationSec = d;
								}
							} catch {}
						}

						const tmpOut = path.join(os.tmpdir(), `stitch-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
						stitchTempsForCleanup.push(tmpOut);
						const vf = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${Math.max(1, Math.floor(targetFps || 30))}`;
						let normArgs: string[] = [];
						if (!withAudio) {
							normArgs = ['-y', '-i', p, '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', tmpOut];
						} else if (hasAudio) {
							normArgs = ['-y', '-i', p, '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2', '-ar', '48000', '-shortest', tmpOut];
						} else {
							const dur = durationSec > 0 ? durationSec.toFixed(3) : '99999';
							normArgs = ['-y', '-i', p, '-f', 'lavfi', '-t', dur, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-filter_complex', `[0:v]${vf}[v]`, '-map', '[v]', '-map', '1:a:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', tmpOut];
						}
						const { exitCode, stderr } = await runFfmpeg(ffmpegPath, normArgs);
						if (exitCode !== 0) {
							throw new NodeOperationError(this.getNode(), `FFmpeg normalization failed for ${p}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
						}
						normalized.push(tmpOut);
					}

					// Concat normalized clips
					resolvedOutputPath = outputPath;
					args = [];
					if (overwrite) args.push('-y'); else args.push('-n');
					for (const p of normalized) args.push('-i', p);
					const n = normalized.length;
					if (!withAudio) {
						const videoLabels = Array.from({ length: n }, (_, i) => `[${i}:v:0]`).join('');
						const filter = `${videoLabels}concat=n=${n}:v=1:a=0[v]`;
						args.push('-filter_complex', filter);
						args.push('-map', '[v]');
						args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', resolvedOutputPath);
					} else {
						const avLabels = Array.from({ length: n }, (_, i) => `[${i}:v:0][${i}:a:0]`).join('');
						const filter = `${avLabels}concat=n=${n}:v=1:a=1[v][a]`;
						args.push('-filter_complex', filter);
						args.push('-map', '[v]', '-map', '[a]');
						args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', resolvedOutputPath);
					}
				} else if (operation === 'trim') {
					const input = this.getNodeParameter('trimInput', itemIndex) as string;
					const start = this.getNodeParameter('trimStart', itemIndex, 0) as number;
					const duration = this.getNodeParameter('trimDuration', itemIndex, 0) as number;
					const end = this.getNodeParameter('trimEnd', itemIndex, 0) as number;
					const copy = this.getNodeParameter('trimCopy', itemIndex, true) as boolean;
					const overwrite = this.getNodeParameter('trimOverwrite', itemIndex, true) as boolean;
					const explicitOutput = (this.getNodeParameter('trimOutput', itemIndex, '') as string) || '';

					await assertFileReadable(input, this, itemIndex);
					resolvedOutputPath = explicitOutput || deriveWithSuffix(input, '-trim');
					args = [];
					if (overwrite) args.push('-y'); else args.push('-n');
					if (start > 0) args.push('-ss', String(start));
					args.push('-i', input);
					if ((end ?? 0) > 0 && (start ?? 0) >= 0 && end > start) {
						args.push('-to', String(end));
					} else if (duration > 0) {
						args.push('-t', String(duration));
					}
					if (copy) args.push('-c', 'copy');
					args.push(resolvedOutputPath);
				} else if (operation === 'resize') {
					const input = this.getNodeParameter('resizeInput', itemIndex) as string;
					const w = this.getNodeParameter('resizeW', itemIndex, 0) as number;
					const h = this.getNodeParameter('resizeH', itemIndex, 0) as number;
					const overwrite = this.getNodeParameter('resizeOverwrite', itemIndex, true) as boolean;
					const explicitOutput = (this.getNodeParameter('resizeOutput', itemIndex, '') as string) || '';

					await assertFileReadable(input, this, itemIndex);
					resolvedOutputPath = explicitOutput || deriveWithSuffix(input, '-resize');
					const wExpr = (w ?? 0) > 0 ? String(w) : '-2';
					const hExpr = (h ?? 0) > 0 ? String(h) : '-2';
					args = [];
					if (overwrite) args.push('-y'); else args.push('-n');
					args.push('-i', input, '-vf', `scale=${wExpr}:${hExpr}`);
					args.push('-c:v', 'libx264', '-c:a', 'copy', resolvedOutputPath);
				} else if (operation === 'crop') {
					const input = this.getNodeParameter('cropInput', itemIndex) as string;
					const w = this.getNodeParameter('cropW', itemIndex, 0) as number;
					const h = this.getNodeParameter('cropH', itemIndex, 0) as number;
					const x = this.getNodeParameter('cropX', itemIndex, 0) as number;
					const y = this.getNodeParameter('cropY', itemIndex, 0) as number;
					const overwrite = this.getNodeParameter('cropOverwrite', itemIndex, true) as boolean;
					const explicitOutput = (this.getNodeParameter('cropOutput', itemIndex, '') as string) || '';

					if ((w ?? 0) <= 0 || (h ?? 0) <= 0) {
						throw new NodeOperationError(this.getNode(), 'Crop width and height must be > 0', { itemIndex });
					}
					await assertFileReadable(input, this, itemIndex);
					resolvedOutputPath = explicitOutput || deriveWithSuffix(input, '-crop');
					args = [];
					if (overwrite) args.push('-y'); else args.push('-n');
					args.push('-i', input, '-vf', `crop=${w}:${h}:${x}:${y}`);
					args.push('-c:v', 'libx264', '-c:a', 'copy', resolvedOutputPath);
				} else if (operation === 'speed') {
					const input = this.getNodeParameter('speedInput', itemIndex) as string;
					const factor = this.getNodeParameter('speedFactor', itemIndex, 1) as number;
					const overwrite = this.getNodeParameter('speedOverwrite', itemIndex, true) as boolean;
					const explicitOutput = (this.getNodeParameter('speedOutput', itemIndex, '') as string) || '';

					if (!(factor > 0)) {
						throw new NodeOperationError(this.getNode(), 'Speed factor must be > 0', { itemIndex });
					}
					await assertFileReadable(input, this, itemIndex);
					resolvedOutputPath = explicitOutput || deriveWithSuffix(input, `-speed-${factor}`);
					const setpts = (1 / factor).toFixed(6);
					const atempoFilters = buildAtempoChain(factor);
					args = [];
					if (overwrite) args.push('-y'); else args.push('-n');
					args.push('-i', input, '-filter_complex', `[0:v]setpts=${setpts}*PTS[v];[0:a]${atempoFilters}[a]`, '-map', '[v]', '-map', '[a]');
					args.push('-c:v', 'libx264', resolvedOutputPath);
				} else if (operation === 'overlay') {
					const baseVideoPath = this.getNodeParameter('baseVideoPath', itemIndex) as string;
					const overlayPath = this.getNodeParameter('overlayPath', itemIndex) as string;
					const position = this.getNodeParameter('overlayPosition', itemIndex, 'tr') as 'tl' | 'tr' | 'bl' | 'br' | 'c';
					const xOffset = this.getNodeParameter('overlayX', itemIndex, 10) as number;
					const yOffset = this.getNodeParameter('overlayY', itemIndex, 10) as number;
					const scaleW = this.getNodeParameter('overlayScaleW', itemIndex, 0) as number;
					const scaleH = this.getNodeParameter('overlayScaleH', itemIndex, 0) as number;
					const opacity = this.getNodeParameter('overlayOpacity', itemIndex, 1) as number;
					const oStart = this.getNodeParameter('overlayStart', itemIndex, 0) as number;
					const oEnd = this.getNodeParameter('overlayEnd', itemIndex, 0) as number;
					const inheritAudio = this.getNodeParameter('overlayInheritAudio', itemIndex, true) as boolean;
					const overwrite = this.getNodeParameter('overlayOverwrite', itemIndex, true) as boolean;
					const explicitOutput = (this.getNodeParameter('overlayOutputPath', itemIndex, '') as string) || '';

					await assertFileReadable(baseVideoPath, this, itemIndex);
					await assertFileReadable(overlayPath, this, itemIndex);

					resolvedOutputPath = explicitOutput || deriveOverlayOutputPath(baseVideoPath);
					args = [];
					if (overwrite) args.push('-y'); else args.push('-n');
					args.push('-i', baseVideoPath, '-i', overlayPath);

					let posExpr = '';
					switch (position) {
						case 'tl': posExpr = `${xOffset}:${yOffset}`; break;
						case 'tr': posExpr = `W-w-${xOffset}:${yOffset}`; break;
						case 'bl': posExpr = `${xOffset}:H-h-${yOffset}`; break;
						case 'br': posExpr = `W-w-${xOffset}:H-h-${yOffset}`; break;
						case 'c': posExpr = `(W-w)/2+${xOffset}:(H-h)/2+${yOffset}`; break;
					}

					const hasScale = (scaleW ?? 0) > 0 || (scaleH ?? 0) > 0;
					let filters: string[] = [];
					let overlayInputLabel = '1:v';
					if (hasScale) {
						const wExpr = (scaleW ?? 0) > 0 ? String(scaleW) : '-1';
						const hExpr = (scaleH ?? 0) > 0 ? String(scaleH) : '-1';
						filters.push(`[1:v]scale=${wExpr}:${hExpr}[ov]`);
						overlayInputLabel = 'ov';
					}
					if ((opacity ?? 1) < 1) {
						filters.push(`[${overlayInputLabel}]format=rgba,colorchannelmixer=aa=${opacity}[ov2]`);
						overlayInputLabel = 'ov2';
					}
					const enableExpr = (oEnd ?? 0) > 0 && oEnd > (oStart ?? 0) ? `:enable='between(t,${oStart},${oEnd})'` : '';
					filters.push(`[0:v][${overlayInputLabel}]overlay=${posExpr}${enableExpr}[v]`);
					const filterComplex = filters.join(';');
					args.push('-filter_complex', filterComplex);
					if (inheritAudio) args.push('-map', '[v]', '-map', '0:a?'); else args.push('-map', '[v]');
					args.push('-c:v', 'libx264');
					args.push(resolvedOutputPath);
				} else if (operation === 'thumbnail') {
					const input = this.getNodeParameter('thumbInput', itemIndex) as string;
					const mode = this.getNodeParameter('thumbMode', itemIndex, 'single') as 'single' | 'interval';
					const time = this.getNodeParameter('thumbTime', itemIndex, 1) as number;
					const every = this.getNodeParameter('thumbInterval', itemIndex, 5) as number;
					const pattern = (this.getNodeParameter('thumbPattern', itemIndex, '') as string) || '';
					const fmt = this.getNodeParameter('thumbFormat', itemIndex, 'png') as string;

					await assertFileReadable(input, this, itemIndex);
					if (!pattern) {
						throw new NodeOperationError(this.getNode(), 'Output pattern is required for thumbnails', { itemIndex });
					}
					args = [];
					args.push('-y');
					if (mode === 'single') {
						args.push('-ss', String(time));
						args.push('-i', input, '-frames:v', '1');
					} else {
						args.push('-i', input, '-vf', `fps=1/${Math.max(0.1, every)}`);
					}
					args.push('-qscale:v', '2');
					const outPattern = pattern.endsWith(fmt) ? pattern : pattern;
					args.push(outPattern);
					resolvedOutputPath = outPattern;
				} else if (operation === 'gif') {
					const input = this.getNodeParameter('gifInput', itemIndex) as string;
					const start = this.getNodeParameter('gifStart', itemIndex, 0) as number;
					const duration = this.getNodeParameter('gifDuration', itemIndex, 5) as number;
					const end = this.getNodeParameter('gifEnd', itemIndex, 0) as number;
					const w = this.getNodeParameter('gifW', itemIndex, 0) as number;
					const fps = this.getNodeParameter('gifFps', itemIndex, 12) as number;
					const output = (this.getNodeParameter('gifOutput', itemIndex, '') as string) || '';

					await assertFileReadable(input, this, itemIndex);
					if (!output) {
						throw new NodeOperationError(this.getNode(), 'Output GIF path is required', { itemIndex });
					}
					const palettePath = path.join(os.tmpdir(), `ffpal-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
					const scaleExpr = (w ?? 0) > 0 ? `,scale=${w}:-1:flags=lanczos` : '';
					// two-pass palette
					const firstPassArgs: string[] = [
						'-y',
						...(start > 0 ? ['-ss', String(start)] : []),
						...((end ?? 0) > 0 && end > start ? ['-to', String(end)] : (duration > 0 ? ['-t', String(Math.max(0.1, duration))] : [])),
						'-i', input,
						'-vf', `fps=${fps}${scaleExpr},palettegen`,
						palettePath,
					];
					await runFfmpeg(ffmpegPath, firstPassArgs);
					args = [];
					args.push('-y');
					if (start > 0) args.push('-ss', String(start));
					if ((end ?? 0) > 0 && end > start) args.push('-to', String(end));
					else if (duration > 0) args.push('-t', String(Math.max(0.1, duration)));
					args.push('-i', input, '-i', palettePath);
					args.push('-filter_complex', `fps=${fps}${scaleExpr}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`);
					args.push(output);
					resolvedOutputPath = output;
					try { await fs.unlink(palettePath); } catch {}
				} else if (operation === 'compressOp') {
					const input = this.getNodeParameter('compressInput', itemIndex) as string;
					const vcodec = this.getNodeParameter('compressVCodec', itemIndex, 'libx264') as string;
					const mode = this.getNodeParameter('compressMode', itemIndex, 'crf') as 'crf' | 'vbr';
					const crf = this.getNodeParameter('compressCrf', itemIndex, 23) as number;
					const preset = this.getNodeParameter('compressPreset', itemIndex, 'medium') as string;
					const bitrate = this.getNodeParameter('compressBitrate', itemIndex, 2000) as number;
					const twoPass = this.getNodeParameter('compressTwoPass', itemIndex, false) as boolean;
					const explicitOutput = (this.getNodeParameter('outputPath', itemIndex, '') as string) || '';

					await assertFileReadable(input, this, itemIndex);
					resolvedOutputPath = explicitOutput || deriveWithSuffix(input, '-compressed');
					if (mode === 'crf') {
						args = ['-y', '-i', input, '-c:v', vcodec, '-preset', preset, '-crf', String(crf), '-c:a', 'copy', resolvedOutputPath];
					} else {
						if (twoPass) {
							// pass 1
							await runFfmpeg(ffmpegPath, ['-y', '-i', input, '-c:v', vcodec, '-b:v', `${bitrate}k`, '-pass', '1', '-an', '-f', 'null', os.platform() === 'win32' ? 'NUL' : '/dev/null']);
							// pass 2
							args = ['-y', '-i', input, '-c:v', vcodec, '-b:v', `${bitrate}k`, '-pass', '2', '-c:a', 'copy', resolvedOutputPath];
						} else {
							args = ['-y', '-i', input, '-c:v', vcodec, '-b:v', `${bitrate}k`, '-c:a', 'copy', resolvedOutputPath];
						}
					}
				} else if (operation === 'normalize') {
					const input = this.getNodeParameter('audioFxInput', itemIndex) as string;
					const mode = this.getNodeParameter('normMode', itemIndex, 'peak') as 'peak' | 'rms';
					const targetDb = this.getNodeParameter('normTargetDb', itemIndex, -1) as number;
					await assertFileReadable(input, this, itemIndex);
					// Analyze
					const { stderr: anal } = await runFfmpeg(ffmpegPath, ['-hide_banner', '-i', input, '-af', 'volumedetect', '-f', 'null', os.platform() === 'win32' ? 'NUL' : '/dev/null']);
					const { mean, max } = parseVolumeDetect(anal || '');
					let gainDb = 0;
					if (mode === 'peak' && max !== undefined) gainDb = targetDb - max;
					else if (mode === 'rms' && mean !== undefined) gainDb = targetDb - mean;
					const outputPath = deriveWithSuffix(input, '-normalized');
					args = ['-y', '-i', input, '-af', `volume=${gainDb.toFixed(3)}dB`, '-c:v', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg normalize failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath, analysis: { mean, max, gainDb } } });
					continue;
				} else if (operation === 'removeSilenceFx') {
					const input = this.getNodeParameter('audioFxInput', itemIndex) as string;
					const auto = this.getNodeParameter('silenceAuto', itemIndex, true) as boolean;
					let thresh = this.getNodeParameter('silenceThreshDb', itemIndex, -35) as number;
					const startDur = this.getNodeParameter('silenceStartDur', itemIndex, 0.5) as number;
					const stopDur = this.getNodeParameter('silenceStopDur', itemIndex, 0.5) as number;
					await assertFileReadable(input, this, itemIndex);
					if (auto) {
						const { stderr: anal } = await runFfmpeg(ffmpegPath, ['-hide_banner', '-i', input, '-af', 'volumedetect', '-f', 'null', os.platform() === 'win32' ? 'NUL' : '/dev/null']);
						const { mean } = parseVolumeDetect(anal || '');
						if (mean !== undefined) thresh = Math.min(-10, mean - 5); // heuristic: 5 dB below mean, capped at -10 dB
					}
					const filter = `silenceremove=start_periods=1:start_silence=${Math.max(0, startDur)}:start_threshold=${thresh}dB:stop_periods=1:stop_silence=${Math.max(0, stopDur)}:stop_threshold=${thresh}dB`;
					const outputPath = deriveWithSuffix(input, '-nosilence');
					args = ['-y', '-i', input, '-af', filter, '-c:v', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg removeSilence failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath, thresholdDb: thresh } });
					continue;
				} else if (operation === 'denoise') {
					const input = this.getNodeParameter('audioFxInput', itemIndex) as string;
					const method = this.getNodeParameter('denoiseMethod', itemIndex, 'anlmdn') as 'anlmdn' | 'afftdn';
					await assertFileReadable(input, this, itemIndex);
					const af = method === 'anlmdn' ? 'anlmdn=s=10:p=0.02' : 'afftdn=nf=-25';
					const outputPath = deriveWithSuffix(input, `-denoise-${method}`);
					args = ['-y', '-i', input, '-af', af, '-c:v', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg denoise failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath, method } });
					continue;
				} else if (operation === 'equalize') {
					const input = this.getNodeParameter('audioFxInput', itemIndex) as string;
					const mode = this.getNodeParameter('eqMode', itemIndex, 'equalizer') as 'equalizer' | 'superequalizer';
					await assertFileReadable(input, this, itemIndex);
					let af = '';
					if (mode === 'equalizer') {
						const f = this.getNodeParameter('eqFreq', itemIndex, 1000) as number;
						const w = this.getNodeParameter('eqWidth', itemIndex, 1) as number;
						const g = this.getNodeParameter('eqGain', itemIndex, 0) as number;
						af = `equalizer=f=${f}:t=q:w=${w}:g=${g}`;
					} else {
						const raw = (this.getNodeParameter('supEqParams', itemIndex, '1b=0:2b=0') as string) || '1b=0:2b=0';
						af = `superequalizer=${raw}`;
					}
					const outputPath = deriveWithSuffix(input, `-eq`);
					args = ['-y', '-i', input, '-af', af, '-c:v', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg equalize failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath, mode } });
					continue;
				} else if (operation === 'compressorFx') {
					const input = this.getNodeParameter('audioFxInput', itemIndex) as string;
					const threshold = this.getNodeParameter('compThreshold', itemIndex, -18) as number;
					const ratio = this.getNodeParameter('compRatio', itemIndex, 4) as number;
					const attack = this.getNodeParameter('compAttack', itemIndex, 10) as number;
					const release = this.getNodeParameter('compRelease', itemIndex, 200) as number;
					await assertFileReadable(input, this, itemIndex);
					const af = `acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=${attack}:release=${release}`;
					const outputPath = deriveWithSuffix(input, `-drc`);
					args = ['-y', '-i', input, '-af', af, '-c:v', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg compressor failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath } });
					continue;
				} else if (operation === 'channel') {
					const input = this.getNodeParameter('audioFxInput', itemIndex) as string;
					const op = this.getNodeParameter('chanOp', itemIndex, 'stereoToMono') as 'stereoToMono' | 'channelmap' | 'stereowiden';
					await assertFileReadable(input, this, itemIndex);
					let af = '';
					if (op === 'stereoToMono') af = 'pan=mono|c0=0.5*c0+0.5*c1';
					else if (op === 'channelmap') {
						const mapStr = (this.getNodeParameter('channelMapStr', itemIndex, 'FL-FR|FR-FL') as string) || 'FL-FR|FR-FL';
						af = `channelmap=map=${mapStr}`;
					} else if (op === 'stereowiden') {
						const amt = this.getNodeParameter('stereoWidenAmt', itemIndex, 0.3) as number;
						af = `stereowiden=widen=${Math.min(1, Math.max(0, amt))}`;
					}
					const outputPath = deriveWithSuffix(input, `-channel`);
					args = ['-y', '-i', input, '-af', af, '-c:v', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg channel op failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath, op } });
					continue;
				} else if (operation === 'tempoPitch') {
					const input = this.getNodeParameter('audioFxInput', itemIndex) as string;
					const mode = this.getNodeParameter('tpMode', itemIndex, 'tempo') as 'tempo' | 'pitchTempo';
					await assertFileReadable(input, this, itemIndex);
					let af = '';
					if (mode === 'tempo') {
						const factor = this.getNodeParameter('tempoFactor', itemIndex, 1) as number;
						af = buildAtempoChain(factor);
					} else {
						const pitch = this.getNodeParameter('pitchFactor', itemIndex, 1) as number;
						af = `asetrate=48000*${pitch},aresample=48000,atempo=${(1/pitch).toFixed(6)}`;
					}
					const outputPath = deriveWithSuffix(input, `-tp`);
					args = ['-y', '-i', input, '-af', af, '-c:v', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg tempo/pitch failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath } });
					continue;
				} else if (operation === 'echoReverb') {
					const input = this.getNodeParameter('audioFxInput', itemIndex) as string;
					const mode = this.getNodeParameter('echoMode', itemIndex, 'aecho') as 'aecho' | 'afir';
					await assertFileReadable(input, this, itemIndex);
					let filterComplex = '';
					let argsLocal: string[] = [];
					const outputPath = deriveWithSuffix(input, `-reverb`);
					if (mode === 'aecho') {
						const params = (this.getNodeParameter('aechoParams', itemIndex, '0.8:0.9:1000:0.3') as string) || '0.8:0.9:1000:0.3';
						argsLocal = ['-y', '-i', input, '-af', `aecho=${params}`, '-c:v', 'copy', outputPath];
					} else {
						const ir = this.getNodeParameter('irPath', itemIndex, '') as string;
						if (!ir) {
							throw new NodeOperationError(this.getNode(), 'Impulse response path is required for afir', { itemIndex });
						}
						await assertFileReadable(ir, this, itemIndex);
						filterComplex = '[0:a][1:a]afir';
						argsLocal = ['-y', '-i', input, '-i', ir, '-filter_complex', filterComplex, '-map', '0:v?','-map','[outa]'];
						// afir outputs a single audio stream; map it explicitly
						argsLocal = ['-y', '-i', input, '-i', ir, '-filter_complex', '[0:a][1:a]afir[outa]', '-map', '0:v?', '-map', '[outa]', outputPath];
					}
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, argsLocal);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg echo/reverb failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath, mode } });
					continue;
				} else if (operation === 'volumeAutomate') {
					const input = this.getNodeParameter('vaInput', itemIndex) as string;
					const vStart = this.getNodeParameter('vaStart', itemIndex, 0) as number;
					const vEnd = this.getNodeParameter('vaEnd', itemIndex, 0) as number;
					const vaMode = this.getNodeParameter('vaMode', itemIndex, 'mute') as 'mute' | 'duck' | 'gain';
					const vaDb = this.getNodeParameter('vaDb', itemIndex, -12) as number;
					const fadeMs = this.getNodeParameter('vaFadeMs', itemIndex, 0) as number;
					await assertFileReadable(input, this, itemIndex);
					const enable = (vEnd ?? 0) > 0 && vEnd > (vStart ?? 0) ? `between(t,${vStart},${vEnd})` : '1';
					let volExpr = '0';
					if (vaMode === 'duck' || vaMode === 'gain') {
						const linear = Math.pow(10, (vaDb || 0) / 20);
						volExpr = linear.toFixed(6);
					}
					const volFilter = vaMode === 'mute' ? `volume=0:enable='${enable}'` : `volume=${volExpr}:enable='${enable}'`;
					const fadeSec = Math.max(0, (fadeMs || 0) / 1000);
					const fades: string[] = [];
					if (fadeSec > 0 && (vEnd ?? 0) > 0 && vEnd > (vStart ?? 0)) {
						fades.push(`afade=t=out:st=${vStart}:d=${fadeSec}`);
						fades.push(`afade=t=in:st=${vEnd}:d=${fadeSec}`);
					}
					const af = [...fades, volFilter].join(',');
					const outputPath = deriveWithSuffix(input, '-va');
					args = ['-y', '-i', input, '-af', af, '-c:v', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg volumeAutomate failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath, window: { start: vStart, end: vEnd }, mode: vaMode, db: vaDb } });
					continue;
				} else if (operation === 'stabilize') {
					const input = this.getNodeParameter('videoFxInput', itemIndex) as string;
					const x = this.getNodeParameter('deshakeX', itemIndex, 16) as number;
					const y = this.getNodeParameter('deshakeY', itemIndex, 16) as number;
					const rx = this.getNodeParameter('deshakeRx', itemIndex, 32) as number;
					const ry = this.getNodeParameter('deshakeRy', itemIndex, 32) as number;
					await assertFileReadable(input, this, itemIndex);
					const outputPath = deriveWithSuffix(input, '-stabilized');
					const vf = `deshake=x=${x}:y=${y}:rx=${rx}:ry=${ry}`;
					args = ['-y', '-i', input, '-vf', vf, '-c:a', 'copy', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg stabilize failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath } });
					continue;
				} else if (operation === 'imageAudioVideo') {
					const imagePath = this.getNodeParameter('createImagePath', itemIndex) as string;
					const audioPath = this.getNodeParameter('createAudioPath', itemIndex) as string;
					const outputPath = (this.getNodeParameter('createOutputPath', itemIndex, '') as string) || deriveWithSuffix(audioPath, '-video');
					await assertFileReadable(imagePath, this, itemIndex);
					await assertFileReadable(audioPath, this, itemIndex);
					args = ['-y', '-loop', '1', '-i', imagePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-shortest', outputPath];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg image+audio→video failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath } });
					continue;
				} else if (operation === 'waveImage') {
					const input = this.getNodeParameter('waveInput', itemIndex) as string;
					const size = this.getNodeParameter('waveSize', itemIndex, '1920x300') as string;
					const color = this.getNodeParameter('waveColor', itemIndex, 'white') as string;
					const output = this.getNodeParameter('waveOutput', itemIndex, '') as string;
					if (!output) throw new NodeOperationError(this.getNode(), 'Waveform output path is required', { itemIndex });
					await assertFileReadable(input, this, itemIndex);
					args = ['-y', '-i', input, '-lavfi', `showwavespic=s=${size}:colors=${color}`, '-frames:v', '1', output];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg waveform image failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath: output } });
					continue;
				} else if (operation === 'spectrumImage') {
					const input = this.getNodeParameter('specInput', itemIndex) as string;
					const size = this.getNodeParameter('specSize', itemIndex, '1920x1080') as string;
					const output = this.getNodeParameter('specOutput', itemIndex, '') as string;
					if (!output) throw new NodeOperationError(this.getNode(), 'Spectrum output path is required', { itemIndex });
					await assertFileReadable(input, this, itemIndex);
					args = ['-y', '-i', input, '-lavfi', `showspectrumpic=s=${size}:legend=disabled`, '-frames:v', '1', output];
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, args);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg spectrum image failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					returnItems.push({ json: { success: true, operation, outputPath: output } });
					continue;
				} else if (operation === 'mediaProps') {
					const inputPath = this.getNodeParameter('anInput', itemIndex) as string;
					await assertFileReadable(inputPath, this, itemIndex);
					const { exitCode, stdout, stderr } = await runFfprobe(ffprobePath, ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath]);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `ffprobe failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					let parsed: IDataObject | IDataObject[] | undefined = undefined;
					try { parsed = JSON.parse(stdout || '{}') as IDataObject | IDataObject[]; } catch {}
					returnItems.push({ json: { success: true, operation, metadata: parsed as IDataObject } });
					continue;
				} else if (operation === 'detectSilence') {
					const inputPath = this.getNodeParameter('anInput', itemIndex) as string;
					const noiseDb = this.getNodeParameter('silenceNoiseDb', itemIndex, -30) as number;
					const minDur = this.getNodeParameter('silenceMinDur', itemIndex, 0.5) as number;
					await assertFileReadable(inputPath, this, itemIndex);
					const filter = `silencedetect=noise=${noiseDb}dB:d=${Math.max(0, minDur)}`;
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, ['-hide_banner', '-i', inputPath, '-af', filter, '-f', 'null', os.platform() === 'win32' ? 'NUL' : '/dev/null']);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg detectSilence failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					const intervals = parseSilenceIntervals(stderr || '');
					returnItems.push({ json: { success: true, operation, inputPath, intervals } });
					continue;
				} else if (operation === 'detectBlack') {
					const inputPath = this.getNodeParameter('anInput', itemIndex) as string;
					const minDur = this.getNodeParameter('blackMinDur', itemIndex, 0.1) as number;
					const picTh = this.getNodeParameter('blackPicTh', itemIndex, 0.98) as number;
					await assertFileReadable(inputPath, this, itemIndex);
					const filter = `blackdetect=d=${Math.max(0, minDur)}:pic_th=${Math.min(1, Math.max(0, picTh))}`;
					const { exitCode, stderr } = await runFfmpeg(ffmpegPath, ['-hide_banner', '-i', inputPath, '-vf', filter, '-f', 'null', os.platform() === 'win32' ? 'NUL' : '/dev/null']);
					if (exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), `FFmpeg detectBlack failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`, { itemIndex });
					}
					const intervals = parseBlackIntervals(stderr || '');
					returnItems.push({ json: { success: true, operation, inputPath, intervals } });
					continue;
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
				}

				const { exitCode, stdout, stderr } = await runFfmpeg(ffmpegPath, args);
				if (exitCode !== 0) {
					throw new NodeOperationError(
						this.getNode(),
						`FFmpeg failed with code ${exitCode}: ${stderr?.slice(0, 2000) || 'Unknown error'}`,
						{ itemIndex },
					);
				}

				const out: INodeExecutionData = {
					json: {
						success: true,
						operation,
						outputPath: resolvedOutputPath,
						stdout,
						stderr,
					},
				};
				returnItems.push(out);
				try { if (typeof concatListForCleanup === 'string') { await fs.unlink(concatListForCleanup); } } catch {}
				if (Array.isArray(stitchTempsForCleanup) && stitchTempsForCleanup.length) {
					for (const p of stitchTempsForCleanup) { try { await fs.unlink(p); } catch {} }
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnItems.push({ json: { success: false }, error, pairedItem: itemIndex });
					continue;
				}
				if ((error as any).context) {
					(error as any).context.itemIndex = itemIndex;
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnItems];
	}
}

function replaceExtension(filePath: string, newExtensionWithDot: string): string {
	const parsed = path.parse(filePath);
	return path.join(parsed.dir, `${parsed.name}${newExtensionWithDot}`);
}

function deriveCombinedOutputPath(videoPath: string): string {
	const parsed = path.parse(videoPath);
	return path.join(parsed.dir, `${parsed.name}-combined.mp4`);
}

// deriveConcatOutputPath removed

function deriveOverlayOutputPath(baseVideoPath: string): string {
	const parsed = path.parse(baseVideoPath);
	return path.join(parsed.dir, `${parsed.name}-overlay${parsed.ext || '.mp4'}`);
}

function deriveWithSuffix(filePath: string, suffix: string): string {
	const parsed = path.parse(filePath);
	return path.join(parsed.dir, `${parsed.name}${suffix}${parsed.ext || '.mp4'}`);
}

function buildAtempoChain(factor: number): string {
	// FFmpeg atempo supports 0.5 to 2.0 per filter; chain to achieve arbitrary factor
	// Decompose factor into sequence within [0.5, 2]
	const parts: number[] = [];
	let remaining = factor;
	while (remaining > 2.0 + 1e-9) {
		parts.push(2.0);
		remaining /= 2.0;
	}
	while (remaining < 0.5 - 1e-9) {
		parts.push(0.5);
		remaining /= 0.5;
	}
	parts.push(remaining);
	const filters = parts.map((p) => `atempo=${p.toFixed(6)}`).join(',');
	return filters.length ? filters : 'anull';
}

async function assertFileReadable(filePath: string, ctx: IExecuteFunctions, itemIndex: number): Promise<void> {
	try {
		await fs.access(filePath);
	} catch {
		throw new NodeOperationError(ctx.getNode(), `Input file not accessible: ${filePath}` as any, { itemIndex });
	}
}

// createConcatListFile removed

function runFfmpeg(binaryPath: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>
{
	return new Promise((resolve, reject) => {
		try {
			const child = spawn(binaryPath, args, { windowsHide: true });
			let stdout = '';
			let stderr = '';
			child.stdout.on('data', (d) => (stdout += d.toString()));
			child.stderr.on('data', (d) => (stderr += d.toString()));
			child.on('error', (err: NodeJS.ErrnoException) => {
				if (err.code === 'ENOENT') {
					resolve({ exitCode: 127, stdout, stderr: 'ffmpeg not found in PATH or at provided path' });
					return;
				}
				reject(err);
			});
			child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
		} catch (err) {
			reject(err);
		}
	});
}


function runFfprobe(binaryPath: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>
{
	return new Promise((resolve, reject) => {
		try {
			const child = spawn(binaryPath, args, { windowsHide: true });
			let stdout = '';
			let stderr = '';
			child.stdout.on('data', (d) => (stdout += d.toString()));
			child.stderr.on('data', (d) => (stderr += d.toString()));
			child.on('error', (err: NodeJS.ErrnoException) => {
				if (err.code === 'ENOENT') {
					resolve({ exitCode: 127, stdout, stderr: 'ffprobe not found in PATH or at provided path' });
					return;
				}
				reject(err);
			});
			child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
		} catch (err) {
			reject(err);
		}
	});
}

function parseSilenceIntervals(stderr: string): Array<{ start: number; end: number; duration?: number }>
{
	const intervals: Array<{ start: number; end: number; duration?: number }> = [];
	let currentStart: number | undefined;
	const lines = stderr.split(/\r?\n/);
	for (const line of lines) {
		const mStart = line.match(/silence_start:\s*([0-9.]+)/);
		if (mStart) {
			currentStart = parseFloat(mStart[1]);
			continue;
		}
		const mEnd = line.match(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/);
		if (mEnd && currentStart !== undefined) {
			const end = parseFloat(mEnd[1]);
			const duration = parseFloat(mEnd[2]);
			intervals.push({ start: currentStart, end, duration });
			currentStart = undefined;
			continue;
		}
	}
	return intervals;
}

function parseBlackIntervals(stderr: string): Array<{ start: number; end: number; duration?: number }>
{
	const intervals: Array<{ start: number; end: number; duration?: number }> = [];
	let currentStart: number | undefined;
	const lines = stderr.split(/\r?\n/);
	for (const line of lines) {
		const mStart = line.match(/black_start:\s*([0-9.]+)/);
		if (mStart) {
			currentStart = parseFloat(mStart[1]);
			continue;
		}
		const mEnd = line.match(/black_end:\s*([0-9.]+)\s*\|\s*black_duration:\s*([0-9.]+)/);
		if (mEnd && currentStart !== undefined) {
			const end = parseFloat(mEnd[1]);
			const duration = parseFloat(mEnd[2]);
			intervals.push({ start: currentStart, end, duration });
			currentStart = undefined;
			continue;
		}
	}
	return intervals;
}

function parseVolumeDetect(stderr: string): { mean?: number; max?: number }
{
	let mean: number | undefined;
	let max: number | undefined;
	const lines = stderr.split(/\r?\n/);
	for (const line of lines) {
		const m1 = line.match(/mean_volume:\s*(-?[0-9.]+)\s*dB/);
		if (m1) mean = parseFloat(m1[1]);
		const m2 = line.match(/max_volume:\s*(-?[0-9.]+)\s*dB/);
		if (m2) max = parseFloat(m2[1]);
	}
	return { mean, max };
}


