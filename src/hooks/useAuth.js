import { useState } from "react";
import {
  extractToken,
  extractUser,
  loginApi,
  logoutApi,
  registerApi,
} from "../api/authApi";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState("");

  const register = async ({ username, password }) => {
    const safeUsername = String(username || "").trim();

    if (!safeUsername || !password) {
      return { ok: false, message: "请填写完整用户名和密码" };
    }

    if (safeUsername.length < 2) {
      return { ok: false, message: "用户名至少 2 位" };
    }

    if (String(password).length < 6) {
      return { ok: false, message: "密码至少 6 位" };
    }

    try {
      const result = await registerApi({
        username: safeUsername,
        password,
      });

      if (!result.ok) {
        return {
          ok: false,
          message: result.message || "注册失败",
        };
      }

      const user = extractUser(result.payload, safeUsername);
      const token = extractToken(result.payload);

      setCurrentUser(user);
      setAuthToken(token);

      return {
        ok: true,
        user,
        token,
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "注册请求失败",
      };
    }
  };

  const login = async ({ username, password }) => {
    const safeUsername = String(username || "").trim();

    if (!safeUsername || !password) {
      return { ok: false, message: "请填写完整用户名和密码" };
    }

    try {
      const result = await loginApi({
        username: safeUsername,
        password,
      });

      if (!result.ok) {
        return {
          ok: false,
          message: result.message || "登录失败",
        };
      }

      const user = extractUser(result.payload, safeUsername);
      const token = extractToken(result.payload);

      setCurrentUser(user);
      setAuthToken(token);

      return {
        ok: true,
        user,
        token,
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "登录请求失败",
      };
    }
  };

  const logout = async () => {
    try {
      await logoutApi({ token: authToken });
    } catch {
      // 即使登出接口失败，也清理本地态
    } finally {
      setCurrentUser(null);
      setAuthToken("");
    }
  };

  return {
    currentUser,
    authToken,
    register,
    login,
    logout,
  };
}
