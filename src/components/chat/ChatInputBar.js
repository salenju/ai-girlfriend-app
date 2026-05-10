import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function ChatInputBar({
  inputText,
  onChangeText,
  onSend,
  onPickImage,
  isRecording,
  onToggleRecord,
}) {
  return (
    <View style={styles.inputArea}>
      <TextInput
        value={inputText}
        onChangeText={onChangeText}
        style={styles.chatInput}
        placeholder="输入消息..."
        multiline
      />

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onPickImage}>
          <Text style={styles.actionText}>图片</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, isRecording && styles.recordingButton]}
          onPress={onToggleRecord}
        >
          <Text style={styles.actionText}>{isRecording ? "停止" : "语音"}</Text>
        </TouchableOpacity>

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
  chatInput: {
    minHeight: 42,
    maxHeight: 96,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fafafa",
  },
  actionRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  recordingButton: {
    backgroundColor: "#ffd7d7",
  },
  actionText: {
    color: "#333",
    fontWeight: "600",
  },
  sendButton: {
    marginLeft: "auto",
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
