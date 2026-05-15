// src/api/authApi.js
// 认证相关接口：登录 / 注册 / 登出

import { requestJson } from "./client";

export function extractUser(payload, fallbackUsername = "") {
  const raw = payload?.user || payload?.data?.user || payload?.data || payload;

  if (!raw || typeof raw !== "object") {
    return {
      id: "",
      username: fallbackUsername,
    };
  }

  return {
    id: String(raw.id || raw.userId || raw.uid || ""),
    username: String(raw.username || raw.name || fallbackUsername || ""),
    ...raw,
  };
}

export function extractToken(payload) {
  return (
    payload?.token ||
    payload?.accessToken ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    ""
  );
}

export async function loginApi({ username, password }) {
  return requestJson({
    path: "/auth/login",
    method: "POST",
    body: { username, password },
  });
}

export async function registerApi({ username, password }) {
  return requestJson({
    path: "/auth/register",
    method: "POST",
    body: { username, password },
  });
}

export async function logoutApi({ token }) {
  return requestJson({
    path: "/auth/logout",
    method: "POST",
    token,
  });
}
