// src/api/girlfriendApi.js
// AI 女友配置相关接口

import { requestJson } from './client';

export async function getGirlfriendApi() {
  return requestJson({
    path: '/api/girlfriend',
    method: 'GET',
  });
}

export async function updateGirlfriendApi(data) {
  return requestJson({
    path: '/api/girlfriend',
    method: 'PUT',
    body: data,
  });
}

export async function resetGirlfriendApi() {
  return requestJson({
    path: '/api/girlfriend/reset',
    method: 'POST',
  });
}
