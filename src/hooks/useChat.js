import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  enqueueLocalMessage,
  flushOutboxQueue,
  initLocalChatStorage,
  listMessagesByConversation,
  markOutboxSent,
} from '../services/chat/localChatStorage';

export const BOT_USER = {
  id: 'bot-1',
  username: '小微',
};

const OUTBOX_POLL_INTERVAL_MS = 2500;
const MESSAGE_PAGE_SIZE = 200;
const MEDIA_PAYLOAD_PREFIX = '__LOCAL_MEDIA__:';

// Phase 2: realtime + seq incremental sync configs
// 可通过全局变量注入：globalThis.__CHAT_WS_URL__ / globalThis.__CHAT_SYNC_HTTP_URL__
const CHAT_WS_URL = globalThis.__CHAT_WS_URL__ || '';
const CHAT_SYNC_HTTP_URL = globalThis.__CHAT_SYNC_HTTP_URL__ || '';
const SYNC_PULL_INTERVAL_MS = 12_000;
const WS_RECONNECT_BASE_MS = 1200;
const WS_RECONNECT_MAX_MS = 10_000;
const WS_REQUEST_TIMEOUT_MS = 12_000;

function createId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function buildConversationId(userId) {
  return `direct-${userId}-${BOT_USER.id}`;
}

function sortBySeqThenTime(list) {
  return [...list].sort((a, b) => {
    const leftSeq = Number.isFinite(Number(a.seq)) ? Number(a.seq) : null;
    const rightSeq = Number.isFinite(Number(b.seq)) ? Number(b.seq) : null;

    if (leftSeq !== null && rightSeq !== null && leftSeq !== rightSeq) {
      return leftSeq - rightSeq;
    }

    const left = new Date(a.createdAt || 0).getTime();
    const right = new Date(b.createdAt || 0).getTime();
    return left - right;
  });
}

function serializeMediaPayload(payload) {
  return `${MEDIA_PAYLOAD_PREFIX}${JSON.stringify(payload)}`;
}

