import * as MediaLibrary from "expo-media-library";
import { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
  const [previewVisible, setPreviewVisible] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const durationSec = Math.max(1, Math.ceil((item.durationMillis || 0) / 1000));
  const audioWidth = getAudioBubbleWidth(item.durationMillis || 0);

  const waveBars = [6, 10, 14];

  const handleSaveImage = async () => {
    if (!item?.imageUri) {
      return;
    }

    try {
      setSavingImage(true);

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("权限不足", "请允许访问相册后再保存图片");
        return;
      }

      const asset = await MediaLibrary.createAssetAsync(item.imageUri);
      try {
        await MediaLibrary.createAlbumAsync("AIChat", asset, false);
      } catch {
        // 相册已存在时忽略
      }

      Alert.alert("保存成功", "图片已保存到系统相册");
    } catch (error) {
      Alert.alert("保存失败", error?.message ?? "图片保存失败，请稍后重试");
    } finally {
      setSavingImage(false);
    }
  };

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
          <>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewVisible(true)}
            >
              <Image
                source={{ uri: item.imageUri }}
                style={styles.messageImage}
              />
            </TouchableOpacity>

            <Modal
              animationType="fade"
              transparent
              visible={previewVisible}
              onRequestClose={() => setPreviewVisible(false)}
            >
              <View style={styles.previewMask}>
                <TouchableOpacity
                  style={styles.previewCloseArea}
                  activeOpacity={1}
                  onPress={() => setPreviewVisible(false)}
                >
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>

                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={styles.previewActionButton}
                    onPress={handleSaveImage}
                    disabled={savingImage}
                  >
                    <Text style={styles.previewActionText}>
                      {savingImage ? "保存中..." : "保存到相册"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </>
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
  previewMask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "space-between",
  },
  previewCloseArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 30,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewActions: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    alignItems: "center",
  },
  previewActionButton: {
    minWidth: 150,
    backgroundColor: "#07c160",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  previewActionText: {
    color: "#fff",
    fontWeight: "700",
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
