import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  enqueueTextMessage,
  flushOutboxQueue,
  initLocalChatStorage,
  listMessagesByConversation,
} from "../services/chat/localChatStorage";

export const BOT_USER = {
  id: "bot-1",
  username: "小微",
};

const OUTBOX_POLL_INTERVAL_MS = 2500;
const MESSAGE_PAGE_SIZE = 200;
const MEDIA_PAYLOAD_PREFIX = "__LOCAL_MEDIA__:";

function createId(prefix = "msg") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function buildConversationId(userId) {
  return `direct-${userId}-${BOT_USER.id}`;
}

function sortByCreatedAt(list) {
  return [...list].sort((a, b) => {
    const left = new Date(a.createdAt || 0).getTime();
    const right = new Date(b.createdAt || 0).getTime();
    return left - right;
  });
}

function serializeMediaPayload(payload) {
  return `${MEDIA_PAYLOAD_PREFIX}${JSON.stringify(payload)}`;
}

function parseMediaPayload(text) {
  if (typeof text !== "string" || !text.startsWith(MEDIA_PAYLOAD_PREFIX)) {
    return null;
  }

  try {
    const raw = text.slice(MEDIA_PAYLOAD_PREFIX.length);
    const parsed = JSON.parse(raw);
    if (parsed?.type === "image" && parsed?.imageUri) {
      return {
        type: "image",
        imageUri: parsed.imageUri,
      };
    }

    if (parsed?.type === "audio" && parsed?.audioUri) {
      return {
        type: "audio",
        audioUri: parsed.audioUri,
        durationMillis: Number(parsed.durationMillis || 0),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function mapStoredRowToUi(row) {
  const media = parseMediaPayload(row.text || "");
  const base = {
    id: row.clientId || String(row.id),
    senderId: row.senderId,
    createdAt: row.createdAtServer || row.createdAtClient,
    status: row.status,
  };

  if (media?.type === "image") {
    return {
      ...base,
      type: "image",
      imageUri: media.imageUri,
    };
  }

  if (media?.type === "audio") {
    return {
      ...base,
      type: "audio",
      audioUri: media.audioUri,
      durationMillis: media.durationMillis,
    };
  }

  return {
    ...base,
    type: "text",
    text: row.text || "",
  };
}

function createBotWelcomeMessage(username) {
  return {
    id: createId("welcome"),
    type: "text",
    text: `欢迎你，${username}！现在可以开始聊天了。`,
    senderId: BOT_USER.id,
    createdAt: new Date().toISOString(),
    __volatile: true,
  };
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendTaskMock(task) {
  await delay(150);
  const text = task?.payload?.text || "";
  if (text.includes("#fail")) {
    throw new Error("模拟发送失败：命中 #fail 标记");
  }

  return {
    serverId: `server-${task.clientId}`,
    createdAtServer: new Date().toISOString(),
  };
}

export function useChat(currentUser) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);

  const soundRef = useRef(null);
  const flushTimerRef = useRef(null);
  const isFlushingRef = useRef(false);
  const conversationIdRef = useRef(null);

  const pushMessage = (message) => {
    setMessages((prev) => sortByCreatedAt([...prev, message]));
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

    setMessages((prev) => {
      const volatileMessages = prev.filter((item) => item.__volatile === true);
      return sortByCreatedAt([...persistentMessages, ...volatileMessages]);
    });

    return persistentMessages.length;
  };

  const flushOutboxOnce = async () => {
    if (isFlushingRef.current || !conversationIdRef.current) {
      return;
    }

    isFlushingRef.current = true;
    try {
      const summary = await flushOutboxQueue({
        sendTask: sendTaskMock,
        batchSize: 20,
      });

      if (summary.processed > 0) {
        await syncMessagesFromStorage();
      }
    } finally {
      isFlushingRef.current = false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const setupLocalChat = async () => {
      if (!currentUser?.id) {
        conversationIdRef.current = null;
        setMessages([]);
        return;
      }

      conversationIdRef.current = buildConversationId(currentUser.id);
      await initLocalChatStorage();
      if (cancelled) return;

      const messageCount = await syncMessagesFromStorage();
      if (cancelled) return;

      if (messageCount === 0) {
        setMessages([
          createBotWelcomeMessage(currentUser.username || currentUser.id),
        ]);
      }

      await flushOutboxOnce();
      if (cancelled) return;

      flushTimerRef.current = setInterval(() => {
        flushOutboxOnce().catch(() => {
          // ignore interval flush errors
        });
      }, OUTBOX_POLL_INTERVAL_MS);
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
    };
  }, [currentUser?.id]);

  const sendText = async () => {
    const text = inputText.trim();
    if (!text || !currentUser || !conversationIdRef.current) {
      return;
    }

    const draft = text;
    setInputText("");

    try {
      await enqueueTextMessage({
        conversationId: conversationIdRef.current,
        senderId: currentUser.id,
        text: draft,
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
      return { ok: false, message: "请先登录" };
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { ok: false, message: "请允许访问相册后再发送图片" };
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
      return { ok: false, message: "未读取到图片" };
    }

    try {
      await enqueueTextMessage({
        conversationId: conversationIdRef.current,
        senderId: currentUser.id,
        text: serializeMediaPayload({
          type: "image",
          imageUri: asset.uri,
        }),
        unreadDelta: 0,
      });

      await syncMessagesFromStorage();
      await flushOutboxOnce();
      return { ok: true };
    } catch {
      return { ok: false, message: "图片发送失败，请稍后重试" };
    }
  };

  const startRecording = async () => {
    if (!currentUser) {
      return { ok: false, message: "请先登录" };
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      return { ok: false, message: "请允许麦克风权限后再录音" };
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const nextRecording = new Audio.Recording();
    await nextRecording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    await nextRecording.startAsync();

    setRecording(nextRecording);
    setIsRecording(true);

    return { ok: true };
  };

  const stopRecording = async () => {
    if (!recording || !currentUser || !conversationIdRef.current) {
      return { ok: false, message: "当前没有录音" };
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
        await enqueueTextMessage({
          conversationId: conversationIdRef.current,
          senderId: currentUser.id,
          text: serializeMediaPayload({
            type: "audio",
            audioUri: uri,
            durationMillis: status.durationMillis ?? 0,
          }),
          unreadDelta: 0,
        });

        await syncMessagesFromStorage();
        await flushOutboxOnce();
      } catch {
        setRecording(null);
        setIsRecording(false);
        return { ok: false, message: "语音发送失败，请稍后重试" };
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

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
    );

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.didJustFinish) {
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
    startRecording,
    stopRecording,
    togglePlayAudio,
    cleanupMedia,
    appendBotWelcome: (username) => {
      pushMessage(createBotWelcomeMessage(username));
    },
  };
}
