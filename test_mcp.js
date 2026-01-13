#!/usr/bin/env node

import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';

// 创建 MCP 服务器进程
const server = spawn('node', ['build/index.js']);

// 收集输出
let stdoutData = '';
let stderrData = '';

server.stdout.on('data', (data) => {
  const str = data.toString();
  stdoutData += str;
  console.log(`STDOUT: ${str}`);
});

server.stderr.on('data', (data) => {
  const str = data.toString();
  stderrData += str;
  console.error(`STDERR: ${str}`);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// 发送 JSON-RPC 消息的辅助函数
function sendMessage(message) {
  const json = JSON.stringify(message);
  console.log(`Sending: ${json}`);
  server.stdin.write(json + '\n');
}

// 接收消息的缓冲区
let buffer = '';
server.stdout.on('data', (data) => {
  buffer += data.toString();
  // 按换行符分割消息
  const lines = buffer.split('\n');
  buffer = lines.pop(); // 保留未完成的行

  for (const line of lines) {
    if (line.trim() === '') continue;
    try {
      const message = JSON.parse(line);
      console.log(`Received: ${JSON.stringify(message, null, 2)}`);
      handleMessage(message);
    } catch (err) {
      console.error(`Failed to parse message: ${line}`, err);
    }
  }
});

// 消息处理器
let initialized = false;

function handleMessage(message) {
  // 忽略通知（没有 id）
  if (!message.id) return;

  // 根据 id 处理响应
  if (message.id === 'initialize') {
    console.log('Server initialized');
    initialized = true;
    // 请求工具列表
    sendMessage({
      jsonrpc: '2.0',
      id: 'list_tools',
      method: 'tools/list',
      params: {}
    });
  } else if (message.id === 'list_tools') {
    console.log('Tools listed:', JSON.stringify(message.result, null, 2));
    // 调用 video_to_text 工具
    const toolCallId = 'call_tool_1';
    sendMessage({
      jsonrpc: '2.0',
      id: toolCallId,
      method: 'tools/call',
      params: {
        name: 'video_to_text',
        arguments: {
          url: 'https://www.bilibili.com/video/BV1QMrhBkE8r/',
          outputFormat: 'txt',
          language: 'zh'
        }
      }
    });
  } else if (message.id === 'call_tool_1') {
    console.log('Tool call result:', JSON.stringify(message.result, null, 2));
    if (message.error) {
      console.error('Tool call error:', JSON.stringify(message.error, null, 2));
    }
    // 退出服务器
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 1000);
  }
}

// 发送初始化请求
setTimeout(() => {
  sendMessage({
    jsonrpc: '2.0',
    id: 'initialize',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  });
}, 1000);

// 设置超时
setTimeout(() => {
  console.error('Timeout reached');
  server.kill();
  process.exit(1);
}, 30000);