# Phase 1 接入说明与验证清单

本文对应本地模块：`src/services/chat/localChatStorage.js`。

## 1. 目标

把当前内存消息流（`src/hooks/useChat.js`）切换为“本地优先”：

- 发送文本先落本地 SQLite
- 通过 outbox 队列异步发送
- 失败后指数退避重试
- 会话页可读 last message / unread / updated_at

## 2. 依赖准备

当前模块依赖 `expo-sqlite`。

安装命令：

```bash
pnpm add expo-sqlite
```

> 如使用 `npx expo install` 也可以：
> `npx expo install expo-sqlite`

## 3. useChat 最小接入步骤

建议先只接“文本消息链路”，图片/语音继续沿用现有逻辑。

### 步骤 A：初始化本地库

在 `useChat` 初始化时调用：

- `initLocalChatStorage()`
- 首次读取 `listMessagesByConversation(conversationId)` 回填 `messages`

### 步骤 B：替换 sendText

把当前 `pushMessage(...)` 直接写内存改为：

1. 调用 `enqueueTextMessage({ conversationId, senderId, text, unreadDelta: 0 })`
2. 再调用 `listMessagesByConversation` 刷新当前会话消息
3. 清空输入框

### 步骤 C：增加队列轮询

在 `useChat` 里加一个定时器（如 2~3 秒）：

1. 调用 `flushOutboxQueue({ sendTask })`
2. `sendTask` 里先写本地 mock（可随机失败用于压测重试）
3. 每次 flush 后按需刷新当前会话消息

### 步骤 D：页面卸载清理

在 `cleanupMedia` 之外，补充清理队列轮询定时器，避免重复 flush。

## 4. sendTask 约定

`flushOutboxQueue` 会把任务对象传给 `sendTask(task)`。

任务内关键字段：

- `task.id`：outbox 任务 ID
- `task.conversationId`
- `task.clientId`
- `task.payload`：消息 payload（文本链路）

成功返回建议：

```js
{
  serverId: "server-msg-xxx",      // 可选
  createdAtServer: new Date().toISOString() // 可选
}
```

抛出异常即视为失败，会自动调用 `markOutboxFailed` 并进入指数退避。

## 5. 验证清单（手工）

### 5.1 持久化验证

- [ ] 发送 3 条文本消息，强制关闭 App 再打开
- [ ] 当前会话消息仍可读取
- [ ] 顺序正确（按创建时间）

### 5.2 会话索引验证

- [ ] `listConversations()` 可看到会话记录
- [ ] `lastMessageText` 为最新文本
- [ ] `updatedAt` 随新消息更新
- [ ] `unreadCount` 逻辑符合预期（当前会话通常为 0）

### 5.3 失败重试验证

- [ ] `sendTask` 人为抛错，消息状态变 `failed`
- [ ] outbox 任务出现 `nextRetryAt`
- [ ] 到达重试时间后可再次被 claim/flush
- [ ] 恢复成功后消息状态变 `sent`

### 5.4 幂等验证

- [ ] 同一 `conversationId + clientId` 重复入队不会产生重复消息
- [ ] queue 与 message 表均保持唯一约束

## 6. 调试建议

可临时在开发环境暴露以下调试调用：

- `getOutboxState()`：查看 pending/sending/failed
- `listMessagesByConversation(conversationId)`：查看状态流转
- `resetChatStorageForDevOnly()`：清库重测

## 7. Phase 1 完成标准（落地版）

当以下条件同时满足，可标记 Phase 1 完成：

1. 文本消息走 SQLite 持久化，重启不丢
2. 会话列表可读取 last message + unread + updated_at
3. 发送失败能自动重试，并可最终转 sent
4. `useChat` 已切换文本链路到本地仓储 + outbox
