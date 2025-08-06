import AntDesign from "@expo/vector-icons/AntDesign";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Helper function to replace localhost
const replaceLocalhost = (url: string | undefined) => {
  return url?.replace("localhost:3000", "192.168.0.102:3000");
};

// Helper function to determine media type from mimeType or URL
const determineMediaType = (
  mimeType?: string,
  url?: string
): "image" | "video" => {
  if (mimeType) {
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("image/")) return "image";
  }

  if (url) {
    const videoExtensions = [
      ".mp4",
      ".mov",
      ".avi",
      ".mkv",
      ".wmv",
      ".flv",
      ".webm",
    ];
    const lowerUrl = url.toLowerCase();
    if (videoExtensions.some((ext) => lowerUrl.includes(ext))) {
      return "video";
    }
  }

  return "image";
};

interface MediaFile {
  attachmentOrder?: number;
  caption?: string;
  downloadUrl: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface AuthenticatedMediaViewerProps {
  mediaFile?: MediaFile;
  mediaUrl?: string;
  token?: string | null;
  mediaType?: "image" | "video";
  style?: any;
}

const AuthenticatedMediaViewer: React.FC<AuthenticatedMediaViewerProps> = ({
  mediaFile,
  mediaUrl,
  token,
  mediaType,
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [fullMediaLoading, setFullMediaLoading] = useState(true);

  // Determine the actual media URL and type
  const actualMediaUrl = mediaFile?.downloadUrl || mediaUrl;
  const actualMediaType =
    mediaType || determineMediaType(mediaFile?.mimeType, actualMediaUrl);

  const processedUrl = replaceLocalhost(actualMediaUrl);
  const isVideo = actualMediaType === "video";

  // Check if token is already in URL or needs to be added to headers
  const urlHasToken = processedUrl?.includes("token=");

  // Create video source with headers if needed
  const videoSource =
    isVideo && processedUrl
      ? {
          uri: processedUrl,
          headers:
            !urlHasToken && token
              ? { Authorization: `Bearer ${token}` }
              : undefined,
        }
      : null;

  // Create video players for thumbnail and full video
  const thumbnailPlayer = useVideoPlayer(videoSource, (player) => {
    player.muted = true;
    player.loop = false;
  });

  const fullVideoPlayer = useVideoPlayer(videoSource, (player) => {
    player.muted = false;
    player.loop = true;
  });

  // Listen to video events
  const { isPlaying: isFullVideoPlaying } = useEvent(
    fullVideoPlayer,
    "playingChange",
    {
      isPlaying: fullVideoPlayer.playing,
    }
  );

  const { status: fullVideoStatus } = useEvent(
    fullVideoPlayer,
    "statusChange",
    {
      status: fullVideoPlayer.status,
    }
  );

  // Handle video loading states
  useEffect(() => {
    if (fullVideoStatus === "loading") {
      setFullMediaLoading(true);
    } else if (
      fullVideoStatus === "readyToPlay" ||
      fullVideoStatus === "error"
    ) {
      setFullMediaLoading(false);
    }

    if (fullVideoStatus === "error") {
      setMediaError(true);
      Alert.alert("Lỗi", "Không thể phát video");
    }
  }, [fullVideoStatus]);

  const authHeaders =
    !urlHasToken && token ? { Authorization: `Bearer ${token}` } : undefined;

  const handleMediaPress = () => {
    setModalVisible(true);
    setFullMediaLoading(true);
    if (isVideo) {
      // Reset full video player when opening modal
      fullVideoPlayer.currentTime = 0;
    }
  };

  const handleMediaError = (err: any) => {
    console.log("Media loading error:", err);
    setMediaError(true);
    setMediaLoading(false);
    Alert.alert("Lỗi", `Không thể tải ${isVideo ? "video" : "ảnh"}`);
  };

  const handleMediaLoad = () => {
    setMediaLoading(false);
  };

  const handleFullMediaLoad = () => {
    setFullMediaLoading(false);
  };

  const closeModal = () => {
    setModalVisible(false);
    if (isVideo) {
      fullVideoPlayer.pause();
    }
  };

  const toggleVideoPlayback = () => {
    if (isFullVideoPlaying) {
      fullVideoPlayer.pause();
    } else {
      fullVideoPlayer.play();
    }
  };

  const downloadMedia = async () => {
    if (mediaFile?.downloadUrl) {
      try {
        Alert.alert(
          "Download",
          `File: ${mediaFile.fileName}\nSize: ${(
            mediaFile.fileSize /
            1024 /
            1024
          ).toFixed(2)} MB`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open URL",
              onPress: () => console.log("Download URL:", processedUrl),
            },
          ]
        );
      } catch (error) {
        Alert.alert("Lỗi", "Không thể tải xuống file");
      }
    } else {
      Alert.alert("Thông báo", "Tính năng tải xuống sẽ được phát triển");
    }
  };

