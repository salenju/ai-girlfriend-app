import * as SQLite from 'expo-sqlite';

const DB_NAME = 'phase1_local_chat.db';

export const MESSAGE_STATUS = Object.freeze({
  PENDING: 'pending',
  SENDING: 'sending',
  FAILED: 'failed',
  SENT: 'sent',
});

export const OUTBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  SENDING: 'sending',
  FAILED: 'failed',
  SENT: 'sent',
});

const RETRY_DEFAULTS = Object.freeze({
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  maxRetries: 5,
});

let dbPromise = null;
let initialized = false;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function genClientId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function clampUnread(value) {
  return Math.max(0, Number(value || 0));
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

async function runInTx(work) {
  const db = await getDb();
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = await work(db);
    await db.execAsync('COMMIT;');
    return result;
  } catch (error) {
    try {
      await db.execAsync('ROLLBACK;');
    } catch {
      // ignore rollback errors
    }
    throw error;
  }
}

const INIT_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  last_message_text TEXT,
  last_message_type TEXT,
  last_message_sender_id TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  server_id TEXT,
  sender_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at_client TEXT NOT NULL,
  created_at_server TEXT,
  error_message TEXT,
  meta_json TEXT,
  UNIQUE (conversation_id, client_id)
);

CREATE TABLE IF NOT EXISTS outbox_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TEXT,
  locked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (conversation_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
ON messages(conversation_id, created_at_client DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conv_client
ON messages(conversation_id, client_id);

CREATE INDEX IF NOT EXISTS idx_outbox_status_retry_created
ON outbox_queue(status, next_retry_at, created_at);
`;

function normalizeConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    lastMessageText: row.last_message_text,
    lastMessageType: row.last_message_type,
    lastMessageSenderId: row.last_message_sender_id,
    unreadCount: clampUnread(row.unread_count),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function normalizeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    clientId: row.client_id,
    serverId: row.server_id,
    senderId: row.sender_id,
    type: row.type,
    text: row.text,
    status: row.status,
    createdAtClient: row.created_at_client,
    createdAtServer: row.created_at_server,
    errorMessage: row.error_message,
    meta: safeJsonParse(row.meta_json, {}),
  };
}

function normalizeOutbox(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    clientId: row.client_id,
    status: row.status,
    retryCount: Number(row.retry_count || 0),
    maxRetries: Number(row.max_retries || RETRY_DEFAULTS.maxRetries),
    nextRetryAt: row.next_retry_at,
    lockedAt: row.locked_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload: safeJsonParse(row.payload_json, {}),
  };
}

function computeRetryAt(retryCount, baseDelayMs, maxDelayMs) {
  const delay = Math.min(baseDelayMs * 2 ** Math.max(0, retryCount), maxDelayMs);
  return new Date(Date.now() + delay).toISOString();
}

export async function initLocalChatStorage() {
  if (initialized) return;
  const db = await getDb();
  await db.execAsync(INIT_SQL);
  initialized = true;
  await recoverStuckSendingTasks();
}

export async function recoverStuckSendingTasks() {
  const db = await getDb();
  const now = nowIso();
  await db.runAsync(
    `UPDATE outbox_queue
     SET status = $failed,
         next_retry_at = COALESCE(next_retry_at, $now),
         updated_at = $now
     WHERE status = $sending`,
    {
      $failed: OUTBOX_STATUS.FAILED,
      $sending: OUTBOX_STATUS.SENDING,
      $now: now,
    }
  );
}

export async function upsertConversationSummary({
  conversationId,
  title = null,
  lastMessageText = null,
  lastMessageType = 'text',
  lastMessageSenderId = null,
  unreadDelta = 0,
  resetUnread = false,
  at = nowIso(),
}) {
  if (!conversationId) throw new Error('conversationId is required');
  await initLocalChatStorage();

  const db = await getDb();
  await db.runAsync(
    `INSERT INTO conversations (
      id, title, last_message_text, last_message_type, last_message_sender_id,
      unread_count, updated_at, created_at
    ) VALUES (
      $id, $title, $lastMessageText, $lastMessageType, $lastMessageSenderId,
      $unreadCount, $at, $at
    )
    ON CONFLICT(id) DO UPDATE SET
      title = COALESCE(excluded.title, conversations.title),
      last_message_text = COALESCE(excluded.last_message_text, conversations.last_message_text),
      last_message_type = COALESCE(excluded.last_message_type, conversations.last_message_type),
      last_message_sender_id = COALESCE(excluded.last_message_sender_id, conversations.last_message_sender_id),
      unread_count = CASE
        WHEN $resetUnread = 1 THEN 0
        ELSE MAX(0, conversations.unread_count + $unreadDelta)
      END,
      updated_at = excluded.updated_at`,
    {
      $id: conversationId,
      $title: title,
      $lastMessageText: lastMessageText,
      $lastMessageType: lastMessageType,
      $lastMessageSenderId: lastMessageSenderId,
      $unreadCount: clampUnread(unreadDelta),
      $at: at,
      $unreadDelta: Number(unreadDelta || 0),
      $resetUnread: resetUnread ? 1 : 0,
    }
  );
}

export async function listConversations({ limit = 50, offset = 0 } = {}) {
  await initLocalChatStorage();
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM conversations
     ORDER BY updated_at DESC
     LIMIT $limit OFFSET $offset`,
    {
      $limit: Number(limit),
      $offset: Number(offset),
    }
  );
  return rows.map(normalizeConversation);
}

