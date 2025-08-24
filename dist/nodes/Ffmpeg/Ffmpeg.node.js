"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ffmpeg = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const FfmpegDescription_1 = require("./FfmpegDescription");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class Ffmpeg {
    constructor() {
        this.description = {
            displayName: 'FFmpeg',
            name: 'ffmpeg',
            group: ['transform'],
            version: 1,
            description: 'Run FFmpeg media operations',
            defaults: {
                name: 'FFmpeg',
            },
            inputs: ["main"],
            outputs: ["main"],
            usableAsTool: true,
            properties: [
                ...FfmpegDescription_1.ffmpegOperations,
                ...FfmpegDescription_1.ffmpegFields,
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnItems = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const ffmpegPath = this.getNodeParameter('ffmpegPath', itemIndex, 'ffmpeg') || 'ffmpeg';
                let args = [];
                let outputPath;
                if (operation === 'convert') {
                    const inputPath = this.getNodeParameter('inputPath', itemIndex);
                    const targetFormat = this.getNodeParameter('targetFormat', itemIndex);
                    const overwrite = this.getNodeParameter('overwrite', itemIndex, true);
                    const explicitOutput = this.getNodeParameter('outputPath', itemIndex, '') || '';
                    await assertFileReadable(inputPath, this, itemIndex);
                    outputPath = explicitOutput || replaceExtension(inputPath, `.${targetFormat}`);
                    args = [];
                    if (overwrite)
                        args.push('-y');
                    args.push('-i', inputPath);
                    args.push(outputPath);
                }
                else if (operation === 'combine') {
                    const videoPath = this.getNodeParameter('videoPath', itemIndex);
                    const audioPath = this.getNodeParameter('audioPath', itemIndex);
                    const copyVideo = this.getNodeParameter('copyVideo', itemIndex, true);
                    const audioCodec = this.getNodeParameter('audioCodec', itemIndex, 'aac');
                    const shortest = this.getNodeParameter('shortest', itemIndex, true);
                    const overwrite = this.getNodeParameter('overwrite', itemIndex, true);
                    const explicitOutput = this.getNodeParameter('outputPath', itemIndex, '') || '';
                    await assertFileReadable(videoPath, this, itemIndex);
                    await assertFileReadable(audioPath, this, itemIndex);
                    outputPath = explicitOutput || deriveCombinedOutputPath(videoPath);
                    args = [];
                    if (overwrite)
                        args.push('-y');
                    args.push('-i', videoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0');
                    if (copyVideo)
                        args.push('-c:v', 'copy');
                    args.push('-c:a', audioCodec);
                    if (shortest)
                        args.push('-shortest');
                    args.push(outputPath);
                }
                else {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
                }
                const { exitCode, stdout, stderr } = await runFfmpeg(ffmpegPath, args);
                if (exitCode !== 0) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `FFmpeg failed with code ${exitCode}: ${(stderr === null || stderr === void 0 ? void 0 : stderr.slice(0, 2000)) || 'Unknown error'}`, { itemIndex });
                }
                const out = {
                    json: {
                        success: true,
                        operation,
                        outputPath,
                        stdout,
                        stderr,
                    },
                };
                returnItems.push(out);
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnItems.push({ json: { success: false }, error, pairedItem: itemIndex });
                    continue;
                }
                if (error.context) {
                    error.context.itemIndex = itemIndex;
                    throw error;
                }
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [returnItems];
    }
}
exports.Ffmpeg = Ffmpeg;
function replaceExtension(filePath, newExtensionWithDot) {
    const parsed = path.parse(filePath);
    return path.join(parsed.dir, `${parsed.name}${newExtensionWithDot}`);
}
function deriveCombinedOutputPath(videoPath) {
    const parsed = path.parse(videoPath);
    return path.join(parsed.dir, `${parsed.name}-combined.mp4`);
}
async function assertFileReadable(filePath, ctx, itemIndex) {
    try {
        await fs.access(filePath);
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Input file not accessible: ${filePath}`, { itemIndex });
    }
}
function runFfmpeg(binaryPath, args) {
    return new Promise((resolve, reject) => {
        try {
            const child = (0, child_process_1.spawn)(binaryPath, args, { windowsHide: true });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => (stdout += d.toString()));
            child.stderr.on('data', (d) => (stderr += d.toString()));
            child.on('error', (err) => {
                if (err.code === 'ENOENT') {
                    resolve({ exitCode: 127, stdout, stderr: 'ffmpeg not found in PATH or at provided path' });
                    return;
                }
                reject(err);
            });
            child.on('close', (code) => resolve({ exitCode: code !== null && code !== void 0 ? code : -1, stdout, stderr }));
        }
        catch (err) {
            reject(err);
        }
    });
}
//# sourceMappingURL=Ffmpeg.node.js.map