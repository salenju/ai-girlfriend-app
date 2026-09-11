import { useEffect, useState } from 'react';
import { getCurrentUserApi, loginApi, registerApi } from '../api/authApi';
import { clearStoredAuthToken, getStoredAuthToken } from '../api/client';

function extractUser(payload, fallbackUsername = '') {
  const raw = payload?.user || payload?.data?.user || payload?.data || payload;

  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      username: fallbackUsername,
    };
  }

  return {
    id: String(raw.id || raw.userId || raw.uid || ''),
    username: String(raw.username || raw.name || fallbackUsername || ''),
    ...raw,
  };
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState('');

  // 冷启动时用已存 token 恢复会话
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = await getStoredAuthToken();
      if (!token) {
        return;
      }

      const result = await getCurrentUserApi();
      if (cancelled) {
        return;
      }

      if (result.ok) {
        setCurrentUser(extractUser(result.payload?.data?.user || result.payload?.data));
        setAuthToken(token);
      } else {
        await clearStoredAuthToken();
      }
    };

    restoreSession().catch(() => {
      // 会话恢复失败时保持未登录态
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const register = async ({ username, password }) => {
    const safeUsername = String(username || '').trim();

    if (!safeUsername || !password) {
      return { ok: false, message: '请填写完整用户名和密码' };
    }

    if (safeUsername.length < 3) {
      return { ok: false, message: '用户名至少 3 位' };
    }

    if (String(password).length < 6) {
      return { ok: false, message: '密码至少 6 位' };
    }

    try {
      const result = await registerApi({
        username: safeUsername,
        password,
      });

      if (!result.ok) {
        return {
          ok: false,
          message: result.message || '注册失败',
        };
      }

      const { token, user } = result.payload.data;

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
        message: error?.message || '注册请求失败',
      };
    }
  };

  const login = async ({ username, password }) => {
    const safeUsername = String(username || '').trim();

    if (!safeUsername || !password) {
      return { ok: false, message: '请填写完整用户名和密码' };
    }

    try {
      const result = await loginApi({
        username: safeUsername,
        password,
      });

      if (!result.ok) {
        return {
          ok: false,
          message: result.message || '登录失败',
        };
      }

      const { token, user } = result.payload.data;
      console.log('=====>登录成功', token, user);

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
        message: error?.message || '登录请求失败',
      };
    }
  };

  const logout = async () => {
    try {
      await clearStoredAuthToken();
    } catch {
      // 即使本地清理失败，也重置内存态
    } finally {
      setCurrentUser(null);
      setAuthToken('');
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
