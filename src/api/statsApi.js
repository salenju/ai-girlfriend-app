// src/api/statsApi.js
// 数据统计接口

import { requestJson } from './client';

export async function getStatsApi() {
  return requestJson({
    path: '/api/stats',
    method: 'GET',
  });
}