function parseMediaPayload(text) {
  if (typeof text !== 'string' || !text.startsWith(MEDIA_PAYLOAD_PREFIX)) {
    return null;
  }

  try {
    const raw = text.slice(MEDIA_PAYLOAD_PREFIX.length);
    const parsed = JSON.parse(raw);

    if (parsed?.type === 'image' && parsed?.imageUri) {
      return {
        type: 'image',
        imageUri: parsed.imageUri,
      };
    }

    if (parsed?.type === 'audio' && parsed?.audioUri) {
      return {
        type: 'audio',
        audioUri: parsed.audioUri,
        durationMillis: Number(parsed.durationMillis || 0),
      };
    }

    if (parsed?.type === 'video' && parsed?.videoUri) {
      return {
        type: 'video',
        videoUri: parsed.videoUri,
        durationMillis: Number(parsed.durationMillis || 0),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function mapStoredRowToUi(row) {
  const media = parseMediaPayload(row.text || '');
  const seq = Number(row?.meta?.seq);

  const base = {
    id: row.clientId || String(row.id),
    senderId: row.senderId,
    createdAt: row.createdAtServer || row.createdAtClient,
    status: row.status,
    seq: Number.isFinite(seq) ? seq : null,
    serverId: row.serverId || row?.meta?.serverId || null,
  };

  if (media?.type === 'image') {
    return {
      ...base,
      type: 'image',
      imageUri: media.imageUri,
    };
  }

  if (media?.type === 'audio') {
    return {
      ...base,
      type: 'audio',
      audioUri: media.audioUri,
      durationMillis: media.durationMillis,
    };
  }

  if (media?.type === 'video') {
    return {
      ...base,
      type: 'video',
      videoUri: media.videoUri,
      durationMillis: media.durationMillis,
    };
  }

  return {
    ...base,
    type: 'text',
    text: row.text || '',
  };
}

function createBotWelcomeMessage(username) {
  return {
    id: createId('welcome'),
    type: 'text',
    text: `欢迎你，${username}！现在可以开始聊天了。`,
    senderId: BOT_USER.id,
    createdAt: new Date().toISOString(),
    __volatile: true,
  };
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTaskMock(task) {
  await delay(150);
  const text = task?.payload?.text || '';
  if (typeof text === 'string' && text.includes('#fail')) {
    throw new Error('模拟发送失败：命中 #fail 标记');
  }

  return {
    serverId: `server-${task.clientId}`,
    createdAtServer: new Date().toISOString(),
  };
}

function normalizeRemoteMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;

  const serverId = msg.serverId || msg.id || null;
  const clientId =
    msg.clientId ||
    (serverId
      ? `srv-${serverId}`
      : Number.isFinite(Number(msg.seq))
        ? `seq-${msg.seq}`
        : createId('remote'));

  const type = msg.type || 'text';
  const senderId = msg.senderId || BOT_USER.id;
  const seq = Number(msg.seq);
  const createdAt = msg.createdAtServer || msg.createdAt || new Date().toISOString();

  let text = '';
  let previewText = '';

  if (type === 'image') {
    const imageUri = msg.imageUri || msg.url || msg.remoteUrl || '';
    text = serializeMediaPayload({ type: 'image', imageUri });
    previewText = '[图片]';
  } else if (type === 'audio') {
    const audioUri = msg.audioUri || msg.url || msg.remoteUrl || '';
    text = serializeMediaPayload({
      type: 'audio',
      audioUri,
      durationMillis: Number(msg.durationMillis || 0),
    });
    previewText = '[语音]';
  } else if (type === 'video') {
    const videoUri = msg.videoUri || msg.url || msg.remoteUrl || '';
    text = serializeMediaPayload({
      type: 'video',
      videoUri,
      durationMillis: Number(msg.durationMillis || 0),
    });
    previewText = '[视频]';
  } else {
    text = String(msg.text || '');
    previewText = text;
  }

  if (!text?.trim()) return null;

  return {
    serverId,
    clientId,
    type,
    senderId,
    seq: Number.isFinite(seq) ? seq : null,
    text,
    previewText,
    createdAt,
  };
}

function parseSyncMessagesPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.messages)) return payload.messages;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export function useChat(currentUser) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);

  const soundRef = useRef(null);
  const flushTimerRef = useRef(null);
  const syncTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const isFlushingRef = useRef(false);
  const isSyncingRef = useRef(false);
  const conversationIdRef = useRef(null);
  const lastSeqRef = useRef(0);

  const wsRef = useRef(null);
  const wsReconnectAttemptRef = useRef(0);
  const isWsConnectedRef = useRef(false);
  const pendingWsRequestsRef = useRef(new Map());

  const pushMessage = message => {
    setMessages(prev => sortBySeqThenTime([...prev, message]));

    const seq = Number(message?.seq);
    if (Number.isFinite(seq)) {
      lastSeqRef.current = Math.max(lastSeqRef.current, seq);
    }
  };

  const syncMessagesFromStorage = async () => {
    const conversationId = conversationIdRef.current;
    if (!conversationId) {
      return 0;
    }

    const stored = await listMessagesByConversation(conversationId, {
      limit: MESSAGE_PAGE_SIZE,
    });
    const persistentMessages = stored.map(mapStoredRowToUi);

    let nextMaxSeq = 0;
    for (const item of persistentMessages) {
      const seq = Number(item?.seq);
      if (Number.isFinite(seq)) {
        nextMaxSeq = Math.max(nextMaxSeq, seq);
      }
    }
    lastSeqRef.current = nextMaxSeq;

    setMessages(prev => {
      const volatileMessages = prev.filter(item => item.__volatile === true);
      return sortBySeqThenTime([...persistentMessages, ...volatileMessages]);
    });

    return persistentMessages.length;
  };

  const persistRemoteMessage = async rawMessage => {
    const normalized = normalizeRemoteMessage(rawMessage);
    const conversationId = conversationIdRef.current;

    if (!normalized || !conversationId) return false;

    const unreadDelta = normalized.senderId === currentUser?.id ? 0 : 1;

    await enqueueLocalMessage({
      conversationId,
      senderId: normalized.senderId,
      text: normalized.text,
      messageType: normalized.type,
      previewText: normalized.previewText,
      clientId: normalized.clientId,
      createdAtClient: normalized.createdAt,
      unreadDelta,
      meta: {
        localOnly: false,
        remote: true,
        seq: normalized.seq,
        serverId: normalized.serverId,
      },
    });

    await markOutboxSent({
      conversationId,
      clientId: normalized.clientId,
      serverId: normalized.serverId,
      createdAtServer: normalized.createdAt,
    });

    if (Number.isFinite(Number(normalized.seq))) {
      lastSeqRef.current = Math.max(lastSeqRef.current, Number(normalized.seq));
    }

    return true;
  };

  const handleRealtimeEvent = async event => {
    if (!event || typeof event !== 'object') return;

    const type = event.type || event.event || '';

    // RPC acks
    if ((type === 'message:ack' || type === 'ack') && event.requestId) {
      const pending = pendingWsRequestsRef.current.get(event.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingWsRequestsRef.current.delete(event.requestId);
        pending.resolve(event.payload || event.data || {});
      }
      return;
    }

    if ((type === 'error' || type === 'message:error') && event.requestId) {
      const pending = pendingWsRequestsRef.current.get(event.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingWsRequestsRef.current.delete(event.requestId);
        pending.reject(new Error(event.message || 'ws request failed'));
      }
      return;
    }

    // realtime message push
    if (
      type === 'message:new' ||
      type === 'chat:message' ||
      type === 'message' ||
      type === 'sync:message'
    ) {
      const payload = event.payload || event.data || event.message || event;
      const list = Array.isArray(payload) ? payload : [payload];

      let changed = false;
      for (const item of list) {
        const ok = await persistRemoteMessage(item);
        changed = changed || ok;
      }

      if (changed) {
        await syncMessagesFromStorage();
      }
      return;
    }

    // server can proactively push a sync batch
    if (type === 'sync:batch' || type === 'sync:result') {
      const list = parseSyncMessagesPayload(event.payload || event.data || {});
      let changed = false;
      for (const item of list) {
        const ok = await persistRemoteMessage(item);
        changed = changed || ok;
      }
      if (changed) {
        await syncMessagesFromStorage();
      }
    }
  };

  const wsRequest = async payload => {
    const ws = wsRef.current;
    const conversationId = conversationIdRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN || !conversationId) {
      throw new Error('ws not ready');
    }

    const requestId = createId('wsreq');

    const requestBody = {
      requestId,
      conversationId,
      userId: currentUser?.id,
      ...payload,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingWsRequestsRef.current.delete(requestId);
        reject(new Error('ws request timeout'));
      }, WS_REQUEST_TIMEOUT_MS);

      pendingWsRequestsRef.current.set(requestId, { resolve, reject, timer });

      try {
        ws.send(JSON.stringify(requestBody));
      } catch (error) {
        clearTimeout(timer);
        pendingWsRequestsRef.current.delete(requestId);
        reject(error);
      }
    });
  };

  const sendTaskRemoteFirst = async task => {
    const payload = task?.payload || {};

    if (isWsConnectedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      const ack = await wsRequest({
        type: 'message:send',
        data: {
          clientId: task.clientId,
          type: payload.type || 'text',
          text: payload.text,
          senderId: payload.senderId,
          createdAtClient: payload.createdAtClient,
          meta: payload.meta || {},
        },
      });

      return {
        serverId: ack.serverId || ack.id || null,
        seq: Number.isFinite(Number(ack.seq)) ? Number(ack.seq) : null,
        createdAtServer: ack.createdAtServer || ack.createdAt || new Date().toISOString(),
      };
    }

    if (CHAT_SYNC_HTTP_URL) {
      const response = await fetch(`${CHAT_SYNC_HTTP_URL.replace(/\/$/, '')}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: task.conversationId,
          userId: currentUser?.id,
          clientId: task.clientId,
          type: payload.type || 'text',
          text: payload.text,
          senderId: payload.senderId,
          createdAtClient: payload.createdAtClient,
          meta: payload.meta || {},
        }),
      });

      if (!response.ok) {
        throw new Error(`send failed: ${response.status}`);
      }

      const ack = await response.json();
      return {
        serverId: ack.serverId || ack.id || null,
        seq: Number.isFinite(Number(ack.seq)) ? Number(ack.seq) : null,
        createdAtServer: ack.createdAtServer || ack.createdAt || new Date().toISOString(),
      };
    }

    // fallback for local dev without remote
    return sendTaskMock(task);
  };

  const flushOutboxOnce = async () => {
    if (isFlushingRef.current || !conversationIdRef.current) {
      return;
    }

    isFlushingRef.current = true;
    try {
      const summary = await flushOutboxQueue({
        sendTask: sendTaskRemoteFirst,
        batchSize: 20,
        onProgress: async (result, task) => {
          if (!result?.ok || !result?.result) return;

          const ack = result.result;
          const seq = Number(ack.seq);
          if (!Number.isFinite(seq)) return;

          // 将 seq 写入本地（借助同 clientId 的 upsert），再标记 sent，保证后续按 seq 增量同步可用
          await enqueueLocalMessage({
            conversationId: task.conversationId,
            senderId: task.payload?.senderId || currentUser?.id || BOT_USER.id,
            text: task.payload?.text || '',
            messageType: task.payload?.type || 'text',
            previewText: null,
            clientId: task.clientId,
            createdAtClient: task.payload?.createdAtClient || new Date().toISOString(),
            unreadDelta: 0,
            meta: {
              ...(task.payload?.meta || {}),
              localOnly: false,
              seq,
              serverId: ack.serverId || null,
            },
          });

          await markOutboxSent({
            conversationId: task.conversationId,
            clientId: task.clientId,
            serverId: ack.serverId || null,
            createdAtServer: ack.createdAtServer || new Date().toISOString(),
          });

          lastSeqRef.current = Math.max(lastSeqRef.current, seq);
        },
      });

      if (summary.processed > 0) {
        await syncMessagesFromStorage();
      }
    } finally {
      isFlushingRef.current = false;
    }
  };

  const pullIncrementalBySeq = async () => {
    if (isSyncingRef.current || !conversationIdRef.current || !CHAT_SYNC_HTTP_URL) {
      return;
    }

    isSyncingRef.current = true;
    try {
      const base = CHAT_SYNC_HTTP_URL.replace(/\/$/, '');
      const url = `${base}/sync?conversationId=${encodeURIComponent(
        conversationIdRef.current
      )}&afterSeq=${encodeURIComponent(String(lastSeqRef.current || 0))}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`sync failed: ${response.status}`);
      }

      const payload = await response.json();
      const list = parseSyncMessagesPayload(payload);

      if (!list.length) return;

      let changed = false;
      for (const item of list) {
        const ok = await persistRemoteMessage(item);
        changed = changed || ok;
      }

      if (changed) {
        await syncMessagesFromStorage();
      }
    } finally {
      isSyncingRef.current = false;
    }
  };

  const clearPendingWsRequests = () => {
    const pendingEntries = [...pendingWsRequestsRef.current.entries()];
    for (const [, pending] of pendingEntries) {
      clearTimeout(pending.timer);
      pending.reject(new Error('ws disconnected'));
    }
    pendingWsRequestsRef.current.clear();
  };

  const closeSocket = () => {
    clearPendingWsRequests();

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    isWsConnectedRef.current = false;
  };

  const scheduleWsReconnect = () => {
    if (!CHAT_WS_URL || !conversationIdRef.current) return;
    if (reconnectTimerRef.current) return;

    wsReconnectAttemptRef.current += 1;
    const delayMs = Math.min(
      WS_RECONNECT_BASE_MS * 2 ** (wsReconnectAttemptRef.current - 1),
      WS_RECONNECT_MAX_MS
    );

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connectWebSocket();
    }, delayMs);
  };

  const connectWebSocket = () => {
    if (!CHAT_WS_URL || !conversationIdRef.current || !currentUser?.id) {
      return;
    }

    closeSocket();

    try {
      const ws = new WebSocket(CHAT_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        isWsConnectedRef.current = true;
        wsReconnectAttemptRef.current = 0;

        // join conversation with cursor so server can补发
        try {
          ws.send(
            JSON.stringify({
              type: 'chat:join',
              conversationId: conversationIdRef.current,
              userId: currentUser.id,
              afterSeq: lastSeqRef.current || 0,
            })
          );
        } catch {
          // ignore join send errors
        }
      };

      ws.onmessage = event => {
        let parsed = null;
        try {
          parsed = JSON.parse(event?.data || '{}');
        } catch {
          return;
        }

        handleRealtimeEvent(parsed).catch(() => {
          // swallow realtime handler errors to keep socket alive
        });
      };

      ws.onerror = () => {
        // onclose 中统一处理重连
      };

      ws.onclose = () => {
        isWsConnectedRef.current = false;
        clearPendingWsRequests();
        scheduleWsReconnect();
      };
    } catch {
      scheduleWsReconnect();
    }
  };

  useEffect(() => {
    let cancelled = false;

    const setupLocalChat = async () => {
      if (!currentUser?.id) {
        conversationIdRef.current = null;
        setMessages([]);
        closeSocket();
        return;
      }

      conversationIdRef.current = buildConversationId(currentUser.id);
      await initLocalChatStorage();
      if (cancelled) return;

      const messageCount = await syncMessagesFromStorage();
      if (cancelled) return;

      if (messageCount === 0) {
        setMessages([createBotWelcomeMessage(currentUser.username || currentUser.id)]);
      }

      await flushOutboxOnce();
      if (cancelled) return;

      // 1) websocket realtime
      connectWebSocket();

      // 2) periodic outbox flush
      flushTimerRef.current = setInterval(() => {
        flushOutboxOnce().catch(() => {
          // ignore interval flush errors
        });
      }, OUTBOX_POLL_INTERVAL_MS);

      // 3) seq incremental sync (cold start / disconnect补偿)
      await pullIncrementalBySeq().catch(() => {
        // ignore first pull errors
      });

      syncTimerRef.current = setInterval(() => {
        pullIncrementalBySeq().catch(() => {
          // ignore periodic sync errors
        });
      }, SYNC_PULL_INTERVAL_MS);
    };

    setupLocalChat().catch(() => {
      // keep UI usable even if local storage fails
    });

    return () => {
      cancelled = true;

      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      closeSocket();
    };
  }, [currentUser?.id]);

  const sendText = async () => {
    const text = inputText.trim();
    if (!text || !currentUser || !conversationIdRef.current) {
      return;
    }

    const draft = text;
    setInputText('');

    try {
      await enqueueLocalMessage({
        conversationId: conversationIdRef.current,
        senderId: currentUser.id,
        text: draft,
        messageType: 'text',
        previewText: draft,
        unreadDelta: 0,
      });

      await syncMessagesFromStorage();
      await flushOutboxOnce();
    } catch {
      setInputText(draft);
    }
  };

  const pickImage = async () => {
    if (!currentUser || !conversationIdRef.current) {
      return { ok: false, message: '请先登录' };
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { ok: false, message: '请允许访问相册后再发送图片' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (result.canceled) {
      return { ok: true, canceled: true };
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return { ok: false, message: '未读取到图片' };
    }

    try {
      await enqueueLocalMessage({
        conversationId: conversationIdRef.current,
        senderId: currentUser.id,
        text: serializeMediaPayload({
          type: 'image',
          imageUri: asset.uri,
        }),
        messageType: 'image',
        previewText: '[图片]',
        unreadDelta: 0,
      });

      await syncMessagesFromStorage();
      await flushOutboxOnce();
      return { ok: true };
    } catch {
      return { ok: false, message: '图片发送失败，请稍后重试' };
    }
  };

  const pickVideo = async () => {
    if (!currentUser || !conversationIdRef.current) {
      return { ok: false, message: '请先登录' };
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { ok: false, message: '请允许访问相册后再发送视频' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled) {
      return { ok: true, canceled: true };
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return { ok: false, message: '未读取到视频' };
    }

    try {
      await enqueueLocalMessage({
        conversationId: conversationIdRef.current,
        senderId: currentUser.id,
        text: serializeMediaPayload({
          type: 'video',
          videoUri: asset.uri,
          durationMillis: Number(asset.duration || 0),
        }),
        messageType: 'video',
        previewText: '[视频]',
        unreadDelta: 0,
      });

      await syncMessagesFromStorage();
      await flushOutboxOnce();
      return { ok: true };
    } catch {
      return { ok: false, message: '视频发送失败，请稍后重试' };
    }
  };

  const startRecording = async () => {
    if (!currentUser) {
      return { ok: false, message: '请先登录' };
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      return { ok: false, message: '请允许麦克风权限后再录音' };
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const nextRecording = new Audio.Recording();
    await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await nextRecording.startAsync();

    setRecording(nextRecording);
    setIsRecording(true);

    return { ok: true };
  };

  const stopRecording = async () => {
    if (!recording || !currentUser || !conversationIdRef.current) {
      return { ok: false, message: '当前没有录音' };
    }

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const status = await recording.getStatusAsync();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    if (uri) {
      try {
        await enqueueLocalMessage({
          conversationId: conversationIdRef.current,
          senderId: currentUser.id,
          text: serializeMediaPayload({
            type: 'audio',
            audioUri: uri,
            durationMillis: status.durationMillis ?? 0,
          }),
          messageType: 'audio',
          previewText: '[语音]',
          unreadDelta: 0,
        });

        await syncMessagesFromStorage();
        await flushOutboxOnce();
      } catch {
        setRecording(null);
        setIsRecording(false);
        return { ok: false, message: '语音发送失败，请稍后重试' };
      }
    }

    setRecording(null);
    setIsRecording(false);
    return { ok: true };
  };

  const togglePlayAudio = async (messageId, uri) => {
    if (playingMessageId === messageId && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlayingMessageId(null);
      return { ok: true };
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });

    sound.setOnPlaybackStatusUpdate(async playbackStatus => {
      if (playbackStatus.didJustFinish) {
        await sound.unloadAsync();
        if (soundRef.current === sound) {
          soundRef.current = null;
        }
        setPlayingMessageId(null);
      }
    });

    soundRef.current = sound;
    setPlayingMessageId(messageId);

    return { ok: true };
  };

  const cleanupMedia = async () => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    closeSocket();

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      setRecording(null);
      setIsRecording(false);
    }

    setPlayingMessageId(null);
  };

  return {
    messages,
    inputText,
    setInputText,
    isRecording,
    playingMessageId,
    sendText,
    pickImage,
    pickVideo,
    startRecording,
    stopRecording,
    togglePlayAudio,
    cleanupMedia,
    appendBotWelcome: username => {
      pushMessage(createBotWelcomeMessage(username));
    },
  };
}
