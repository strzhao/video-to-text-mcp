# Video to Text MCP Server

一个基于 Model Context Protocol (MCP) 的服务器，用于下载视频、提取音频并将语音转换为文本。

## 功能

- 从 YouTube 或其他支持的平台下载视频（使用 yt-dlp）
- 提取音频并转换为适合语音识别的格式（使用 ffmpeg）
- 使用 OpenAI Whisper 将音频转换为文本
- 支持多种输出格式：纯文本 (.txt)、JSON (.json)、SRT (.srt)、VTT (.vtt)
- 返回转录文本的本地文件路径

## 前提条件

在使用此 MCP 服务器之前，需要安装以下依赖：

### 1. yt-dlp
用于下载视频的工具。

```bash
# macOS (使用 Homebrew)
brew install yt-dlp

# 其他平台
pip install yt-dlp
```

### 2. ffmpeg
用于音频提取和转换的工具。

```bash
# macOS (使用 Homebrew)
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# 其他平台请参考官方文档
```

### 3. OpenAI Whisper
用于语音转文本的 AI 模型。

```bash
pip install openai-whisper
```

Whisper 需要 Python 3.8 或更高版本。安装后，Whisper 会自动下载所需的模型文件（首次运行时会下载 base 模型）。

## 安装 MCP 服务器

1. 克隆或复制此项目到本地
2. 安装 Node.js 依赖：

```bash
cd video-to-text-mcp
npm install
npm run build
```

## 配置 MCP

在 Claude Desktop 或其他 MCP 客户端中配置此服务器：

### Claude Desktop 配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "video-to-text": {
      "command": "node",
      "args": ["/path/to/video-to-text-mcp/build/index.js"],
      "env": {
        "WHISPER_MODEL": "base"  // 可选：指定 Whisper 模型（tiny, base, small, medium, large）
      }
    }
  }
}
```

### 环境变量

- `WHISPER_MODEL`: 指定 Whisper 模型（默认：base）
- `TEMP_DIR`: 指定临时文件目录（默认：系统临时目录）

## 使用方法

MCP 服务器提供一个工具：`video_to_text`

### 参数

- `url` (必需): 视频的 URL（支持 YouTube、Bilibili 等 yt-dlp 支持的平台）
- `outputFormat` (可选): 输出格式，可选值：`txt`、`json`、`srt`、`vtt`（默认：`txt`）
- `language` (可选): 语言代码，例如 `en`（英语）、`zh`（中文）、`ja`（日语）等

### 示例调用

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "outputFormat": "txt",
  "language": "en"
}
```

### 响应

成功时返回：
- 转录文本的预览（前 500 个字符）
- 转录文件的完整本地路径

错误时返回详细的错误信息。

## 开发

### 构建项目

```bash
npm run build
```

### 开发模式（监听文件变化）

```bash
npm run dev
```

### 测试

```bash
npm test
```

### 调试 MCP

```bash
npm run debug
```

## 技术栈

- **MCP SDK**: `@modelcontextprotocol/sdk`
- **类型检查**: TypeScript
- **参数验证**: Zod
- **视频下载**: yt-dlp（通过子进程调用）
- **音频处理**: ffmpeg（通过子进程调用）
- **语音识别**: OpenAI Whisper（通过子进程调用）

## 注意事项

1. **临时文件**: 处理过程中会创建临时文件，处理完成后不会自动清理。临时文件存储在系统的临时目录中。
2. **网络依赖**: 需要网络连接以下载视频和 Whisper 模型（首次运行）。
3. **处理时间**: 视频下载和语音识别可能需要较长时间，取决于视频长度和系统性能。
4. **存储空间**: 需要足够的磁盘空间存储视频、音频和转录文件。

## 故障排除

### 常见问题

1. **"Command not found: yt-dlp"**
   - 确保 yt-dlp 已正确安装并在 PATH 中
   - 尝试运行 `which yt-dlp` 确认

2. **"Command not found: ffmpeg"**
   - 确保 ffmpeg 已正确安装并在 PATH 中
   - 尝试运行 `which ffmpeg` 确认

3. **"Command not found: whisper"**
   - 确保 OpenAI Whisper 已安装：`pip install openai-whisper`
   - 尝试运行 `whisper --help` 确认

4. **Whisper 模型下载失败**
   - 检查网络连接
   - 手动下载模型：`whisper --model base --language en example.mp3`

5. **内存不足**
   - 处理大型视频时可能需要大量内存
   - 考虑使用较小的 Whisper 模型（如 tiny 或 base）

### 日志

所有处理日志输出到 stderr，可以在 MCP 客户端中查看。

## 许可证

ISC