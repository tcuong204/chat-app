import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MediaStream, RTCView } from "react-native-webrtc";
import { voiceCallService } from "../utils/voiceCallService";

interface VoiceCallInterfaceProps {
  targetUserId: string;
  targetUserName: string;
  onEndCall: () => void;
  isIncoming?: boolean;
  isVideo?: boolean;
}

export const VoiceCallInterface: React.FC<VoiceCallInterfaceProps> = ({
  targetUserId,
  targetUserName,
  onEndCall,
  isIncoming = false,
  isVideo = false,
}) => {
  const router = useRouter();
  // Add video-specific state
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(true);
  const [callState, setCallState] = useState<
    "connecting" | "ringing" | "active" | "ended"
  >("connecting");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isIncoming) {
      setCallState("ringing");
    } else {
      startCall();
    }

    // Listen for remote stream changes
    const handleRemoteStreamUpdate = (stream: MediaStream | null) => {
      console.log(
        "Remote stream updated:",
        stream ? "Available" : "Not available"
      );
      setRemoteStream(stream);
      setIsRemoteVideoEnabled(stream !== null);
    };

    voiceCallService.onRemoteStreamUpdate = handleRemoteStreamUpdate;

    return () => {
      voiceCallService.onRemoteStreamUpdate = null;
    };
  }, []);

  useEffect(() => {
    if (callState === "ringing") {
      // Start pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [callState, pulseAnim]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callState === "active") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  const startCall = async () => {
    try {
      setIsConnecting(true);

      // Set up call state and error handlers
      voiceCallService.onCallStateChanged = (state) => {
        if (state.state === "active") {
          setCallState("active");
        } else if (state.state === "ended") {
          setCallState("ended");
          setTimeout(() => {
            onEndCall();
            router.back(); // Return to messages screen when call ends
          }, 1000);
        }
      };

      voiceCallService.onError = (error) => {
        Alert.alert("Lỗi cuộc gọi", error.message);
        onEndCall();
      };

      if (isVideo) {
        // Start video call with proper facing mode
        await voiceCallService.startVideoCall(
          targetUserId,
          isFrontCamera ? "front" : "back"
        );
      } else {
        // Start voice call
        await voiceCallService.startCall(targetUserId);
      }
      setCallState("ringing");
    } catch (error) {
      Alert.alert("Lỗi", "Không thể thực hiện cuộc gọi. Vui lòng thử lại.");
      onEndCall();
    } finally {
      setIsConnecting(false);
    }
  };

  const answerCall = async () => {
    try {
      setCallState("active");
      await voiceCallService.answerCall();

      // Listen for call state changes
      voiceCallService.onCallStateChanged = (state) => {
        if (state.state === "ended") {
          setCallState("ended");
          setTimeout(() => onEndCall(), 1000);
        }
      };
    } catch (error) {
      Alert.alert("Lỗi", "Không thể trả lời cuộc gọi.");
      onEndCall();
    }
  };

  const declineCall = () => {
    voiceCallService.declineCall(voiceCallService.getCallState().callId || "");
    // Navigate back to messages
    onEndCall();
    router.back(); // Return to messages screen
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    try {
      voiceCallService.toggleMute();
    } catch (error) {
      console.log("Toggle mute error:", error);
    }
  };

  const toggleSpeaker = () => {
    const newSpeakerState = !isSpeakerOn;
    setIsSpeakerOn(newSpeakerState);
    try {
      voiceCallService.toggleSpeaker();
    } catch (error) {
      console.log("Toggle speaker error:", error);
    }
  };

  const endCall = () => {
    voiceCallService.hangupCall();
    onEndCall();
    router.back(); // Return to messages screen
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getCallStatusText = () => {
    switch (callState) {
      case "connecting":
        return "Đang kết nối...";
      case "ringing":
        return isIncoming ? "Cuộc gọi đến" : "Đang gọi...";
      case "active":
        return "Đã kết nối";
      case "ended":
        return "Cuộc gọi kết thúc";
      default:
        return "";
    }
  };

  const getCallStatusColor = () => {
    switch (callState) {
      case "connecting":
        return "#FFA500";
      case "ringing":
        return "#FF6B6B";
      case "active":
        return "#4CAF50";
      case "ended":
        return "#9E9E9E";
      default:
        return "#FF6B6B";
    }
  };

  const handleToggleVideo = () => {
    if (voiceCallService.toggleVideo()) {
      setIsVideoEnabled(true);
    } else {
      setIsVideoEnabled(false);
    }
  };

  const handleSwitchCamera = async () => {
    if (await voiceCallService.switchCamera()) {
      setIsFrontCamera(!isFrontCamera);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.container, isVideo && styles.videoContainer]}
      >
        <LinearGradient
          colors={["#333333", "#7A7A7A"]}
          start={{ x: 0.5, y: 0 }} // giữa trên
          end={{ x: 0.5, y: 1 }} // giữa dưới
          className="flex-1"
        >
          <Stack.Screen options={{ headerShown: false }} />
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onEndCall}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.callType}>
                {isVideo ? "Cuộc gọi video" : "Cuộc gọi thoại"}
              </Text>
              <Text style={styles.encrypted}>Đã mã hóa</Text>
            </View>
            <View style={styles.headerIcons}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>🍋</Text>
              </View>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>⏱️</Text>
              </View>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>✈️</Text>
              </View>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>🐻</Text>
              </View>
            </View>
          </View>

          {/* Video Elements */}
          {isVideo && callState === "active" && (
            <View style={styles.videoWrapper}>
              {/* Remote Video */}
              <View style={styles.remoteVideo}>
                {remoteStream ? (
                  <RTCView
                    streamURL={remoteStream.toURL()}
                    style={[
                      styles.videoElement,
                      !isRemoteVideoEnabled && styles.videoDisabled,
                    ]}
                    objectFit="cover"
                  />
                ) : (
                  <View style={styles.noVideoOverlay}>
                    <Ionicons name="videocam-off" size={32} color="#FFF" />
                    <Text style={styles.waitingText}>
                      Đang chờ kết nối video...
                    </Text>
                  </View>
                )}
              </View>{" "}
              {/* Local Video (PiP) */}
              <View style={styles.localVideoWrapper}>
                <View
                  id="localVideo"
                  style={[
                    styles.localVideo,
                    !isVideoEnabled && styles.videoDisabled,
                  ]}
                />
                {!isVideoEnabled && (
                  <View style={styles.localVideoOverlay}>
                    <Ionicons name="videocam-off" size={24} color="#FFF" />
                    <Text style={styles.localVideoOverlayText}>
                      Camera đã tắt
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Main Content */}

          <View style={styles.mainContent}>
            {/* Profile Picture and Call Info - Only show when no remote video */}
            {(!isVideo || !remoteStream || !isRemoteVideoEnabled) && (
              <View style={styles.profileSection}>
                <Animated.View
                  style={[
                    styles.profilePicture,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <Text style={styles.profileInitial}>
                    {targetUserName.charAt(0).toUpperCase()}
                  </Text>
                </Animated.View>

                {/* Call Status */}
                <View style={styles.callStatusContainer}>
                  <View
                    style={[
                      styles.statusIndicator,
                      { backgroundColor: getCallStatusColor() },
                    ]}
                  />
                  <Text style={styles.callStatusText}>
                    {getCallStatusText()}
                  </Text>
                </View>

                {/* Call Duration */}
                {callState === "active" && (
                  <Text style={styles.callDuration}>
                    {formatDuration(callDuration)}
                  </Text>
                )}

                {/* User Name */}
                <Text style={styles.userName}>{targetUserName}</Text>
              </View>
            )}
          </View>

          {/* Call Controls */}
          <View style={styles.controlsContainer}>
            {isIncoming && callState === "ringing" ? (
              // Incoming call controls
              <>
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={declineCall}
                >
                  <Ionicons name="call" size={24} color="white" />
                  <Text style={styles.buttonText}>Từ chối</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.answerButton}
                  onPress={answerCall}
                >
                  <Ionicons name="call" size={24} color="white" />
                  <Text style={styles.buttonText}>Trả lời</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Active call controls
              <View
                className="flex flex-row items-center  rounded-xl justify-between w-[90%]"
                style={{ backgroundColor: "#3D3D3A" }}
              >
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={endCall}
                >
                  <Ionicons name="call" size={24} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlButton]}
                  onPress={toggleMute}
                >
                  <Ionicons
                    name={isMuted ? "mic-off" : "mic"}
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlButton]}
                  onPress={toggleSpeaker}
                >
                  <Ionicons
                    name={isSpeakerOn ? "volume-high" : "volume-low"}
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>

                {/* Video Call Controls */}
                {isVideo && (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.videoControlButton,
                        !isVideoEnabled && styles.videoDisabledButton,
                      ]}
                      onPress={handleToggleVideo}
                    >
                      <View style={styles.videoIconWrapper}>
                        <Ionicons
                          name={isVideoEnabled ? "videocam" : "videocam-off"}
                          size={28}
                          color={!isVideoEnabled ? "#FF6B6B" : "#4CAF50"}
                        />
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={handleSwitchCamera}
                    >
                      <Ionicons
                        name="camera-reverse"
                        size={24}
                        color="#2196F3"
                      />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </LinearGradient>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoControlButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    padding: 12,
  },
  videoDisabledButton: {
    backgroundColor: "rgba(255,0,0,0.2)",
  },
  videoIconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  videoDisabledIndicator: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  videoDisabledText: {
    color: "#FF6B6B",
    fontSize: 12,
    fontWeight: "bold",
  },
  videoContainer: {
    backgroundColor: "#000", // Black background for video calls
  },
  videoWrapper: {
    flex: 1,
    position: "relative",
  },
  remoteVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoElement: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  noVideoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  waitingText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "500",
  },
  remoteVideoText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  localVideoWrapper: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    overflow: "hidden",
  },
  localVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1E1E1E",
  },
  videoDisabled: {
    opacity: 0.5,
  },
  localVideoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  localVideoOverlayText: {
    color: "#FFF",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    alignItems: "center",
  },
  callType: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  encrypted: {
    color: "#4CAF50",
    fontSize: 12,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: "row",
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 16,
  },
  mainContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  profileInitial: {
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
  },
  callStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  callStatusText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  callDuration: {
    color: "#4CAF50",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  userName: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  reactionsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  reactionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  controlButton: {
    padding: 15,
    alignItems: "center",
  },
  activeControlButton: {
    backgroundColor: "rgba(76, 175, 80, 0.2)",
  },
  declineButton: {
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#FF6B6B",
    minWidth: 80,
  },
  answerButton: {
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    minWidth: 80,
  },
  buttonText: {
    color: "white",
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
  activeButtonText: {
    color: "#4CAF50",
  },
});
