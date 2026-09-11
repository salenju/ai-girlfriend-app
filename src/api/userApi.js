// src/api/userApi.js
// 用户资料相关接口：获取/更新资料、修改密码

import { requestJson } from './client';

export async function getUserInfoApi() {
  return requestJson({
    path: '/api/user/info',
    method: 'GET',
  });
}

export async function updateUserInfoApi(data) {
  return requestJson({
    path: '/api/user/info',
    method: 'PUT',
    body: data,
  });
}

export async function changePasswordApi({ oldPassword, newPassword }) {
  return requestJson({
    path: '/api/user/password',
    method: 'PUT',
    body: { oldPassword, newPassword },
  });
}
