import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar as RNStatusBar,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { sendChatApi } from '../api/chatApi';
import ChatInputBar from '../components/chat/ChatInputBar';
import MessageBubble from '../components/chat/MessageBubble';
import { useChat } from '../hooks/useChat';

export default function ChatScreen({ currentUser, onLogout }) {
  const PageContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const pageContainerProps =
    Platform.OS === 'ios' ? { behavior: 'padding', keyboardVerticalOffset: 0 } : {};
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [immediateReplies, setImmediateReplies] = useState([]);

  const createUiReply = ({ text, createdAt, id }) => ({
    id: String(id || `http-reply-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
    type: 'text',
    text,
    senderId: 'bot-1',
    createdAt: createdAt || new Date().toISOString(),
    status: 'sent',
  });

  const extractImmediateReplyTexts = payload => {
    if (!payload) return [];

    const normalizeItem = item => {
      if (!item || typeof item !== 'object') return null;

      const text = String(
        // 你的接口主结构：{ role: 'assistant', content: '...' }
        item.content || item.text || item.reply || item.message || item.answer || ''
      ).trim();

      if (!text) return null;

      // 若带 role，则优先 assistant；无 role 时按通用结构处理
      if (item.role && item.role !== 'assistant') return null;

      return {
        text,
        createdAt: item.createdAt || item.timestamp || null,
        id: item.id || null,
      };
    };

    const collect = value => {
      if (!value) return [];

      if (typeof value === 'string') {
        const text = value.trim();
        return text ? [{ text, createdAt: null, id: null }] : [];
      }

      if (Array.isArray(value)) {
        return value
          .map(item => {
            if (typeof item === 'string') {
              const text = item.trim();
              return text ? { text, createdAt: null, id: null } : null;
            }
            return normalizeItem(item);
          })
          .filter(Boolean);
      }

      if (typeof value === 'object') {
        const single = normalizeItem(value);
        return single ? [single] : [];
      }

      return [];
    };

    const candidates = [
      payload,
      payload.assistantMessage,
      payload.message,
      payload.reply,
      payload.answer,
      payload.content,
      payload.messages,
      payload.data?.assistantMessage,
      payload.data?.message,
      payload.data?.reply,
      payload.data?.answer,
      payload.data?.content,
      payload.data?.messages,
    ];

    const result = [];
    for (const candidate of candidates) {
      const items = collect(candidate);
      for (const item of items) {
        if (!item?.text) continue;

        const duplicate = result.some(
          existing =>
            existing.text === item.text &&
            String(existing.createdAt || '') === String(item.createdAt || '')
        );

        if (!duplicate) {
          result.push(item);
        }
      }
    }

    return result;
  };

  const {
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
  } = useChat(currentUser);

  const mergedMessages = useMemo(() => {
    const list = [...messages, ...immediateReplies];
    return list.sort((a, b) => {
      const left = new Date(a.createdAt || 0).getTime();
      const right = new Date(b.createdAt || 0).getTime();
      return left - right;
    });
  }, [messages, immediateReplies]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const showSub = Keyboard.addListener('keyboardDidShow', event => {
      setAndroidKeyboardHeight(event.endCoordinates?.height ?? 0);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handlePickImage = async () => {
    try {
      const result = await pickImage();
      if (result?.ok === false) {
        Alert.alert('提示', result.message || '发送图片失败');
      }
    } catch (error) {
      Alert.alert('图片发送失败', error?.message ?? '请稍后重试');
    }
  };

  const handlePickVideo = async () => {
    try {
      const result = await pickVideo();
      if (result?.ok === false) {
        Alert.alert('提示', result.message || '发送视频失败');
      }
    } catch (error) {
      Alert.alert('视频发送失败', error?.message ?? '请稍后重试');
    }
  };

  const handleToggleRecord = async () => {
    try {
      const result = isRecording ? await stopRecording() : await startRecording();
      if (result?.ok === false) {
        Alert.alert('提示', result.message || '录音失败');
      }
    } catch (error) {
      Alert.alert('录音失败', error?.message ?? '请稍后重试');
    }
  };

  const handlePlayAudio = async (messageId, uri) => {
    try {
      await togglePlayAudio(messageId, uri);
    } catch (error) {
      Alert.alert('播放失败', error?.message ?? '语音播放失败');
    }
  };

  const handleSendText = async () => {
    const draft = inputText.trim();
    if (!draft) {
      return;
    }

    try {
      const params = {
        type: 'text',
        content: draft,
        mediaUrl: '',
        generateReply: true,
      };

      // 1) 本地先入列，保证用户消息立即可见
      await sendText();

      // 2) 触发服务端处理（可能立即返回回复，也可能后续走 ws 推送）
      const result = await sendChatApi(params);

      console.log('=====>接口返回信息', result.payload);
      if (result?.ok === false) {
        Alert.alert('发送失败', result.message || '请稍后重试');
        return;
      }

      // 3) 兼容“立即回复”场景：直接落到列表
      const assistantMessage = result?.payload?.data?.assistantMessage;
      const replyItems = extractImmediateReplyTexts(assistantMessage || result?.payload);
      if (replyItems.length > 0) {
        setImmediateReplies(prev => [...prev, ...replyItems.map(createUiReply)]);
      }
      // 4) 若无立即回复，保持静默，等待 useChat 内的 ws/sync 推送
    } catch (error) {
      Alert.alert('发送失败', error?.message ?? '请稍后重试');
    }
  };

  const handleLogout = async () => {
    await cleanupMedia();
    onLogout();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <PageContainer style={styles.page} {...pageContainerProps}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>与小微聊天中</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={mergedMessages}
          keyExtractor={item => String(item.id || `${item.senderId}-${item.createdAt}`)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          renderItem={({ item }) => {
            const isMine = item.senderId === currentUser?.id;
            return (
              <MessageBubble
                item={item}
                isMine={isMine}
                isPlaying={playingMessageId === item.id}
                onPlayAudio={handlePlayAudio}
              />
            );
          }}
        />

        <View
          style={[
            styles.composerArea,
            Platform.OS === 'android' && {
              marginBottom: androidKeyboardHeight,
            },
          ]}
        >
          <ChatInputBar
            inputText={inputText}
            onChangeText={setInputText}
            onSend={handleSendText}
            isRecording={isRecording}
            onToggleRecord={handleToggleRecord}
          />

          <View style={styles.mediaRow}>
            <TouchableOpacity style={styles.mediaButton} onPress={handlePickImage}>
              <Text style={styles.mediaButtonText}>图片</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mediaButton} onPress={handlePickVideo}>
              <Text style={styles.mediaButtonText}>视频</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PageContainer>
      <StatusBar style='dark' translucent={false} backgroundColor='#f2f4f8' />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0,
  },
  page: {
    flex: 1,
    backgroundColor: '#f2f4f8',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  logoutButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  logoutText: {
    color: '#444',
  },
  listContent: {
    padding: 12,
    paddingBottom: 16,
    gap: 10,
  },
  composerArea: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ececec',
    paddingBottom: Platform.OS === 'ios' ? 6 : 0,
  },
  mediaRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 8,
  },
  mediaButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  mediaButtonText: {
    color: '#333',
    fontWeight: '600',
  },
});
