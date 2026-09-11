// src/api/authApi.js
// 认证相关接口：登录 / 注册 / 登出

import { requestJson } from './client';

export async function loginApi({ username, password }) {
  return requestJson({
    path: '/api/auth/login',
    method: 'POST',
    body: { account: username, password },
  });
}

export async function registerApi({ username, password }) {
  return requestJson({
    path: '/api/auth/register',
    method: 'POST',
    body: { username, password },
  });
}

export async function getCurrentUserApi() {
  return requestJson({
    path: '/api/auth/me',
    method: 'GET',
  });
}
