# Expo最佳实践

在 Expo / React Native 里，最佳实践通常是：

## 推荐分层（从 UI 到网络）
1.screens/components
只负责展示和交互，不直接写 fetch。

2.hooks（如 useAuth）
负责状态管理（loading、error、currentUser），调用业务方法。

3.api/services 目录
统一放接口请求（真正发 HTTP 的地方）。

4.config/env
放 baseURL、超时、环境配置（dev/staging/prod）。
你可以这样组织目录
```
src/
  api/
    client.js          // fetch/axios 实例、请求拦截、统一错误处理
    authApi.js         // login/register/logout
    chatApi.js         // 聊天相关接口
  hooks/
    useAuth.js         // 调 authApi，管登录态
    useChat.js
  constants/
    endpoints.js       // 接口路径常量（可选）
  utils/
    storage.js         // token 持久化等（SecureStore/AsyncStorage）
```
**具体建议（Expo 场景）**
- 强烈建议把接口从 useAuth 抽到 src/api/authApi.js
  - hook 不应该关心 URL 拼接、headers、response 解析细节。
- token 存储建议
  - 优先 expo-secure-store（比 AsyncStorage 更适合 token）。
- baseURL 管理建议
  - 使用 app.config.js + expo-constants 或全局注入方式统一管理。
- 统一错误处理
  - 在 api/client.js 里做 response.ok 检查和 message 归一化，hook 只处理业务结果。
