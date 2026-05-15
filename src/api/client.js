// src/api/client.js
// 通用 API 客户端（Expo / React Native）

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  globalThis.__API_BASE_URL__ ||
  globalThis.__AUTH_API_BASE_URL__ ||
  "";

const API_TIMEOUT_MS = Number(
  process.env.EXPO_PUBLIC_API_TIMEOUT_MS || globalThis.__API_TIMEOUT_MS__ || 12000,
);

function buildUrl(path) {
  const safeBase = String(API_BASE_URL || "").replace(/\/$/, "");
  const safePath = String(path || "").startsWith("/") ? path : `/${path}`;

  if (!safeBase) {
    throw new Error(
      "未配置 API 地址：请设置 EXPO_PUBLIC_API_BASE_URL（或 globalThis.__API_BASE_URL__）",
    );
  }

  return `${safeBase}${safePath}`;
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function parsePayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : {};
}

function normalizeErrorMessage(payload, status) {
  return payload?.message || payload?.error || `请求失败（HTTP ${status}）`;
}

/**
 * requestJson
 * @param {Object} options
 * @param {string} options.path - 接口路径，如 /auth/login
 * @param {string} [options.method] - HTTP 方法
 * @param {Object} [options.body] - JSON 请求体
 * @param {string} [options.token] - Bearer Token
 * @param {Object} [options.headers] - 额外 Header
 * @param {number} [options.timeoutMs] - 超时时间
 */
export async function requestJson({
  path,
  method = "GET",
  body,
  token,
  headers = {},
  timeoutMs = API_TIMEOUT_MS,
}) {
  const timeout = withTimeout(Number(timeoutMs) > 0 ? Number(timeoutMs) : API_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: timeout.signal,
    });

    const payload = await parsePayload(response);

    if (!response.ok) {
      return {
        ok: false,
        message: normalizeErrorMessage(payload, response.status),
        payload,
        status: response.status,
      };
    }

    return {
      ok: true,
      payload,
      status: response.status,
    };
  } catch (error) {
    const isAbort = error?.name === "AbortError";

    return {
      ok: false,
      message: isAbort ? "请求超时，请稍后重试" : error?.message || "网络请求失败",
      payload: null,
      status: 0,
    };
  } finally {
    timeout.clear();
  }
}
