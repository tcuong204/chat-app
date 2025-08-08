import { LOCALIP } from "@/constants/localIp";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { AudioSource, useAudioPlayer } from "expo-audio";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface AudioPlayerProps {
  audioUrl: string;
  fileName?: string;
  isOwnMessage: boolean;
  duration?: number; // duration từ server nếu có (seconds)
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
  const replaceVideohost = (url: string | undefined) => {
    // Thay localhost bằng IP thực của máy (VD: 192.168.1.100)
    return url
      ?.replace("download", "preview")
      .replace("localhost:3000", LOCALIP); // Thay IP này
  };
  const refactUrl = replaceVideohost(audioUrl);
  // Create audio source
  console.log(refactUrl);

  const audioSource: AudioSource = { uri: refactUrl };

  // Use expo-audio hook (second arg is initial volume)
  const player = useAudioPlayer(audioSource, 1.0);
  console.log(player);

  // Debug logs
  // Listen to player events
  useEffect(() => {
    const subscription = player.addListener(
      "playbackStatusUpdate",
      (status) => {
        console.log("🎵 Playback status:", status);

        if (status.duration && !totalDuration) {
          setTotalDuration(status.duration);
        }

        // Note: AudioStatus may not contain an error field; handle errors via try/catch around player actions
      }
    );

    return () => {
      subscription?.remove();
    };
  }, [player, totalDuration]);

  // Cleanup when unmount
  useEffect(() => {
    return () => {
      console.log("🎵 AudioPlayer cleanup");
      try {
        player.remove();
      } catch (e) {
        console.warn("🎵 Cleanup warning:", e);
      }
    };
  }, [player]);

  const handlePlayPause = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("🎵 Play/Pause clicked, current playing:", player.playing);

      if (player.playing) {
        console.log("🎵 Pausing audio");
        player.pause();
      } else {
        console.log("🎵 Playing audio");
        player.play();
      }
    } catch (error) {
      console.error("🎵 Error playing/pausing audio:", error);
      setError("Không thể phát âm thanh");
      Alert.alert("Lỗi", "Không thể phát file âm thanh này");
    } finally {
      setIsLoading(false);
    }
  }, [player]);

  const handleStop = useCallback(() => {
    console.log("🎵 Stopping audio");
    try {
      player.seekTo(0);
      player.pause();
    } catch (error) {
      console.error("🎵 Error stopping audio:", error);
    }
  }, [player]);

  // Format time từ seconds sang mm:ss
  const formatTime = useCallback((timeSeconds: number) => {
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Tính progress percentage
  const getProgress = useCallback(() => {
    if (!totalDuration || totalDuration === 0) return 0;
    return (player.currentTime / totalDuration) * 100;
  }, [player.currentTime, totalDuration]);

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
        disabled={isLoading}
        style={[
          styles.playButton,
          {
            backgroundColor: isOwnMessage
              ? "rgba(255, 255, 255, 0.3)"
              : "#7c3aed",
          },
        ]}
      >
        {isLoading ? (
          <FontAwesome name="spinner" size={18} color="white" />
        ) : player.playing ? (
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

      {/* Audio Info và Progress */}
      <View style={styles.content}>
        {/* File name nếu có */}
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

        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <Text
            style={[
              styles.timeText,
              { color: isOwnMessage ? "rgba(255,255,255,0.8)" : "#6b7280" },
            ]}
          >
            {formatTime(player.currentTime || 0)}
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

        {/* Error message */}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Stop Button */}
      {player.playing && (
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
});

export default AudioPlayer;
