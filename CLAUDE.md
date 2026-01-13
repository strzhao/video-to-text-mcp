# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Model Context Protocol (MCP) 的视频转文字服务器，能够从 YouTube、Bilibili 等平台下载视频，提取音频，并使用 OpenAI Whisper 进行语音识别。

## 开发命令

### 构建和运行
```bash
npm run build        # 编译 TypeScript 到 build/index.js
npm run dev          # 开发模式，监听文件变化
npm start            # 运行编译后的服务器
npm run debug        # 使用 MCP Inspector 调试服务器
npm test             # 运行测试（需要配置测试文件）
```

### 依赖安装
项目需要以下外部依赖（必须安装到系统 PATH）：
- **yt-dlp**: 视频下载工具 (`brew install yt-dlp` 或 `pip install yt-dlp`)
- **ffmpeg**: 音频处理工具 (`brew install ffmpeg`)
- **OpenAI Whisper**: 语音识别 (`pip install openai-whisper`)

## 架构说明

### 核心流程
1. **视频下载** (`downloadVideo` 函数): 使用 yt-dlp 下载视频
   - 针对 Bilibili 使用 `--cookies-from-browser chrome` 绕过反爬机制
   - 自动重命名下载的文件为 `video.mp4`
   - 在系统临时目录创建处理文件夹

2. **音频提取** (`extractAudio` 函数): 使用 ffmpeg 提取音频
   - 转换为 16kHz 单声道 WAV 格式
   - 输出为 `audio.wav`

3. **语音识别** (`transcribeAudio` 函数): 使用 Whisper 转录
   - 支持 txt、json、srt、vtt 四种输出格式
   - 可指定语言代码（如 'zh'、'en'）
   - 使用 tiny 模型（可通过环境变量 `WHISPER_MODEL` 修改）

### MCP 服务器结构
- **单一工具**: `video_to_text`
- **输入参数**: `url`（必需）、`outputFormat`（可选）、`language`（可选）
- **输出**: 转录文本预览 + 本地文件路径
- **错误处理**: 所有错误通过 stderr 输出，返回结构化错误信息

### 技术栈
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.20.2
- **类型系统**: TypeScript (ES2022, Node16 模块)
- **参数验证**: Zod
- **外部进程**: 通过 `child_process.spawn` 调用 yt-dlp、ffmpeg、whisper

## 重要配置

### TypeScript 配置 (`tsconfig.json`)
- 目标: ES2022，模块: Node16
- 输出目录: `./build`
- 严格模式启用，生成声明文件到 `build/types`

### 环境变量
- `WHISPER_MODEL`: 指定 Whisper 模型（tiny, base, small, medium, large），默认: base
- `TEMP_DIR`: 指定临时文件目录，默认: 系统临时目录

### 发布配置
- 包名: `@music/video-to-text-mcp`
- 私有注册表: `http://rnpm.hz.netease.com`
- 仅发布 `build` 目录

## 开发注意事项

### Bilibili 特殊处理
- 源代码中硬编码了 `--cookies-from-browser chrome` 参数
- 如需支持其他浏览器，需要修改 `src/index.ts` 中的 `downloadVideo` 函数
- 确保 Chrome 浏览器已登录 Bilibili 账号

### 临时文件管理
- 每个处理会话在系统临时目录创建独立文件夹（格式: `video-to-text-XXXXXX`）
- 处理完成后不自动清理临时文件
- 长时间运行可能积累大量临时文件

### 错误排查
- 所有处理日志输出到 stderr
- 常见错误：外部命令未安装、网络问题、磁盘空间不足
- 视频下载失败通常与平台反爬机制相关

### 测试文件
- 项目包含 Jest 配置但缺少实际测试文件
- 测试命令需要 `--experimental-vm-modules` 标志
- 可参考 `documents/test-case.md` 中的 Bilibili 视频 URL 进行测试