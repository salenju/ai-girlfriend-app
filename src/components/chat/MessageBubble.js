import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const AUDIO_MIN_WIDTH = 90;
const AUDIO_MAX_WIDTH = 220;

function getAudioBubbleWidth(durationMillis = 0) {
  const seconds = Math.max(1, Math.ceil(durationMillis / 1000));
  return Math.min(
    AUDIO_MAX_WIDTH,
    Math.max(AUDIO_MIN_WIDTH, 70 + seconds * 10),
  );
}

export default function MessageBubble({
  item,
  isMine,
  isPlaying,
  onPlayAudio,
}) {
  const durationSec = Math.max(1, Math.ceil((item.durationMillis || 0) / 1000));
  const audioWidth = getAudioBubbleWidth(item.durationMillis || 0);

  const waveBars = [6, 10, 14];

  return (
    <View style={[styles.messageRow, isMine ? styles.myRow : styles.botRow]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.myBubble : styles.botBubble,
          item.type === "audio" && styles.audioOuterBubble,
        ]}
      >
        {item.type === "text" && (
          <Text style={styles.messageText}>{item.text}</Text>
        )}

        {item.type === "image" && (
          <Image source={{ uri: item.imageUri }} style={styles.messageImage} />
        )}

        {item.type === "audio" && (
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.audioCard,
              { width: audioWidth },
              isPlaying && styles.audioCardPlaying,
            ]}
            onPress={() => onPlayAudio(item.id, item.audioUri)}
          >
            {isMine ? (
              <>
                <Text style={styles.audioDurationText}>{durationSec}''</Text>
                <View style={styles.waveContainer}>
                  {waveBars.map((height, index) => (
                    <View
                      key={`${item.id}-w-${index}`}
                      style={[
                        styles.waveBar,
                        {
                          height: isPlaying
                            ? height + (index % 2 === 0 ? 2 : 4)
                            : height,
                        },
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.waveContainer}>
                  {waveBars.map((height, index) => (
                    <View
                      key={`${item.id}-w-${index}`}
                      style={[
                        styles.waveBar,
                        {
                          height: isPlaying
                            ? height + (index % 2 === 0 ? 2 : 4)
                            : height,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.audioDurationText}>{durationSec}''</Text>
              </>
            )}
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
  audioOuterBubble: {
    paddingVertical: 8,
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
  audioCard: {
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  audioCardPlaying: {
    opacity: 0.85,
  },
  audioDurationText: {
    color: "#1f1f1f",
    fontWeight: "600",
    fontSize: 14,
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    marginHorizontal: 4,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#1f1f1f",
  },
});
