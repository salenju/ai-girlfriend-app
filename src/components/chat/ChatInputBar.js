import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ChatInputBar({
  inputText,
  onChangeText,
  onSend,
  isRecording,
  onToggleRecord,
}) {
  const [voiceMode, setVoiceMode] = useState(false);

  const handlePressIn = () => {
    if (!isRecording) {
      onToggleRecord?.();
    }
  };

  const handlePressOut = () => {
    if (isRecording) {
      onToggleRecord?.();
    }
  };

  return (
    <View style={styles.inputArea}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => setVoiceMode((prev) => !prev)}
        >
          <Text style={styles.modeIcon}>{voiceMode ? "⌨️" : "🎤"}</Text>
        </TouchableOpacity>

        <View style={styles.centerArea}>
          {voiceMode ? (
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={({ pressed }) => [
                styles.holdToTalkButton,
                (pressed || isRecording) && styles.holdToTalkButtonActive,
              ]}
            >
              <Text style={styles.holdToTalkText}>
                {isRecording ? "松开发送" : "按住说话"}
              </Text>
            </Pressable>
          ) : (
            <TextInput
              value={inputText}
              onChangeText={onChangeText}
              style={styles.chatInput}
              placeholder="输入消息..."
              multiline
            />
          )}
        </View>

        <TouchableOpacity style={styles.sendButton} onPress={onSend}>
          <Text style={styles.sendButtonText}>发送</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputArea: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#ececec",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  modeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  modeIcon: {
    fontSize: 18,
  },
  centerArea: {
    flex: 1,
    marginHorizontal: 8,
  },
  chatInput: {
    minHeight: 40,
    maxHeight: 96,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fafafa",
  },
  holdToTalkButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f7f7f7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  holdToTalkButtonActive: {
    backgroundColor: "#e6e6e6",
    borderColor: "#cfcfcf",
  },
  holdToTalkText: {
    color: "#333",
    fontWeight: "600",
  },
  sendButton: {
    backgroundColor: "#07c160",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
