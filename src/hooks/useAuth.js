import { useState } from "react";

function createId(prefix = "user") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function useAuth() {
  const [users, setUsers] = useState([
    { id: "u-1", username: "demo", password: "123456" },
    { id: "u-2", username: "salen", password: "738551" },
  ]);
  const [currentUser, setCurrentUser] = useState(null);

  const register = ({ username, password }) => {
    const safeUsername = username.trim();

    if (!safeUsername || !password) {
      return { ok: false, message: "请填写完整用户名和密码" };
    }

    if (safeUsername.length < 2) {
      return { ok: false, message: "用户名至少 2 位" };
    }

    if (password.length < 6) {
      return { ok: false, message: "密码至少 6 位" };
    }

    const exists = users.some((item) => item.username === safeUsername);
    if (exists) {
      return { ok: false, message: "该用户名已存在，请直接登录" };
    }

    const newUser = {
      id: createId(),
      username: safeUsername,
      password,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);

    return { ok: true, user: newUser };
  };

  const login = ({ username, password }) => {
    const safeUsername = username.trim();
    const found = users.find(
      (item) => item.username === safeUsername && item.password === password,
    );

    if (!found) {
      return { ok: false, message: "用户名或密码不正确" };
    }

    setCurrentUser(found);
    return { ok: true, user: found };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return {
    currentUser,
    register,
    login,
    logout,
  };
}
