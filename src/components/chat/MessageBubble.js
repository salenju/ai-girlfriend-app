import { Video } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const AUDIO_MIN_WIDTH = 90;
const AUDIO_MAX_WIDTH = 220;
const VIDEO_SWIPE_CLOSE_THRESHOLD = 90;
const SCREEN_WIDTH = Dimensions.get('window').width;

function getAudioBubbleWidth(durationMillis = 0) {
  const seconds = Math.max(1, Math.ceil(durationMillis / 1000));
  return Math.min(AUDIO_MAX_WIDTH, Math.max(AUDIO_MIN_WIDTH, 70 + seconds * 10));
}

function formatVideoDuration(durationMillis = 0) {
  const totalSeconds = Math.max(0, Math.round(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function MessageBubble({ item, isMine, isPlaying, onPlayAudio }) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [videoPreviewVisible, setVideoPreviewVisible] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);

  const inlineVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const videoSwipeX = useRef(new Animated.Value(0)).current;
  const videoBackdropOpacity = videoSwipeX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [0.2, 0.92, 0.2],
    extrapolate: 'clamp',
  });

  const closeVideoPreview = () => {
    setVideoPreviewVisible(false);
    videoSwipeX.setValue(0);
  };

  const animateVideoPreviewClose = (direction = 1) => {
    Animated.timing(videoSwipeX, {
      toValue: direction * SCREEN_WIDTH,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      closeVideoPreview();
    });
  };

  const resetVideoToStartWhenFinished = (status, videoRef) => {
    if (!status?.isLoaded || !status.didJustFinish) {
      return;
    }

    videoRef.current
      ?.setStatusAsync({
        positionMillis: 0,
        shouldPlay: false,
      })
      .catch(() => {
        // ignore
      });
  };

  const videoPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        videoSwipeX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) >= VIDEO_SWIPE_CLOSE_THRESHOLD) {
          animateVideoPreviewClose(gestureState.dx > 0 ? 1 : -1);
          return;
        }

        Animated.spring(videoSwipeX, {
          toValue: 0,
          bounciness: 6,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(videoSwipeX, {
          toValue: 0,
          bounciness: 6,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const durationSec = Math.max(1, Math.ceil((item.durationMillis || 0) / 1000));
  const audioWidth = getAudioBubbleWidth(item.durationMillis || 0);
  const videoDuration = formatVideoDuration(item.durationMillis || 0);

  const waveBars = [6, 10, 14];

  const ensureMediaPermission = async (forType = '媒体') => {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('权限不足', `请允许访问相册后再保存${forType}`);
      return false;
    }
    return true;
  };

  const saveAssetToAlbum = async (uri, successText) => {
    const asset = await MediaLibrary.createAssetAsync(uri);
    try {
      await MediaLibrary.createAlbumAsync('AIChat', asset, false);
    } catch {
      // 相册已存在时忽略
    }
    Alert.alert('保存成功', successText);
  };

  const handleSaveImage = async () => {
    if (!item?.imageUri) {
      return;
    }

    try {
      setSavingImage(true);
      const granted = await ensureMediaPermission('图片');
      if (!granted) {
        return;
      }

      await saveAssetToAlbum(item.imageUri, '图片已保存到系统相册');
    } catch (error) {
      Alert.alert('保存失败', error?.message ?? '图片保存失败，请稍后重试');
    } finally {
      setSavingImage(false);
    }
  };

  const handleSaveVideo = async () => {
    if (!item?.videoUri) {
      return;
    }

    try {
      setSavingVideo(true);
      const granted = await ensureMediaPermission('视频');
      if (!granted) {
        return;
      }

      await saveAssetToAlbum(item.videoUri, '视频已保存到系统相册');
    } catch (error) {
      Alert.alert('保存失败', error?.message ?? '视频保存失败，请稍后重试');
    } finally {
      setSavingVideo(false);
    }
  };

  return (
    <View style={[styles.messageRow, isMine ? styles.myRow : styles.botRow]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.myBubble : styles.botBubble,
          item.type === 'audio' && styles.audioOuterBubble,
        ]}
      >
        {item.type === 'text' && <Text style={styles.messageText}>{item.text}</Text>}

        {item.type === 'image' && (
          <>
            <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewVisible(true)}>
              <Image source={{ uri: item.imageUri }} style={styles.messageImage} />
            </TouchableOpacity>

            <Modal
              animationType='fade'
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
                    resizeMode='contain'
                  />
                </TouchableOpacity>

                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={styles.previewActionButton}
                    onPress={handleSaveImage}
                    disabled={savingImage}
                  >
                    <Text style={styles.previewActionText}>
                      {savingImage ? '保存中...' : '保存到相册'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </>
        )}

        {item.type === 'video' && (
          <View style={styles.videoWrapper}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                videoSwipeX.setValue(0);
                setVideoPreviewVisible(true);
              }}
            >
              <Video
                ref={inlineVideoRef}
                source={{ uri: item.videoUri }}
                style={styles.messageVideo}
                resizeMode='cover'
                shouldPlay={false}
                isLooping={false}
                onPlaybackStatusUpdate={status => {
                  resetVideoToStartWhenFinished(status, inlineVideoRef);
                }}
              />
              <View style={styles.videoHintBadge}>
                <Text style={styles.videoHintText}>全屏预览</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.videoMetaRow}>
              <Text style={styles.videoDurationText}>{videoDuration}</Text>
              <TouchableOpacity
                style={styles.videoSaveButton}
                onPress={handleSaveVideo}
                disabled={savingVideo}
              >
                <Text style={styles.videoSaveButtonText}>
                  {savingVideo ? '保存中...' : '下载到本地'}
                </Text>
              </TouchableOpacity>
            </View>

            <Modal
              animationType='fade'
              transparent
              visible={videoPreviewVisible}
              onRequestClose={closeVideoPreview}
            >
              <View style={styles.videoPreviewModalRoot}>
                <TouchableWithoutFeedback onPress={closeVideoPreview}>
                  <Animated.View
                    style={[styles.videoPreviewBackdrop, { opacity: videoBackdropOpacity }]}
                  />
                </TouchableWithoutFeedback>

                <Animated.View
                  style={[styles.videoPreviewPanel, { transform: [{ translateX: videoSwipeX }] }]}
                  {...videoPanResponder.panHandlers}
                >
                  <View style={styles.videoPreviewHeader}>
                    <TouchableOpacity
                      style={styles.videoPreviewCloseButton}
                      onPress={closeVideoPreview}
                    >
                      <Text style={styles.videoPreviewCloseText}>关闭</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableWithoutFeedback onPress={closeVideoPreview}>
                    <View style={styles.videoPreviewBody}>
                      <TouchableWithoutFeedback onPress={() => {}}>
                        <View style={styles.previewVideoFrame}>
                          <Video
                            ref={previewVideoRef}
                            source={{ uri: item.videoUri }}
                            style={styles.previewVideo}
                            useNativeControls
                            resizeMode='contain'
                            shouldPlay={false}
                            isLooping={false}
                            onPlaybackStatusUpdate={status => {
                              resetVideoToStartWhenFinished(status, previewVideoRef);
                            }}
                          />
                        </View>
                      </TouchableWithoutFeedback>
                    </View>
                  </TouchableWithoutFeedback>

                  <View style={styles.previewActions}>
                    <TouchableOpacity
                      style={styles.previewActionButton}
                      onPress={handleSaveVideo}
                      disabled={savingVideo}
                    >
                      <Text style={styles.previewActionText}>
                        {savingVideo ? '保存中...' : '下载到本地'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
            </Modal>
          </View>
        )}

        {item.type === 'audio' && (
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.audioCard, { width: audioWidth }, isPlaying && styles.audioCardPlaying]}
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
                          height: isPlaying ? height + (index % 2 === 0 ? 2 : 4) : height,
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
                          height: isPlaying ? height + (index % 2 === 0 ? 2 : 4) : height,
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
    width: '100%',
    flexDirection: 'row',
  },
  myRow: {
    justifyContent: 'flex-end',
  },
  botRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 12,
    padding: 10,
  },
  audioOuterBubble: {
    paddingVertical: 8,
  },
  myBubble: {
    backgroundColor: '#95ec69',
  },
  botBubble: {
    backgroundColor: '#fff',
  },
  messageText: {
    color: '#222',
    lineHeight: 20,
  },
  messageImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  messageVideo: {
    width: 220,
    height: 220,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  videoWrapper: {
    gap: 8,
  },
  videoHintBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  videoHintText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  videoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoDurationText: {
    color: '#333',
    fontWeight: '600',
  },
  videoSaveButton: {
    backgroundColor: '#07c160',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  videoSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  previewMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'space-between',
  },
  previewCloseArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 30,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  previewVideoFrame: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPreviewModalRoot: {
    flex: 1,
  },
  videoPreviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  videoPreviewHeader: {
    paddingTop: 18,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  videoPreviewPanel: {
    flex: 1,
    justifyContent: 'space-between',
  },
  videoPreviewCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  videoPreviewCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
  videoPreviewBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  previewActions: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    alignItems: 'center',
  },
  previewActionButton: {
    minWidth: 150,
    backgroundColor: '#07c160',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  previewActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  audioCard: {
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioCardPlaying: {
    opacity: 0.85,
  },
  audioDurationText: {
    color: '#1f1f1f',
    fontWeight: '600',
    fontSize: 14,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginHorizontal: 4,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#1f1f1f',
  },
});
