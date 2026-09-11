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

const MEDIA_UPLOAD_META = {
  image: { name: 'photo.jpg', type: 'image/jpeg' },
  video: { name: 'video.mp4', type: 'video/mp4' },
  audio: { name: 'audio.m4a', type: 'audio/m4a' },
};

function toAbsoluteUrl(relativeUrl) {
  const baseUrl = String(API_BASE_URL || '').replace(/\/$/, '');
  return `${baseUrl}${relativeUrl}`;
}

// 上传媒体文件（图片 / 视频 / 音频）
export async function uploadMediaApi(fileUri, kind = 'image') {
  const meta = MEDIA_UPLOAD_META[kind] || MEDIA_UPLOAD_META.image;
  const token = await getStoredAuthToken();
  const url = `${API_BASE_URL}/api/upload`;

  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: meta.name,
    type: meta.type,
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
    throw new Error(payload.message || '文件上传失败');
  }

  const fileUrl = payload.data?.url;
  if (!fileUrl) {
    throw new Error('文件上传返回数据异常');
  }

  return toAbsoluteUrl(fileUrl);
}

// 上传图片文件（兼容旧调用）
export async function uploadImageApi(fileUri) {
  return uploadMediaApi(fileUri, 'image');
}

// 文本转语音
export async function synthesizeSpeechApi(text, options = {}) {
  const result = await requestJson({
    path: '/api/tts/synthesize',
    method: 'POST',
    body: { text, ...options },
  });

  if (!result.ok) {
    return { ok: false, message: result.message || '语音生成失败' };
  }

  const audioUrl = result.payload?.data?.audioUrl;
  if (!audioUrl) {
    return { ok: false, message: '语音生成返回数据异常' };
  }

  return { ok: true, audioUrl: toAbsoluteUrl(audioUrl) };
}

// ComfyUI生成图片
export async function generateComfyUIImage(prompt, options = {}) {
  return requestJson({
    path: '/api/comfyui/generate',
    method: 'POST',
    body: { prompt, ...options },
  });
}

// 清空聊天历史（服务端）
export async function clearChatHistoryApi() {
  return requestJson({
    path: '/api/chat/history',
    method: 'DELETE',
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
