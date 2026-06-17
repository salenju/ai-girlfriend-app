// src/api/chatApi.js
// 聊天相关接口：发送消息 / 上传文件

import { getStoredAuthToken, requestJson } from './client';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  globalThis.__API_BASE_URL__ ||
  globalThis.__AUTH_API_BASE_URL__ ||
  '';

// 发送消息
export async function sendChatApi(data) {
  return requestJson({
    path: '/api/chat/send',
    method: 'POST',
    body: data,
  });
}

// 上传图片文件
export async function uploadImageApi(fileUri) {
  const token = await getStoredAuthToken();
  const url = `${API_BASE_URL}/api/upload`;

  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '图片上传失败');
  }

  const fileUrl = payload.data?.url;
  if (!fileUrl) {
    throw new Error('图片上传返回数据异常');
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  return `${baseUrl}${fileUrl}`;
}

// ComfyUI生成图片
export async function generateComfyUIImage(prompt, options = {}) {
  return requestJson({
    path: '/api/comfyui/generate',
    method: 'POST',
    body: { prompt, ...options },
  });
}

// 根据消息生成图片
export async function generateFromMessage(message) {
  return requestJson({
    path: '/api/comfyui/generate-from-message',
    method: 'POST',
    body: { message },
  });
}

// 检查ComfyUI状态
export async function checkComfyUIStatus() {
  return requestJson({
    path: '/api/comfyui/status',
    method: 'GET',
  });
}
