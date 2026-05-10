import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function MessageBubble({
  item,
  isMine,
  isPlaying,
  onPlayAudio,
}) {
  return (
    <View style={[styles.messageRow, isMine ? styles.myRow : styles.botRow]}>
      <View style={[styles.bubble, isMine ? styles.myBubble : styles.botBubble]}>
        {item.type === "text" && <Text style={styles.messageText}>{item.text}</Text>}

        {item.type === "image" && (
          <Image source={{ uri: item.imageUri }} style={styles.messageImage} />
        )}

        {item.type === "audio" && (
          <TouchableOpacity
            style={styles.audioButton}
            onPress={() => onPlayAudio(item.id, item.audioUri)}
          >
            <Text style={styles.audioButtonText}>
              {isPlaying ? "停止播放" : "播放语音"}
            </Text>
            <Text style={styles.audioDuration}>
              {Math.ceil((item.durationMillis || 0) / 1000)}s
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageRow: {
    width: "100%",
    flexDirection: "row",
  },
  myRow: {
    justifyContent: "flex-end",
  },
  botRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 12,
    padding: 10,
  },
  myBubble: {
    backgroundColor: "#95ec69",
  },
  botBubble: {
    backgroundColor: "#fff",
  },
  messageText: {
    color: "#222",
    lineHeight: 20,
  },
  messageImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  audioButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  audioButtonText: {
    color: "#1f6feb",
    fontWeight: "600",
  },
  audioDuration: {
    color: "#555",
  },
});
