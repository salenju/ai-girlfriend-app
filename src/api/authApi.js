// src/api/authApi.js
// 认证相关接口：登录 / 注册 / 登出

import { requestJson } from "./client";

const AUTH_LOGIN_PATH = globalThis.__AUTH_LOGIN_PATH__ || "/auth/login";
const AUTH_REGISTER_PATH = globalThis.__AUTH_REGISTER_PATH__ || "/auth/register";
const AUTH_LOGOUT_PATH = globalThis.__AUTH_LOGOUT_PATH__ || "/auth/logout";

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
    path: AUTH_LOGIN_PATH,
    method: "POST",
    body: { username, password },
  });
}

export async function registerApi({ username, password }) {
  return requestJson({
    path: AUTH_REGISTER_PATH,
    method: "POST",
    body: { username, password },
  });
}

export async function logoutApi({ token }) {
  return requestJson({
    path: AUTH_LOGOUT_PATH,
    method: "POST",
    token,
  });
}
