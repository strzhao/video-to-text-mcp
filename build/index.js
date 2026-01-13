#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join, dirname, basename } from "path";
import { mkdtemp, readFile, rename, readdir } from "fs/promises";
// Define schemas for tool arguments
const videoToTextSchema = z.object({
    url: z.string().url("Please provide a valid video URL"),
    outputFormat: z.enum(["txt", "json", "srt", "vtt"]).default("txt"),
    language: z.string().optional().describe("Language code for transcription (e.g., 'en', 'zh')"),
});
const voiceToTextSchema = z.object({
    url: z.string().url("Please provide a valid audio URL"),
    outputFormat: z.enum(["txt", "json", "srt", "vtt"]).default("txt"),
    language: z.string().optional().describe("Language code for transcription (e.g., 'en', 'zh')"),
});
// Create MCP server
const server = new McpServer({
    name: "video-to-text-mcp",
    version: "1.0.0",
});
// Register the main tool
server.registerTool("video_to_text", {
    description: "Download a video from URL, extract audio, transcribe to text, and save locally",
    inputSchema: videoToTextSchema.shape,
}, async (args) => {
    try {
        const { url, outputFormat, language } = videoToTextSchema.parse(args);
        // Create temporary directory for processing
        const tempDir = await mkdtemp(join(tmpdir(), "video-to-text-"));
        console.error(`Created temporary directory: ${tempDir}`);
        // Step 1: Download video using yt-dlp
        console.error(`Downloading video from: ${url}`);
        const videoPath = join(tempDir, "video.mp4");
        await downloadVideo(url, videoPath);
        console.error(`Video downloaded to: ${videoPath}`);
        // Step 2: Extract audio from video
        console.error(`Extracting audio from video...`);
        const audioPath = join(tempDir, "audio.wav");
        await extractAudio(videoPath, audioPath);
        console.error(`Audio extracted to: ${audioPath}`);
        // Step 3: Transcribe audio using Whisper
        console.error(`Transcribing audio to text...`);
        const transcriptionPath = join(tempDir, `transcription.${outputFormat}`);
        await transcribeAudio(audioPath, transcriptionPath, outputFormat, language);
        console.error(`Transcription saved to: ${transcriptionPath}`);
        // Step 4: Read transcription content
        const transcriptionContent = await readFile(transcriptionPath, "utf-8");
        return {
            content: [
                {
                    type: "text",
                    text: `Video transcription completed successfully.\n\nTranscription saved to: ${transcriptionPath}\n\nContent preview:\n${transcriptionContent.substring(0, 500)}${transcriptionContent.length > 500 ? '...' : ''}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Error processing video: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
// Register the voice to text tool
server.registerTool("voice_to_text", {
    description: "Download an audio file from URL and transcribe to text",
    inputSchema: voiceToTextSchema.shape,
}, async (args) => {
    try {
        const { url, outputFormat, language } = voiceToTextSchema.parse(args);
        // Create temporary directory for processing
        const tempDir = await mkdtemp(join(tmpdir(), "voice-to-text-"));
        console.error(`Created temporary directory: ${tempDir}`);
        // Step 1: Download audio using yt-dlp
        console.error(`Downloading audio from: ${url}`);
        const audioPath = join(tempDir, "audio.wav");
        await downloadAudio(url, audioPath);
        console.error(`Audio downloaded to: ${audioPath}`);
        // Step 2: Transcribe audio using Whisper
        console.error(`Transcribing audio to text...`);
        const transcriptionPath = join(tempDir, `transcription.${outputFormat}`);
        await transcribeAudio(audioPath, transcriptionPath, outputFormat, language);
        console.error(`Transcription saved to: ${transcriptionPath}`);
        // Step 3: Read transcription content
        const transcriptionContent = await readFile(transcriptionPath, "utf-8");
        return {
            content: [
                {
                    type: "text",
                    text: `Audio transcription completed successfully.\n\nTranscription saved to: ${transcriptionPath}\n\nContent preview:\n${transcriptionContent.substring(0, 500)}${transcriptionContent.length > 500 ? '...' : ''}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Error processing audio: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
/**
 * Download video using yt-dlp
 */
async function downloadVideo(url, outputPath) {
    return new Promise((resolve, reject) => {
        const outputDir = dirname(outputPath);
        const targetFileName = basename(outputPath);
        // 使用接近用户手动执行的简单参数
        // 用户手动执行: yt-dlp "https://www.bilibili.com/video/BV1QMrhBkE8r/"
        // 尝试使用浏览器cookies绕过B站反爬
        const args = [
            "--no-warnings", // 减少警告输出
            "--no-progress", // 不显示进度条
            // 尝试从浏览器获取cookies
            "--cookies-from-browser", "chrome",
            url, // 视频URL
        ];
        // 注意：用户手动执行没有指定-f参数，使用默认格式选择
        // yt-dlp会自动选择最佳格式并在当前目录生成文件
        console.error(`Downloading video to directory: ${outputDir}`);
        console.error(`Target filename: ${targetFileName}`);
        const ytDlp = spawn("yt-dlp", args, {
            cwd: outputDir, // 在工作目录中执行，让yt-dlp在当前目录生成文件
        });
        let stderr = "";
        ytDlp.stderr.on("data", (data) => {
            stderr += data.toString();
            console.error(`yt-dlp stderr: ${data.toString().trim()}`);
        });
        ytDlp.on("close", async (code) => {
            if (code === 0) {
                try {
                    // yt-dlp 成功，现在查找生成的视频文件
                    const files = await readdir(outputDir);
                    const videoFiles = files.filter(file => file.endsWith('.mp4') && !file.includes('.f') && !file.includes('_temp'));
                    if (videoFiles.length === 0) {
                        // 如果没有找到.mp4文件，尝试查找其他视频文件
                        const allVideoFiles = files.filter(file => file.endsWith('.mp4') || file.endsWith('.mkv') || file.endsWith('.webm'));
                        if (allVideoFiles.length === 0) {
                            reject(new Error(`yt-dlp succeeded but no video file found in ${outputDir}. Files: ${files.join(', ')}`));
                            return;
                        }
                        // 使用第一个找到的视频文件
                        const generatedFile = allVideoFiles[0];
                        const generatedPath = join(outputDir, generatedFile);
                        if (generatedFile !== targetFileName) {
                            await rename(generatedPath, outputPath);
                            console.error(`Renamed video file from ${generatedFile} to ${targetFileName}`);
                        }
                    }
                    else {
                        // 使用第一个找到的.mp4文件
                        const generatedFile = videoFiles[0];
                        const generatedPath = join(outputDir, generatedFile);
                        if (generatedFile !== targetFileName) {
                            await rename(generatedPath, outputPath);
                            console.error(`Renamed video file from ${generatedFile} to ${targetFileName}`);
                        }
                    }
                    resolve();
                }
                catch (error) {
                    reject(new Error(`Failed to process downloaded video: ${error instanceof Error ? error.message : String(error)}`));
                }
            }
            else {
                reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
            }
        });
        ytDlp.on("error", (error) => {
            reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
        });
    });
}
/**
 * Download audio using yt-dlp
 */
async function downloadAudio(url, outputPath) {
    return new Promise((resolve, reject) => {
        const outputDir = dirname(outputPath);
        const targetFileName = basename(outputPath);
        // 使用 yt-dlp 下载音频，转换为 WAV 格式
        const args = [
            "--no-warnings",
            "--no-progress",
            "--extract-audio", // 只提取音频
            "--audio-format", "wav", // 转换为 WAV 格式确保兼容性
            url,
        ];
        console.error(`Downloading audio to directory: ${outputDir}`);
        console.error(`Target filename: ${targetFileName}`);
        const ytDlp = spawn("yt-dlp", args, {
            cwd: outputDir,
        });
        let stderr = "";
        ytDlp.stderr.on("data", (data) => {
            stderr += data.toString();
            console.error(`yt-dlp stderr: ${data.toString().trim()}`);
        });
        ytDlp.on("close", async (code) => {
            if (code === 0) {
                try {
                    // yt-dlp 成功，现在查找生成的音频文件
                    const files = await readdir(outputDir);
                    const audioFiles = files.filter(file => file.endsWith('.wav') && !file.includes('.f') && !file.includes('_temp'));
                    if (audioFiles.length === 0) {
                        // 如果没有找到 .wav 文件，尝试查找其他音频文件
                        const allAudioFiles = files.filter(file => file.endsWith('.wav') || file.endsWith('.mp3') || file.endsWith('.m4a') || file.endsWith('.ogg'));
                        if (allAudioFiles.length === 0) {
                            reject(new Error(`yt-dlp succeeded but no audio file found in ${outputDir}. Files: ${files.join(', ')}`));
                            return;
                        }
                        // 使用第一个找到的音频文件
                        const generatedFile = allAudioFiles[0];
                        const generatedPath = join(outputDir, generatedFile);
                        if (generatedFile !== targetFileName) {
                            await rename(generatedPath, outputPath);
                            console.error(`Renamed audio file from ${generatedFile} to ${targetFileName}`);
                        }
                    }
                    else {
                        // 使用第一个找到的 .wav 文件
                        const generatedFile = audioFiles[0];
                        const generatedPath = join(outputDir, generatedFile);
                        if (generatedFile !== targetFileName) {
                            await rename(generatedPath, outputPath);
                            console.error(`Renamed audio file from ${generatedFile} to ${targetFileName}`);
                        }
                    }
                    resolve();
                }
                catch (error) {
                    reject(new Error(`Failed to process downloaded audio: ${error instanceof Error ? error.message : String(error)}`));
                }
            }
            else {
                reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
            }
        });
        ytDlp.on("error", (error) => {
            reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
        });
    });
}
/**
 * Extract audio from video using ffmpeg
 */
async function extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
            "-i", videoPath,
            "-vn", // No video
            "-acodec", "pcm_s16le", // WAV format
            "-ar", "16000", // Sample rate
            "-ac", "1", // Mono
            audioPath,
            "-y", // Overwrite output file
        ]);
        let stderr = "";
        ffmpeg.stderr.on("data", (data) => {
            stderr += data.toString();
            console.error(`ffmpeg stderr: ${data.toString().trim()}`);
        });
        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
            }
        });
        ffmpeg.on("error", (error) => {
            reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
        });
    });
}
/**
 * Transcribe audio using Whisper
 */
