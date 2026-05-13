# Phase 2 Integration Guide

本文档说明当前聊天项目在 Phase 2 已完成的客户端改造内容，以及服务端联调所需的最小协议约定。

## 1. 已完成范围

本次已在客户端实现：
- WebSocket 实时收发
- 按 `seq` 的增量同步（断线补偿/冷启动补拉）

主要改动文件：
- `src/hooks/useChat.js`

---

## 2. 客户端改造总览

## 2.1 新增运行时配置

在 `useChat` 中增加了两个全局配置入口：
- `globalThis.__CHAT_WS_URL__`：WebSocket 地址
- `globalThis.__CHAT_SYNC_HTTP_URL__`：HTTP 同步地址（增量拉取 + 发送兜底）

示例：
- WS: `wss://your-domain/chat/ws`
- HTTP: `https://your-domain/chat`

> 若未配置：
> - WS 不会连接
> - HTTP 同步不会执行
> - 发送会退回本地 mock 发送逻辑（仅开发兜底）

## 2.2 新增能力点

1. **实时连接与重连**
   - 连接成功后发送 `chat:join`
   - 断线自动指数退避重连

2. **WS 请求-应答发送链路**
   - 发送消息时优先走 WS（`message:send`）
   - 使用 `requestId` 关联 `message:ack`
   - 超时自动失败，走本地失败重试策略

3. **增量同步（按 seq）**
   - 维护本地 `lastSeq`
   - 冷启动先拉一次增量
   - 定时轮询 `/sync?afterSeq=...` 做补偿同步

4. **远端消息落本地存储**
   - 远端消息统一写入本地 SQLite
   - 写入 `meta.seq` / `meta.serverId`
   - UI 排序优先 `seq`，其次时间

---

## 3. 数据流（简化）

## 3.1 发送消息

1. 用户发送 -> 先写本地消息（Phase1 逻辑）
2. 出队发送：
   - 优先 WS `message:send`
   - 无 WS 时走 HTTP `/send`
   - 都不可用时走本地 mock（仅开发兜底）
3. 收到 ACK 后：
   - 更新本地消息状态为 sent
   - 记录 `serverId`、`seq`

## 3.2 接收消息

1. WS 收到 `message:new` / `chat:message` 等事件
2. 归一化后写入本地库（防重复）
3. 刷新消息列表

## 3.3 断线补偿

1. 基于本地最大 `seq` 记录为 `lastSeq`
2. 定时请求 `/sync?afterSeq=lastSeq`
3. 将返回消息批量落本地，推进 `lastSeq`

---

## 4. 服务端最小协议约定

## 4.1 WebSocket

### 客户端 -> 服务端

1. 加入会话
```json
{
  "type": "chat:join",
  "conversationId": "direct-u1-bot-1",
  "userId": "u1",
  "afterSeq": 120
}
```

2. 发送消息（请求-应答）
```json
{
  "type": "message:send",
  "requestId": "wsreq-xxx",
  "conversationId": "direct-u1-bot-1",
  "userId": "u1",
  "data": {
    "clientId": "msg-xxx",
    "type": "text",
    "text": "hello",
    "senderId": "u1",
    "createdAtClient": "2026-05-13T12:00:00.000Z",
    "meta": {}
  }
}
```

### 服务端 -> 客户端

1. 发送确认
```json
{
  "type": "message:ack",
  "requestId": "wsreq-xxx",
  "payload": {
    "serverId": "s-1001",
    "seq": 121,
    "createdAtServer": "2026-05-13T12:00:01.000Z"
  }
}
```

2. 新消息推送（支持以下任一事件名）
- `message:new`
- `chat:message`
- `message`
- `sync:message`

消息对象建议字段：
- `id` / `serverId`
- `clientId`（可选）
- `conversationId`
- `senderId`
- `type`（text/image/audio/video）
- `text`（文本或媒体结构化内容）
- `seq`（必需，增量同步核心）
- `createdAtServer`

## 4.2 HTTP

1. 增量同步
- `GET /sync?conversationId=<id>&afterSeq=<number>`
- 返回格式支持：
  - `[{...}, {...}]`
  - `{ "messages": [...] }`
  - `{ "items": [...] }`
  - `{ "data": [...] }`

2. 发送兜底
- `POST /send`
- 请求体：与 `message:send` 的 `data` 基本一致
- 响应：至少包含 `serverId`、`seq`、`createdAtServer`

---

## 5. 联调检查清单

1. 配置已注入
- [ ] `__CHAT_WS_URL__`
- [ ] `__CHAT_SYNC_HTTP_URL__`

2. WS 可用
- [ ] 连接成功
- [ ] `chat:join` 被服务端接收
- [ ] `message:send` 有 `message:ack`

3. 增量同步可用
- [ ] `/sync` 能返回 `seq > afterSeq` 的消息
- [ ] 断网重连后可补齐缺失消息

4. 幂等与去重
- [ ] 同一 `clientId` 不会重复落库
- [ ] 同一 `seq` 不会重复展示

---

## 6. 当前限制与后续建议

当前实现是“可联调版本”，建议后续继续完善：

1. 将配置改为正式环境变量方案（dev/staging/prod）
2. 在本地存储层增加 `seq` 独立列与索引（而不是先放在 `meta`）
3. 对 WS 心跳、鉴权 token 刷新做标准化处理
4. 补充消息撤回/编辑事件处理
5. 增加同步失败监控与埋点

---

## 7. 结论

当前客户端已具备 Phase 2 两项核心能力：
- 实时收发（WebSocket）
- 基于 `seq` 的增量补偿同步

后端只需按本指南的最小协议对齐，即可完成端到端联调。

