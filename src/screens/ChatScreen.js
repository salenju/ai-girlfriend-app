import { StatusBar } from "expo-status-bar";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ChatInputBar from "../components/chat/ChatInputBar";
import MessageBubble from "../components/chat/MessageBubble";
import { useChat } from "../hooks/useChat";

export default function ChatScreen({ currentUser, onLogout }) {
  const {
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
  } = useChat(currentUser);

  const handlePickImage = async () => {
    try {
      const result = await pickImage();
      if (result?.ok === false) {
        Alert.alert("提示", result.message || "发送图片失败");
      }
    } catch (error) {
      Alert.alert("图片发送失败", error?.message ?? "请稍后重试");
    }
  };

  const handleToggleRecord = async () => {
    try {
      const result = isRecording
        ? await stopRecording()
        : await startRecording();
      if (result?.ok === false) {
        Alert.alert("提示", result.message || "录音失败");
      }
    } catch (error) {
      Alert.alert("录音失败", error?.message ?? "请稍后重试");
    }
  };

  const handlePlayAudio = async (messageId, uri) => {
    try {
      await togglePlayAudio(messageId, uri);
    } catch (error) {
      Alert.alert("播放失败", error?.message ?? "语音播放失败");
    }
  };

  const handleLogout = async () => {
    await cleanupMedia();
    onLogout();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>与小微聊天中</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
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

        <ChatInputBar
          inputText={inputText}
          onChangeText={setInputText}
          onSend={sendText}
          onPickImage={handlePickImage}
          isRecording={isRecording}
          onToggleRecord={handleToggleRecord}
        />
      </KeyboardAvoidingView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f4f8",
  },
  page: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  logoutButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  logoutText: {
    color: "#444",
  },
  listContent: {
    padding: 12,
    paddingBottom: 16,
    gap: 10,
  },
});
