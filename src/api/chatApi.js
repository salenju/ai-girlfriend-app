// src/api/authApi.js
// 认证相关接口：登录 / 注册 / 登出

import { requestJson } from './client';

// 发送消息
export async function sendChatApi(data) {
  return requestJson({
    path: '/api/chat/send',
    method: 'POST',
    body: data,
  });
}
