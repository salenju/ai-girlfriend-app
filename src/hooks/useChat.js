import { useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";

export const BOT_USER = {
  id: "bot-1",
  username: "小微",
};

function createId(prefix = "msg") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function useChat(currentUser) {
  const [messages, setMessages] = useState([
    {
      id: createId(),
      type: "text",
      text: "你好呀～我是小微，今天想聊点什么？",
      senderId: BOT_USER.id,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const soundRef = useRef(null);

  const pushMessage = (message) => {
    setMessages((prev) => [...prev, message]);
  };

  const sendText = () => {
    const text = inputText.trim();
    if (!text || !currentUser) {
      return;
    }

    pushMessage({
      id: createId(),
      type: "text",
      text,
      senderId: currentUser.id,
      createdAt: new Date().toISOString(),
    });

    setInputText("");
  };

  const pickImage = async () => {
    if (!currentUser) {
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

    pushMessage({
      id: createId(),
      type: "image",
      imageUri: asset.uri,
      senderId: currentUser.id,
      createdAt: new Date().toISOString(),
    });

    return { ok: true };
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
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await nextRecording.startAsync();

    setRecording(nextRecording);
    setIsRecording(true);

    return { ok: true };
  };

  const stopRecording = async () => {
    if (!recording || !currentUser) {
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
      pushMessage({
        id: createId(),
        type: "audio",
        audioUri: uri,
        durationMillis: status.durationMillis ?? 0,
        senderId: currentUser.id,
        createdAt: new Date().toISOString(),
      });
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
      { shouldPlay: true }
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
      pushMessage({
        id: createId(),
        type: "text",
        text: `欢迎你，${username}！现在可以开始聊天了。`,
        senderId: BOT_USER.id,
        createdAt: new Date().toISOString(),
      });
    },
  };
}
