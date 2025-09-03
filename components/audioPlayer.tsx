import { LOCALIP } from "@/constants/localIp";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useAudioPlayer } from "expo-audio";
import { Audio as AVAudio } from "expo-av";
import * as FileSystem from "expo-file-system";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface AudioPlayerProps {
  audioUrl: string;
  fileName?: string;
  isOwnMessage: boolean;
  duration?: number;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  fileName,
  isOwnMessage,
  duration: serverDuration,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState(serverDuration || 0);
  const [effectiveUri, setEffectiveUri] = useState<string | null>(null);

  const replaceVideohost = (url: string | undefined) => {
    return url
      ?.replace("download", "preview")
      .replace("http://localhost:3000", LOCALIP);
  };

  const refactUrl = replaceVideohost(audioUrl);

  // Initialize player only when URI is ready
  const player = useAudioPlayer(
    effectiveUri ? { uri: effectiveUri } : null,
    1.0
  );

  // Probe server and set effective URI
  useEffect(() => {
    const probe = async () => {
      try {
        if (!refactUrl) return;

        console.log("[audio] Probing URL:", refactUrl);
        const head = await fetch(refactUrl, { method: "HEAD" });
        console.log("[audio] HEAD status:", head.status);

        if (head.status !== 200) {
          setError("Không thể truy cập file âm thanh");
          return;
        }

        const acceptRanges = head.headers.get("accept-ranges");

        if (acceptRanges !== "bytes") {
          console.log("[audio] Downloading to cache for compatibility");
          try {
            const unique = Math.random().toString(36).substr(2, 6);
            const localName = (fileName || "audio") + "_" + unique + ".m4a";
            const dest = (FileSystem.cacheDirectory || "") + localName;
            const dl = await FileSystem.downloadAsync(refactUrl, dest);
            console.log("[audio] Downloaded:", dl.uri);
            setEffectiveUri(dl.uri);
          } catch (e) {
            console.log("[audio] Download fallback failed:", e);
            setEffectiveUri(refactUrl); // Try direct URL anyway
          }
        } else {
          setEffectiveUri(refactUrl);
        }
      } catch (err) {
        console.log("[audio] Probe failed:", err);
        setError("Không thể tải file âm thanh");
      }
    };

    probe();
  }, [refactUrl, fileName]);

  // Listen to player events with proper null checks
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener?.(
      "playbackStatusUpdate",
      (status) => {
        console.log("Playback status:", status);

        if (status?.duration && !totalDuration) {
          setTotalDuration(status.duration);
        }
      }
    );

    return () => {
      subscription?.remove?.();
    };
  }, [player, totalDuration]);

  // Cleanup
  useEffect(() => {
    return () => {
      console.log("AudioPlayer cleanup");
      try {
        if (player?.playing) {
          player.pause();
        }
        setTimeout(() => {
          try {
            player?.remove?.();
          } catch (e) {
            console.warn("Cleanup warning:", e);
          }
        }, 100);
      } catch (e) {
        console.warn("Initial cleanup warning:", e);
      }
    };
  }, [player]);

  // Cleanup cached file
  useEffect(() => {
    const uri = effectiveUri;
    return () => {
      if (uri && uri.startsWith(FileSystem.cacheDirectory || "file://")) {
        FileSystem.deleteAsync(uri).catch(() => {});
      }
    };
  }, [effectiveUri]);

  const handlePlayPause = useCallback(async () => {
    if (!player || !effectiveUri) {
      console.log("Player or URI not ready");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log("Play/Pause clicked, current playing:", player.playing);

      if (player.playing) {
        console.log("Pausing audio");
        player.pause();
      } else {
        try {
          await AVAudio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            playThroughEarpieceAndroid: false,
          } as any);
        } catch (e) {
          console.log("setAudioModeAsync failed:", e);
        }
        console.log("Playing audio");
        player.play();
      }
    } catch (error) {
      console.error("Error playing/pausing audio:", error);
      setError("Không thể phát âm thanh");
      Alert.alert("Lỗi", "Không thể phát file âm thanh này");
    } finally {
      setIsLoading(false);
    }
  }, [player, effectiveUri]);

  const handleStop = useCallback(() => {
    if (!player) return;

    console.log("Stopping audio");
    try {
      player.seekTo(0);
      player.pause();
    } catch (error) {
      console.error("Error stopping audio:", error);
    }
  }, [player]);

  const formatTime = useCallback((timeSeconds: number) => {
    if (!timeSeconds || isNaN(timeSeconds)) return "0:00";
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const getProgress = useCallback(() => {
    if (!player || !totalDuration || totalDuration === 0) return 0;
    const currentTime = player.currentTime || 0;
    return Math.min(100, (currentTime / totalDuration) * 100);
  }, [player?.currentTime, totalDuration]);

  // Don't render if no effective URI yet
  if (!effectiveUri && !error) {
    return (
      <View style={[styles.container, { backgroundColor: "#f3f4f6" }]}>
        <View style={styles.playButton}>
          <FontAwesome name="spinner" size={16} color="#666" />
        </View>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isOwnMessage
            ? "rgba(255, 255, 255, 0.2)"
            : "#f3f4f6",
        },
      ]}
    >
      {/* Play/Pause Button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        disabled={isLoading || !player || !!error}
        style={[
          styles.playButton,
          {
            backgroundColor: isOwnMessage
              ? "rgba(255, 255, 255, 0.3)"
              : "#7c3aed",
            opacity: !player || !!error ? 0.5 : 1,
          },
        ]}
      >
        {isLoading ? (
          <FontAwesome name="spinner" size={18} color="white" />
        ) : error ? (
          <FontAwesome name="exclamation" size={16} color="white" />
        ) : player?.playing ? (
          <FontAwesome name="pause" size={16} color="white" />
        ) : (
          <FontAwesome
            name="play"
            size={16}
            color="white"
            style={{ marginLeft: 2 }}
          />
        )}
      </TouchableOpacity>

      {/* Audio Info & Progress */}
      <View style={styles.content}>
        {fileName && (
          <Text
            style={[
              styles.fileName,
              { color: isOwnMessage ? "white" : "#1f2937" },
            ]}
            numberOfLines={1}
          >
            🎵 {fileName}
          </Text>
        )}

        <View style={styles.progressRow}>
          <Text
            style={[
              styles.timeText,
              { color: isOwnMessage ? "rgba(255,255,255,0.8)" : "#6b7280" },
            ]}
          >
            {formatTime(player?.currentTime || 0)}
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: isOwnMessage
                    ? "rgba(255,255,255,0.5)"
                    : "#7c3aed",
                  width: `${Math.max(2, getProgress())}%`,
                  opacity: !player ? 0.5 : 1,
                },
              ]}
            />
          </View>

          <Text
            style={[
              styles.timeText,
              { color: isOwnMessage ? "rgba(255,255,255,0.8)" : "#6b7280" },
            ]}
          >
            {formatTime(totalDuration || 0)}
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Stop Button */}
      {player?.playing && (
        <TouchableOpacity
          onPress={handleStop}
          style={[
            styles.stopButton,
            {
              backgroundColor: isOwnMessage
                ? "rgba(255,255,255,0.2)"
                : "#e5e7eb",
            },
          ]}
        >
          <FontAwesome
            name="stop"
            size={10}
            color={isOwnMessage ? "white" : "#666"}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 240,
    maxWidth: 300,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
    minWidth: 32,
    textAlign: "center",
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    minWidth: 2,
  },
  stopButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  errorText: {
    fontSize: 11,
    color: "#dc2626",
    marginTop: 4,
    fontWeight: "500",
  },
  loadingText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
});

export default AudioPlayer;
