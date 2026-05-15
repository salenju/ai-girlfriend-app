import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
import ChatInputBar from '../components/chat/ChatInputBar';
import MessageBubble from '../components/chat/MessageBubble';
import { useChat } from '../hooks/useChat';

export default function ChatScreen({ currentUser, onLogout }) {
  const PageContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const pageContainerProps =
    Platform.OS === 'ios' ? { behavior: 'padding', keyboardVerticalOffset: 0 } : {};
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

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
          data={messages}
          keyExtractor={item => item.id}
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
            onSend={sendText}
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