async function transcribeAudio(audioPath, outputPath, format, language) {
    return new Promise((resolve, reject) => {
        const outputDir = dirname(outputPath);
        const audioFileName = basename(audioPath, '.wav');
        const expectedWhisperOutput = join(outputDir, `${audioFileName}.${format}`);
        const args = [
            audioPath,
            "--output_format", format,
            "--output_dir", outputDir,
            "--model", "tiny",
        ];
        if (language) {
            args.push("--language", language);
        }
        const whisper = spawn("whisper", args);
        let stderr = "";
        whisper.stderr.on("data", (data) => {
            stderr += data.toString();
            console.error(`whisper stderr: ${data.toString().trim()}`);
        });
        whisper.on("close", async (code) => {
            if (code === 0) {
                try {
                    // Check if whisper generated the expected file
                    try {
                        await readFile(expectedWhisperOutput, 'utf-8');
                        // If the file exists and is different from our desired output path, rename it
                        if (expectedWhisperOutput !== outputPath) {
                            await rename(expectedWhisperOutput, outputPath);
                            console.error(`Renamed whisper output from ${expectedWhisperOutput} to ${outputPath}`);
                        }
                        resolve();
                    }
                    catch (error) {
                        reject(new Error(`Whisper succeeded but output file not found at ${expectedWhisperOutput}. Whisper stderr: ${stderr}`));
                    }
                }
                catch (error) {
                    reject(new Error(`Failed to process whisper output: ${error instanceof Error ? error.message : String(error)}`));
                }
            }
            else {
                reject(new Error(`whisper failed with code ${code}: ${stderr}`));
            }
        });
        whisper.on("error", (error) => {
            reject(new Error(`Failed to spawn whisper: ${error.message}. Make sure whisper is installed: pip install openai-whisper`));
        });
    });
}
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Video to Text MCP server started");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