  if (!processedUrl) {
    return (
      <View style={[styles.mediaContainer, style]}>
        <View style={styles.mediaWrapper}>
          <View style={styles.errorContainer}>
            <AntDesign name="exclamationcircleo" size={40} color="#ccc" />
            <Text style={styles.errorText}>Không có URL media</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      {/* Thumbnail Media */}
      <TouchableOpacity
        onPress={handleMediaPress}
        activeOpacity={0.8}
        style={[styles.mediaContainer, style]}
      >
        <View style={styles.mediaWrapper}>
          {mediaError ? (
            <View style={styles.errorContainer}>
              <AntDesign
                name={isVideo ? "videocamera" : "picture"}
                size={40}
                color="#ccc"
              />
              <Text style={styles.errorText}>
                Không thể tải {isVideo ? "video" : "ảnh"}
              </Text>
            </View>
          ) : (
            <>
              {isVideo ? (
                <VideoView
                  player={thumbnailPlayer}
                  style={styles.thumbnailMedia}
                  nativeControls={false}
                  allowsFullscreen={false}
                  allowsPictureInPicture={false}
                />
              ) : (
                <Image
                  source={{
                    uri: processedUrl,
                    headers: authHeaders,
                  }}
                  style={styles.thumbnailMedia}
                  onError={handleMediaError}
                  onLoad={handleMediaLoad}
                  resizeMode="cover"
                />
              )}
              {mediaLoading && !isVideo && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#a855f7" />
                </View>
              )}
              {/* Overlay icon to indicate media type and clickable */}
              <View style={styles.overlayIcon}>
                {isVideo ? (
                  <Ionicons name="play" size={16} color="white" />
                ) : (
                  <AntDesign name="eyeo" size={16} color="white" />
                )}
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>

      {/* Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          {/* Header with controls */}
          <SafeAreaView style={styles.headerContainer}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={closeModal}
                style={styles.headerButton}
              >
                <AntDesign name="close" size={24} color="white" />
              </TouchableOpacity>

              <View style={styles.headerActions}>
                {isVideo && (
                  <TouchableOpacity
                    onPress={toggleVideoPlayback}
                    style={styles.headerButton}
                  >
                    <Ionicons
                      name={isFullVideoPlaying ? "pause" : "play"}
                      size={24}
                      color="white"
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={downloadMedia}
                  style={styles.headerButton}
                >
                  <AntDesign name="download" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          {/* Media content */}
          <View style={styles.mediaContent}>
            {fullMediaLoading && (
              <View style={styles.fullMediaLoading}>
                <ActivityIndicator size="large" color="white" />
                <Text style={styles.loadingText}>Đang tải...</Text>
              </View>
            )}

            {isVideo ? (
              <View style={styles.videoContainer}>
                <VideoView
                  player={fullVideoPlayer}
                  style={styles.fullVideo}
                  nativeControls={true}
                  allowsFullscreen={true}
                  allowsPictureInPicture={true}
                />
                {!isFullVideoPlaying && !fullMediaLoading && (
                  <TouchableOpacity
                    style={styles.videoPlayButton}
                    onPress={toggleVideoPlayback}
                  >
                    <View style={styles.playButtonContainer}>
                      <Ionicons name="play" size={60} color="white" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                maximumZoomScale={3}
                minimumZoomScale={1}
                bouncesZoom={true}
              >
                <Image
                  source={{
                    uri: processedUrl,
                    headers: authHeaders,
                  }}
                  style={styles.fullImage}
                  resizeMode="contain"
                  onError={(err) => {
                    console.log("Full image error:", err);
                    setFullMediaLoading(false);
                    Alert.alert("Lỗi", "Không thể tải ảnh");
                  }}
                  onLoad={handleFullMediaLoad}
                />
              </ScrollView>
            )}
          </View>

          {/* Media info footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText} numberOfLines={1}>
              {mediaFile?.fileName ||
                processedUrl?.split("/").pop() ||
                (isVideo ? "Video" : "Hình ảnh")}
            </Text>
            <Text style={styles.footerSubtext}>
              {mediaFile?.fileSize &&
                `Kích thước: ${(mediaFile.fileSize / 1024 / 1024).toFixed(
                  2
                )} MB • `}
              {isVideo
                ? "Chạm để phát/tạm dừng • Sử dụng controls để điều khiển"
                : "Chạm để phóng to • Kéo để cuộn"}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  mediaContainer: {
    position: "relative",
  },
  mediaWrapper: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  thumbnailMedia: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  errorContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  errorText: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  overlayIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  headerContainer: {
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  mediaContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullMediaLoading: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -50 }, { translateY: -50 }],
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  loadingText: {
    color: "white",
    marginTop: 12,
    fontSize: 16,
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight * 0.7,
    justifyContent: "center",
    alignItems: "center",
  },
  fullVideo: {
    width: "100%",
    height: "100%",
  },
  videoPlayButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -30 }, { translateY: -30 }],
  },
  playButtonContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  fullImage: {
    width: screenWidth - 40,
    height: screenHeight * 0.7,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  footerText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  footerSubtext: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
  },
});

export default AuthenticatedMediaViewer;