export async function getConversationById(conversationId) {
  await initLocalChatStorage();
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT * FROM conversations WHERE id = $id LIMIT 1`, {
    $id: conversationId,
  });
  return normalizeConversation(row);
}

export async function listMessagesByConversation(
  conversationId,
  { limit = 50, before = null } = {}
) {
  if (!conversationId) throw new Error('conversationId is required');
  await initLocalChatStorage();
  const db = await getDb();

  const sql = before
    ? `SELECT * FROM messages
       WHERE conversation_id = $conversationId
         AND created_at_client < $before
       ORDER BY created_at_client DESC
       LIMIT $limit`
    : `SELECT * FROM messages
       WHERE conversation_id = $conversationId
       ORDER BY created_at_client DESC
       LIMIT $limit`;

  const params = before
    ? {
        $conversationId: conversationId,
        $before: before,
        $limit: Number(limit),
      }
    : {
        $conversationId: conversationId,
        $limit: Number(limit),
      };

  const rows = await db.getAllAsync(sql, params);
  return rows.reverse().map(normalizeMessage);
}

export async function setConversationRead(conversationId, at = nowIso()) {
  if (!conversationId) throw new Error('conversationId is required');
  await initLocalChatStorage();
  const db = await getDb();
  await db.runAsync(
    `UPDATE conversations
     SET unread_count = 0,
         updated_at = CASE WHEN updated_at > $at THEN updated_at ELSE $at END
     WHERE id = $id`,
    {
      $id: conversationId,
      $at: at,
    }
  );
}

export async function enqueueLocalMessage({
  conversationId,
  senderId,
  text,
  messageType = 'text',
  previewText = null,
  clientId = genClientId('msg'),
  createdAtClient = nowIso(),
  maxRetries = RETRY_DEFAULTS.maxRetries,
  unreadDelta = 0,
  meta = {},
}) {
  if (!conversationId) throw new Error('conversationId is required');
  if (!senderId) throw new Error('senderId is required');
  if (!text?.trim()) throw new Error('text is required');

  await initLocalChatStorage();

  const payload = {
    type: messageType,
    conversationId,
    clientId,
    senderId,
    text: text.trim(),
    createdAtClient,
    meta,
  };

  await runInTx(async db => {
    await db.runAsync(
      `INSERT INTO messages (
        conversation_id, client_id, sender_id, type, text, status, created_at_client, meta_json
      ) VALUES (
        $conversationId, $clientId, $senderId, $type, $text, $status, $createdAtClient, $metaJson
      )
      ON CONFLICT(conversation_id, client_id) DO UPDATE SET
        type = excluded.type,
        text = excluded.text,
        status = excluded.status,
        error_message = NULL,
        meta_json = excluded.meta_json`,
      {
        $conversationId: conversationId,
        $clientId: clientId,
        $senderId: senderId,
        $type: messageType,
        $text: payload.text,
        $status: MESSAGE_STATUS.PENDING,
        $createdAtClient: createdAtClient,
        $metaJson: JSON.stringify({ localOnly: true, ...meta }),
      }
    );

    const now = nowIso();
    await db.runAsync(
      `INSERT INTO outbox_queue (
        conversation_id, client_id, payload_json, status, retry_count, max_retries,
        next_retry_at, created_at, updated_at
      ) VALUES (
        $conversationId, $clientId, $payloadJson, $status, 0, $maxRetries,
        NULL, $now, $now
      )
      ON CONFLICT(conversation_id, client_id) DO UPDATE SET
        payload_json = excluded.payload_json,
        status = $pending,
        updated_at = $now,
        next_retry_at = NULL,
        last_error = NULL`,
      {
        $conversationId: conversationId,
        $clientId: clientId,
        $payloadJson: JSON.stringify(payload),
        $status: OUTBOX_STATUS.PENDING,
        $pending: OUTBOX_STATUS.PENDING,
        $maxRetries: Number(maxRetries || RETRY_DEFAULTS.maxRetries),
        $now: now,
      }
    );

    const summaryText =
      previewText ??
      (messageType === 'image'
        ? '[图片]'
        : messageType === 'audio'
          ? '[语音]'
          : messageType === 'video'
            ? '[视频]'
            : payload.text);

    await db.runAsync(
      `INSERT INTO conversations (
        id, last_message_text, last_message_type, last_message_sender_id,
        unread_count, updated_at, created_at
      ) VALUES (
        $id, $lastMessageText, $lastMessageType, $lastMessageSenderId,
        $unreadCount, $updatedAt, $updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        last_message_text = excluded.last_message_text,
        last_message_type = excluded.last_message_type,
        last_message_sender_id = excluded.last_message_sender_id,
        unread_count = MAX(0, conversations.unread_count + $unreadDelta),
        updated_at = excluded.updated_at`,
      {
        $id: conversationId,
        $lastMessageText: summaryText,
        $lastMessageType: messageType,
        $lastMessageSenderId: senderId,
        $unreadCount: clampUnread(unreadDelta),
        $unreadDelta: Number(unreadDelta || 0),
        $updatedAt: createdAtClient,
      }
    );
  });

  return payload;
}

export async function enqueueTextMessage({
  conversationId,
  senderId,
  text,
  clientId,
  createdAtClient,
  maxRetries,
  unreadDelta = 0,
}) {
  return enqueueLocalMessage({
    conversationId,
    senderId,
    text,
    messageType: 'text',
    previewText: text,
    clientId,
    createdAtClient,
    maxRetries,
    unreadDelta,
  });
}

export async function claimSendableOutbox({ limit = 20, now = nowIso() } = {}) {
  await initLocalChatStorage();
  const db = await getDb();

  const candidates = await db.getAllAsync(
    `SELECT *
     FROM outbox_queue
     WHERE status IN ($pending, $failed)
       AND (next_retry_at IS NULL OR next_retry_at <= $now)
     ORDER BY created_at ASC
     LIMIT $limit`,
    {
      $pending: OUTBOX_STATUS.PENDING,
      $failed: OUTBOX_STATUS.FAILED,
      $now: now,
      $limit: Number(limit),
    }
  );

  if (!candidates.length) return [];

  const locked = [];
  for (const item of candidates) {
    await db.runAsync(
      `UPDATE outbox_queue
       SET status = $sending,
           locked_at = $now,
           updated_at = $now
       WHERE id = $id
         AND status IN ($pending, $failed)`,
      {
        $id: item.id,
        $sending: OUTBOX_STATUS.SENDING,
        $pending: OUTBOX_STATUS.PENDING,
        $failed: OUTBOX_STATUS.FAILED,
        $now: now,
      }
    );

    const row = await db.getFirstAsync(
      `SELECT * FROM outbox_queue WHERE id = $id AND status = $sending LIMIT 1`,
      {
        $id: item.id,
        $sending: OUTBOX_STATUS.SENDING,
      }
    );

    if (row) locked.push(normalizeOutbox(row));
  }

  return locked;
}

export async function markOutboxSent({
  outboxId,
  conversationId,
  clientId,
  serverId = null,
  createdAtServer = null,
}) {
  if (!outboxId && (!conversationId || !clientId)) {
    throw new Error('outboxId or (conversationId + clientId) is required');
  }

  await initLocalChatStorage();
  const now = nowIso();

  await runInTx(async db => {
    if (outboxId) {
      await db.runAsync(
        `UPDATE outbox_queue
         SET status = $sent,
             updated_at = $now,
             locked_at = NULL,
             last_error = NULL
         WHERE id = $id`,
        {
          $id: outboxId,
          $sent: OUTBOX_STATUS.SENT,
          $now: now,
        }
      );
    } else {
      await db.runAsync(
        `UPDATE outbox_queue
         SET status = $sent,
             updated_at = $now,
             locked_at = NULL,
             last_error = NULL
         WHERE conversation_id = $conversationId
           AND client_id = $clientId`,
        {
          $conversationId: conversationId,
          $clientId: clientId,
          $sent: OUTBOX_STATUS.SENT,
          $now: now,
        }
      );
    }

    await db.runAsync(
      `UPDATE messages
       SET status = $sent,
           server_id = COALESCE($serverId, server_id),
           created_at_server = COALESCE($createdAtServer, created_at_server),
           error_message = NULL
       WHERE conversation_id = $conversationId
         AND client_id = $clientId`,
      {
        $conversationId: conversationId,
        $clientId: clientId,
        $sent: MESSAGE_STATUS.SENT,
        $serverId: serverId,
        $createdAtServer: createdAtServer,
      }
    );
  });
}

export async function markOutboxFailed({
  outboxId,
  conversationId,
  clientId,
  errorMessage,
  baseDelayMs = RETRY_DEFAULTS.baseDelayMs,
  maxDelayMs = RETRY_DEFAULTS.maxDelayMs,
}) {
  if (!outboxId && (!conversationId || !clientId)) {
    throw new Error('outboxId or (conversationId + clientId) is required');
  }

  await initLocalChatStorage();
  const db = await getDb();

  const row = outboxId
    ? await db.getFirstAsync(`SELECT * FROM outbox_queue WHERE id = $id LIMIT 1`, {
        $id: outboxId,
      })
    : await db.getFirstAsync(
        `SELECT *
         FROM outbox_queue
         WHERE conversation_id = $conversationId
           AND client_id = $clientId
         LIMIT 1`,
        {
          $conversationId: conversationId,
          $clientId: clientId,
        }
      );

  if (!row) return;

  const nextRetryCount = Number(row.retry_count || 0) + 1;
  const nextRetryAt = computeRetryAt(nextRetryCount, baseDelayMs, maxDelayMs);
  const now = nowIso();
  const message = String(errorMessage || 'unknown send error');

  await runInTx(async txDb => {
    await txDb.runAsync(
      `UPDATE outbox_queue
       SET status = $failed,
           retry_count = $retryCount,
           next_retry_at = $nextRetryAt,
           updated_at = $now,
           locked_at = NULL,
           last_error = $lastError
       WHERE id = $id`,
      {
        $id: row.id,
        $failed: OUTBOX_STATUS.FAILED,
        $retryCount: nextRetryCount,
        $nextRetryAt: nextRetryAt,
        $now: now,
        $lastError: message,
      }
    );

    await txDb.runAsync(
      `UPDATE messages
       SET status = $failed,
           error_message = $errorMessage
       WHERE conversation_id = $conversationId
         AND client_id = $clientId`,
      {
        $conversationId: row.conversation_id,
        $clientId: row.client_id,
        $failed: MESSAGE_STATUS.FAILED,
        $errorMessage: message,
      }
    );
  });
}

export async function flushOutboxQueue({
  sendTask,
  batchSize = 20,
  now = nowIso(),
  onProgress,
} = {}) {
  if (typeof sendTask !== 'function') {
    throw new Error('sendTask must be a function');
  }

  const tasks = await claimSendableOutbox({ limit: batchSize, now });
  const results = [];

  for (const task of tasks) {
    try {
      const sendResult = await sendTask(task);
      await markOutboxSent({
        outboxId: task.id,
        conversationId: task.conversationId,
        clientId: task.clientId,
        serverId: sendResult?.serverId ?? null,
        createdAtServer: sendResult?.createdAtServer ?? null,
      });

      const success = {
        outboxId: task.id,
        ok: true,
        result: sendResult ?? null,
      };
      results.push(success);
      if (onProgress) onProgress(success, task);
    } catch (error) {
      const failureMessage = error?.message || String(error);
      await markOutboxFailed({
        outboxId: task.id,
        conversationId: task.conversationId,
        clientId: task.clientId,
        errorMessage: failureMessage,
      });

      const failure = {
        outboxId: task.id,
        ok: false,
        error: failureMessage,
      };
      results.push(failure);
      if (onProgress) onProgress(failure, task);
    }
  }

  return {
    processed: results.length,
    success: results.filter(x => x.ok).length,
    failed: results.filter(x => !x.ok).length,
    results,
  };
}

export async function getOutboxState({
  statuses = [OUTBOX_STATUS.PENDING, OUTBOX_STATUS.SENDING, OUTBOX_STATUS.FAILED],
  limit = 100,
} = {}) {
  await initLocalChatStorage();
  const db = await getDb();

  const placeholders = statuses.map((_, index) => `$status${index}`).join(', ');

  const params = { $limit: Number(limit) };
  statuses.forEach((status, index) => {
    params[`$status${index}`] = status;
  });

  const rows = await db.getAllAsync(
    `SELECT * FROM outbox_queue
     WHERE status IN (${placeholders})
     ORDER BY created_at ASC
     LIMIT $limit`,
    params
  );

  return rows.map(normalizeOutbox);
}

export async function resetChatStorageForDevOnly() {
  const db = await getDb();
  await db.execAsync(`
    DROP TABLE IF EXISTS outbox_queue;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS conversations;
  `);
  initialized = false;
  await initLocalChatStorage();
}
