# 📞 Voice/Video Call Integration Guide for Frontend

## Tổng Quan

Tài liệu này hướng dẫn frontend tích hợp chức năng gọi voice/video với chat application backend sử dụng WebRTC và Socket.IO signaling.

## 🔧 Kiến Trúc Hệ Thống

```
Frontend (React/React Native) ←→ Socket.IO ←→ NestJS Backend ←→ Redis/MongoDB
                ↕
           WebRTC P2P Connection
```

## 📋 Yêu Cầu

### Dependencies

```json
{
  "socket.io-client": "^4.7.0",
  "webrtc-adapter": "^8.2.3"
}
```

### Permissions (React Native)

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

## 🚀 Setup Socket Connection

### 1. Kết Nối Socket.IO

```javascript
import io from "socket.io-client";

const socket = io("ws://localhost:3000/chat", {
  transports: ["websocket", "polling"],
  auth: {
    token: "your-jwt-token",
    deviceId: "unique-device-id",
    deviceType: "mobile", // hoặc 'web'
    platform: "android", // hoặc 'ios', 'web'
  },
});

// Xử lý kết nối
socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});
```

### 2. WebRTC Configuration

```javascript
const pcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Thêm TURN servers nếu cần
    {
      urls: "turn:your-turn-server:3478",
      username: "username",
      credential: "password",
    },
  ],
  iceCandidatePoolSize: 10,
};
```

## 📱 Call Management Class

### CallManager.js

```javascript
class CallManager {
  constructor(socket, userId) {
    this.socket = socket;
    this.userId = userId;
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.currentCall = null;
    this.callState = "idle"; // 'idle', 'initiating', 'ringing', 'connected', 'ended'

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    // Nhận cuộc gọi đến
    this.socket.on("call:incoming", this.handleIncomingCall.bind(this));

    // Cuộc gọi được chấp nhận
    this.socket.on("call:accepted", this.handleCallAccepted.bind(this));

    // Cuộc gọi bị từ chối
    this.socket.on("call:declined", this.handleCallDeclined.bind(this));

    // Cuộc gọi kết thúc
    this.socket.on("call:ended", this.handleCallEnded.bind(this));

    // Nhận ICE candidate
    this.socket.on("call:ice_candidate", this.handleIceCandidate.bind(this));

    // Media state thay đổi
    this.socket.on(
      "call:media_state_changed",
      this.handleMediaStateChanged.bind(this)
    );

    // Timeout cuộc gọi
    this.socket.on("call:timeout", this.handleCallTimeout.bind(this));

    // Lỗi cuộc gọi
    this.socket.on("call:error", this.handleCallError.bind(this));

    // Xác nhận các action
    this.socket.on("call:initiated", this.handleCallInitiated.bind(this));
    this.socket.on(
      "call:accept_confirmed",
      this.handleAcceptConfirmed.bind(this)
    );
    this.socket.on(
      "call:decline_confirmed",
      this.handleDeclineConfirmed.bind(this)
    );
    this.socket.on(
      "call:hangup_confirmed",
      this.handleHangupConfirmed.bind(this)
    );
  }

  // Bắt đầu cuộc gọi
  async initiateCall(targetUserId, callType = "video", conversationId = null) {
    try {
      this.callState = "initiating";

      // Lấy media stream
      this.localStream = await this.getLocalStream(callType);

      // Tạo peer connection
      this.peerConnection = new RTCPeerConnection(pcConfig);
      this.setupPeerConnection();

      // Thêm local stream
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Tạo SDP offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Gửi call initiate
      this.socket.emit("call:initiate", {
        targetUserId,
        callType,
        sdpOffer: {
          type: "offer",
          sdp: offer.sdp,
        },
        conversationId,
      });

      return true;
    } catch (error) {
      console.error("Failed to initiate call:", error);
      this.cleanup();
      throw error;
    }
  }

  // Chấp nhận cuộc gọi
  async acceptCall(callData) {
    try {
      this.callState = "connected";
      this.currentCall = callData;

      // Lấy media stream
      this.localStream = await this.getLocalStream(callData.callType);

      // Tạo peer connection
      this.peerConnection = new RTCPeerConnection(pcConfig);
      this.setupPeerConnection();

      // Thêm local stream
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Set remote description từ offer
      await this.peerConnection.setRemoteDescription(callData.sdpOffer);

      // Tạo answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Gửi accept với SDP answer
      this.socket.emit("call:accept", {
        callId: callData.callId,
        sdpAnswer: {
          type: "answer",
          sdp: answer.sdp,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to accept call:", error);
      this.declineCall(callData.callId, "technical_error");
      throw error;
    }
  }

  // Từ chối cuộc gọi
  declineCall(callId, reason = "declined") {
    this.socket.emit("call:decline", {
      callId,
      reason,
    });
    this.callState = "idle";
  }

  // Kết thúc cuộc gọi
  hangupCall(reason = "completed") {
    if (this.currentCall) {
      this.socket.emit("call:hangup", {
        callId: this.currentCall.callId,
        reason,
      });
    }
    this.cleanup();
  }

  // Lấy local media stream
  async getLocalStream(callType) {
    const constraints = {
      audio: true,
      video: callType === "video" || callType === "group_video",
    };

    try {
      // Web
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return await navigator.mediaDevices.getUserMedia(constraints);
      }

      // React Native
      if (global.MediaStreamTrack && global.MediaStreamTrack.getSources) {
        // React Native WebRTC implementation
        return await navigator.mediaDevices.getUserMedia(constraints);
      }

      throw new Error("Media devices not supported");
    } catch (error) {
      console.error("Failed to get local stream:", error);
      throw error;
    }
  }

  // Setup peer connection events
  setupPeerConnection() {
    // ICE candidate
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentCall) {
        this.socket.emit("call:ice_candidate", {
          callId: this.currentCall.callId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          },
        });
      }
    };

    // Remote stream
    this.peerConnection.ontrack = (event) => {
      console.log("Received remote stream");
      this.remoteStream = event.streams[0];
      this.onRemoteStreamReceived &&
        this.onRemoteStreamReceived(this.remoteStream);
    };

    // Connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection.connectionState);
      this.onConnectionStateChanged &&
        this.onConnectionStateChanged(this.peerConnection.connectionState);
    };

    // ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        this.peerConnection.iceConnectionState
      );
      this.onIceConnectionStateChanged &&
        this.onIceConnectionStateChanged(
          this.peerConnection.iceConnectionState
        );
    };
  }

  // Socket event handlers
  handleIncomingCall(data) {
    console.log("Incoming call:", data);
    this.currentCall = data;
    this.callState = "ringing";
    this.onIncomingCall && this.onIncomingCall(data);
  }

  async handleCallAccepted(data) {
    console.log("Call accepted:", data);
    try {
      // Set remote description từ answer
      await this.peerConnection.setRemoteDescription(data.sdpAnswer);
      this.callState = "connected";
      this.onCallConnected && this.onCallConnected(data);
    } catch (error) {
      console.error("Failed to handle call accepted:", error);
    }
  }

  handleCallDeclined(data) {
    console.log("Call declined:", data);
    this.callState = "idle";
    this.cleanup();
    this.onCallDeclined && this.onCallDeclined(data);
  }

  handleCallEnded(data) {
    console.log("Call ended:", data);
    this.callState = "idle";
    this.cleanup();
    this.onCallEnded && this.onCallEnded(data);
  }

  async handleIceCandidate(data) {
    try {
      if (this.peerConnection && data.candidate) {
        const candidate = new RTCIceCandidate({
          candidate: data.candidate.candidate,
          sdpMLineIndex: data.candidate.sdpMLineIndex,
          sdpMid: data.candidate.sdpMid,
        });

        await this.peerConnection.addIceCandidate(candidate);
        console.log("Added ICE candidate");
      }
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  }

  handleMediaStateChanged(data) {
    console.log("Media state changed:", data);
    this.onMediaStateChanged && this.onMediaStateChanged(data);
  }

  handleCallTimeout(data) {
    console.log("Call timeout:", data);
    this.cleanup();
    this.onCallTimeout && this.onCallTimeout(data);
  }

  handleCallError(data) {
    console.error("Call error:", data);
    this.cleanup();
    this.onCallError && this.onCallError(data);
  }

  handleCallInitiated(data) {
    console.log("Call initiated:", data);
    this.currentCall = { callId: data.callId };
    this.onCallInitiated && this.onCallInitiated(data);
  }

  handleAcceptConfirmed(data) {
    console.log("Accept confirmed:", data);
    this.onAcceptConfirmed && this.onAcceptConfirmed(data);
  }

  handleDeclineConfirmed(data) {
    console.log("Decline confirmed:", data);
    this.cleanup();
    this.onDeclineConfirmed && this.onDeclineConfirmed(data);
  }

  handleHangupConfirmed(data) {
    console.log("Hangup confirmed:", data);
    this.cleanup();
    this.onHangupConfirmed && this.onHangupConfirmed(data);
  }

  // Media controls
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.updateMediaState();
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.updateMediaState();
        return videoTrack.enabled;
      }
    }
    return false;
  }

  updateMediaState() {
    if (this.currentCall && this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      const videoTrack = this.localStream.getVideoTracks()[0];

      this.socket.emit("call:media_state", {
        callId: this.currentCall.callId,
        audioEnabled: audioTrack ? audioTrack.enabled : false,
        videoEnabled: videoTrack ? videoTrack.enabled : false,
        screenSharingEnabled: false,
      });
    }
  }

  // Cleanup
  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.currentCall = null;
    this.callState = "idle";
  }

  // Getters
  getCallState() {
    return this.callState;
  }

  getCurrentCall() {
    return this.currentCall;
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }
}

export default CallManager;
```

## 🎯 React Component Example

### CallScreen.jsx

```jsx
import React, { useState, useEffect, useRef } from "react";
import CallManager from "./CallManager";

const CallScreen = ({ socket, userId, targetUserId }) => {
  const [callManager] = useState(() => new CallManager(socket, userId));
  const [callState, setCallState] = useState("idle");
  const [currentCall, setCurrentCall] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    // Setup call manager callbacks
    callManager.onIncomingCall = handleIncomingCall;
    callManager.onCallConnected = handleCallConnected;
    callManager.onCallEnded = handleCallEnded;
    callManager.onCallDeclined = handleCallDeclined;
    callManager.onCallError = handleCallError;
    callManager.onRemoteStreamReceived = handleRemoteStreamReceived;
    callManager.onConnectionStateChanged = handleConnectionStateChanged;

    return () => {
      callManager.cleanup();
    };
  }, []);

  const handleIncomingCall = (callData) => {
    setCurrentCall(callData);
    setCallState("ringing");
    // Hiển thị incoming call UI
  };

  const handleCallConnected = (data) => {
    setCallState("connected");
    // Update local video
    if (localVideoRef.current && callManager.getLocalStream()) {
      localVideoRef.current.srcObject = callManager.getLocalStream();
    }
  };

  const handleCallEnded = (data) => {
    setCallState("idle");
    setCurrentCall(null);
    // Clean up video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const handleCallDeclined = (data) => {
    setCallState("idle");
    setCurrentCall(null);
    alert(`Call declined: ${data.reason}`);
  };

  const handleCallError = (error) => {
    setCallState("idle");
    setCurrentCall(null);
    alert(`Call error: ${error.message}`);
  };

  const handleRemoteStreamReceived = (stream) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  };

  const handleConnectionStateChanged = (state) => {
    console.log("Connection state changed:", state);
  };

  const startVideoCall = async () => {
    try {
      await callManager.initiateCall(targetUserId, "video");
      setCallState("initiating");
    } catch (error) {
      alert("Failed to start call: " + error.message);
    }
  };

  const startVoiceCall = async () => {
    try {
      await callManager.initiateCall(targetUserId, "voice");
      setCallState("initiating");
    } catch (error) {
      alert("Failed to start call: " + error.message);
    }
  };

  const acceptCall = async () => {
    if (currentCall) {
      try {
        await callManager.acceptCall(currentCall);
      } catch (error) {
        alert("Failed to accept call: " + error.message);
      }
    }
  };

  const declineCall = () => {
    if (currentCall) {
      callManager.declineCall(currentCall.callId, "declined");
    }
  };

  const hangupCall = () => {
    callManager.hangupCall();
  };

  const toggleAudio = () => {
    const enabled = callManager.toggleAudio();
    setIsAudioEnabled(enabled);
  };

  const toggleVideo = () => {
    const enabled = callManager.toggleVideo();
    setIsVideoEnabled(enabled);
  };

  return (
    <div className="call-screen">
      {/* Call Controls */}
      {callState === "idle" && (
        <div className="call-controls">
          <button onClick={startVoiceCall}>📞 Voice Call</button>
          <button onClick={startVideoCall}>📹 Video Call</button>
        </div>
      )}

      {/* Incoming Call */}
      {callState === "ringing" && currentCall && (
        <div className="incoming-call">
          <h3>📞 Incoming {currentCall.callType} call</h3>
          <p>From: {currentCall.callerName}</p>
          <button onClick={acceptCall}>✅ Accept</button>
          <button onClick={declineCall}>❌ Decline</button>
        </div>
      )}

      {/* Active Call */}
      {(callState === "connected" || callState === "initiating") && (
        <div className="active-call">
          <div className="video-container">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="local-video"
            />
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
            />
          </div>

          <div className="call-controls">
            <button
              onClick={toggleAudio}
              className={isAudioEnabled ? "enabled" : "disabled"}
            >
              🎤 {isAudioEnabled ? "Mute" : "Unmute"}
            </button>

            <button
              onClick={toggleVideo}
              className={isVideoEnabled ? "enabled" : "disabled"}
            >
              📹 {isVideoEnabled ? "Stop Video" : "Start Video"}
            </button>

            <button onClick={hangupCall} className="hangup">
              📞 End Call
            </button>
          </div>
        </div>
      )}

      {/* Call State Display */}
      <div className="call-state">State: {callState}</div>
    </div>
  );
};

export default CallScreen;
```

## 📱 React Native Example

### CallManager.js (React Native)

```javascript
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
} from "react-native-webrtc";

class CallManagerRN extends CallManager {
  // Override getLocalStream for React Native
  async getLocalStream(callType) {
    const isFront = true;
    const constraints = {
      audio: true,
      video:
        callType === "video" || callType === "group_video"
          ? {
              mandatory: {
                minWidth: 500,
                minHeight: 300,
                minFrameRate: 30,
              },
              facingMode: isFront ? "user" : "environment",
            }
          : false,
    };

    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error) {
      console.error("Failed to get user media:", error);
      throw error;
    }
  }
}

export default CallManagerRN;
```

### CallScreen.jsx (React Native)

```jsx
import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { RTCView } from "react-native-webrtc";
import CallManagerRN from "./CallManagerRN";

const CallScreen = ({ socket, userId, targetUserId }) => {
  const [callManager] = useState(() => new CallManagerRN(socket, userId));
  const [callState, setCallState] = useState("idle");
  const [currentCall, setCurrentCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  useEffect(() => {
    // Setup callbacks
    callManager.onIncomingCall = handleIncomingCall;
    callManager.onCallConnected = handleCallConnected;
    callManager.onCallEnded = handleCallEnded;
    callManager.onRemoteStreamReceived = (stream) => setRemoteStream(stream);

    return () => callManager.cleanup();
  }, []);

  const handleIncomingCall = (callData) => {
    setCurrentCall(callData);
    setCallState("ringing");
  };

  const handleCallConnected = () => {
    setCallState("connected");
    setLocalStream(callManager.getLocalStream());
  };

  const handleCallEnded = () => {
    setCallState("idle");
    setCurrentCall(null);
    setLocalStream(null);
    setRemoteStream(null);
  };

  const startVideoCall = async () => {
    try {
      await callManager.initiateCall(targetUserId, "video");
      setCallState("initiating");
      setLocalStream(callManager.getLocalStream());
    } catch (error) {
      Alert.alert("Error", "Failed to start call: " + error.message);
    }
  };

  const acceptCall = async () => {
    try {
      await callManager.acceptCall(currentCall);
    } catch (error) {
      Alert.alert("Error", "Failed to accept call: " + error.message);
    }
  };

  const declineCall = () => {
    callManager.declineCall(currentCall?.callId, "declined");
  };

  const hangupCall = () => {
    callManager.hangupCall();
  };

  const toggleAudio = () => {
    const enabled = callManager.toggleAudio();
    setIsAudioEnabled(enabled);
  };

  const toggleVideo = () => {
    const enabled = callManager.toggleVideo();
    setIsVideoEnabled(enabled);
  };

  return (
    <View style={styles.container}>
      {callState === "idle" && (
        <View style={styles.callControls}>
          <TouchableOpacity style={styles.button} onPress={startVideoCall}>
            <Text>📹 Start Video Call</Text>
          </TouchableOpacity>
        </View>
      )}

      {callState === "ringing" && currentCall && (
        <View style={styles.incomingCall}>
          <Text style={styles.title}>
            📞 Incoming {currentCall.callType} call
          </Text>
          <Text>From: {currentCall.callerName}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.accept]}
              onPress={acceptCall}
            >
              <Text>✅ Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.decline]}
              onPress={declineCall}
            >
              <Text>❌ Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(callState === "connected" || callState === "initiating") && (
        <View style={styles.activeCall}>
          {/* Video Views */}
          <View style={styles.videoContainer}>
            {remoteStream && (
              <RTCView
                style={styles.remoteVideo}
                streamURL={remoteStream.toURL()}
              />
            )}
            {localStream && (
              <RTCView
                style={styles.localVideo}
                streamURL={localStream.toURL()}
                mirror={true}
              />
            )}
          </View>

          {/* Call Controls */}
          <View style={styles.callControls}>
            <TouchableOpacity
              style={[styles.controlButton, !isAudioEnabled && styles.disabled]}
              onPress={toggleAudio}
            >
              <Text>🎤</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, !isVideoEnabled && styles.disabled]}
              onPress={toggleVideo}
            >
              <Text>📹</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.hangup]}
              onPress={hangupCall}
            >
              <Text>📞</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.state}>State: {callState}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  callControls: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    margin: 10,
  },
  incomingCall: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "white",
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: 20,
  },
  accept: {
    backgroundColor: "#34C759",
  },
  decline: {
    backgroundColor: "#FF3B30",
  },
  activeCall: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    position: "relative",
  },
  remoteVideo: {
    flex: 1,
  },
  localVideo: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 8,
  },
  controlButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    margin: 10,
  },
  disabled: {
    backgroundColor: "rgba(255,0,0,0.5)",
  },
  hangup: {
    backgroundColor: "#FF3B30",
  },
  state: {
    color: "white",
    textAlign: "center",
    padding: 10,
  },
});

export default CallScreen;
```

## 🔧 Socket Events Reference

### Client → Server Events

#### 1. `call:initiate`

```javascript
socket.emit("call:initiate", {
  targetUserId: "string", // Required: ID của user cần gọi
  callType: "voice|video", // Required: Loại cuộc gọi
  sdpOffer: {
    // Required: SDP offer
    type: "offer",
    sdp: "string",
  },
  conversationId: "string", // Optional: ID conversation
});
```

#### 2. `call:accept`

```javascript
socket.emit("call:accept", {
  callId: "string", // Required: ID cuộc gọi
  sdpAnswer: {
    // Required: SDP answer
    type: "answer",
    sdp: "string",
  },
});
```

#### 3. `call:decline`

```javascript
socket.emit("call:decline", {
  callId: "string", // Required: ID cuộc gọi
  reason: "string", // Optional: Lý do từ chối
});
```

#### 4. `call:hangup`

```javascript
socket.emit("call:hangup", {
  callId: "string", // Required: ID cuộc gọi
  reason: "string", // Optional: Lý do kết thúc
});
```

#### 5. `call:icescandidate`

```javascript
socket.emit("call:ice_candidate", {
  callId: "string", // Required: ID cuộc gọi
  candidate: {
    // Required: ICE candidate
    candidate: "string",
    sdpMLineIndex: "number",
    sdpMid: "string",
  },
});
```

#### 6. `call:media_state`

```javascript
socket.emit("call:media_state", {
  callId: "string", // Required: ID cuộc gọi
  audioEnabled: "boolean", // Trạng thái audio
  videoEnabled: "boolean", // Trạng thái video
  screenSharingEnabled: "boolean", // Trạng thái chia sẻ màn hình
});
```

### Server → Client Events

#### 1. `call:incoming`

```javascript
socket.on("call:incoming", (data) => {
  // data: {
  //   callId: 'string',
  //   callerId: 'string',
  //   callerName: 'string',
  //   callerAvatar: 'string',
  //   callType: 'voice|video',
  //   sdpOffer: { type: 'offer', sdp: 'string' },
  //   conversationId: 'string'
  // }
});
```

#### 2. `call:accepted`

```javascript
socket.on("call:accepted", (data) => {
  // data: {
  //   callId: 'string',
  //   accepterId: 'string',
  //   sdpAnswer: { type: 'answer', sdp: 'string' },
  //   status: 'connected'
  // }
});
```

#### 3. `call:declined`

```javascript
socket.on("call:declined", (data) => {
  // data: {
  //   callId: 'string',
  //   declinerId: 'string',
  //   reason: 'string',
  //   status: 'declined'
  // }
});
```

#### 4. `call:ended`

```javascript
socket.on("call:ended", (data) => {
  // data: {
  //   callId: 'string',
  //   endedBy: 'string',
  //   reason: 'string',
  //   duration: 'number',
  //   status: 'ended'
  // }
});
```

#### 5. `call:ice_candidate`

```javascript
socket.on("call:ice_candidate", (data) => {
  // data: {
  //   callId: 'string',
  //   fromUserId: 'string',
  //   candidate: {
  //     candidate: 'string',
  //     sdpMLineIndex: 'number',
  //     sdpMid: 'string'
  //   }
  // }
});
```

#### 6. `call:error`

```javascript
socket.on("call:error", (error) => {
  // error: {
  //   message: 'string',
  //   code: 'string'
  // }
});
```

#### 7. `call:timeout`

```javascript
socket.on("call:timeout", (data) => {
  // data: {
  //   callId: 'string',
  //   reason: 'string'
  // }
});
```

## 🛠️ Error Handling

### Common Error Codes

- `AUTH_REQUIRED`: User chưa được xác thực
- `USER_NOT_FOUND`: User không tồn tại
- `INITIATE_FAILED`: Không thể khởi tạo cuộc gọi
- `ACCEPT_FAILED`: Không thể chấp nhận cuộc gọi
- `DECLINE_FAILED`: Không thể từ chối cuộc gọi
- `HANGUP_FAILED`: Không thể kết thúc cuộc gọi
- `ICE_CANDIDATE_FAILED`: Lỗi ICE candidate
- `MISSING_CALL_ID`: Thiếu call ID

### Error Handling Example

```javascript
callManager.onCallError = (error) => {
  switch (error.code) {
    case "AUTH_REQUIRED":
      // Redirect to login
      break;
    case "USER_NOT_FOUND":
      alert("User not found");
      break;
    case "INITIATE_FAILED":
      alert("Failed to start call. Please try again.");
      break;
    default:
      alert(`Call error: ${error.message}`);
  }
};
```

## 🔒 Security & Best Practices

### 1. Authentication

- Luôn xác thực user trước khi cho phép gọi
- Sử dụng JWT token cho authentication
- Validate user permissions

### 2. Media Permissions

```javascript
// Kiểm tra permissions trước khi bắt đầu call
async function checkPermissions() {
  try {
    // For web
    if (navigator.permissions) {
      const camera = await navigator.permissions.query({ name: "camera" });
      const microphone = await navigator.permissions.query({
        name: "microphone",
      });

      return camera.state === "granted" && microphone.state === "granted";
    }

    // For React Native - check with native modules
    return true;
  } catch (error) {
    console.error("Permission check failed:", error);
    return false;
  }
}
```

### 3. Connection Quality

```javascript
// Monitor connection quality
callManager.onIceConnectionStateChanged = (state) => {
  switch (state) {
    case "disconnected":
      showConnectionWarning();
      break;
    case "failed":
      showConnectionError();
      break;
    case "connected":
      hideConnectionWarnings();
      break;
  }
};
```

### 4. Cleanup

- Luôn cleanup resources khi kết thúc call
- Stop media tracks để giải phóng camera/microphone
- Close peer connections

## 📊 Testing & Debugging

### 1. Debug Mode

```javascript
// Enable debug logging
const callManager = new CallManager(socket, userId);
callManager.debug = true;
```

### 2. Connection Test

```javascript
// Test STUN/TURN servers
async function testIceServers() {
  const pc = new RTCPeerConnection({ iceServers: pcConfig.iceServers });

  return new Promise((resolve) => {
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        resolve(pc.iceGatheringState === "complete");
      }
    };

    pc.createDataChannel("test");
    pc.createOffer().then((offer) => pc.setLocalDescription(offer));
  });
}
```

### 3. Network Quality Monitoring

```javascript
// Monitor network quality
setInterval(() => {
  if (callManager.peerConnection) {
    callManager.peerConnection.getStats().then((stats) => {
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          console.log("Video quality:", {
            packetsLost: report.packetsLost,
            packetsReceived: report.packetsReceived,
            bytesReceived: report.bytesReceived,
          });
        }
      });
    });
  }
}, 5000);
```

## 🚀 Deployment Notes

### Production Configuration

1. **STUN/TURN Servers**: Cấu hình TURN servers cho production
2. **SSL/TLS**: Bắt buộc HTTPS cho WebRTC
3. **Firewall**: Mở ports cần thiết
4. **Load Balancing**: Sticky sessions cho Socket.IO

### Performance Optimization

1. **Video Quality**: Tự động điều chỉnh theo bandwidth
2. **Audio Codec**: Sử dụng Opus codec
3. **Bandwidth Adaptation**: Implement adaptive bitrate

---

Tài liệu này cung cấp đầy đủ thông tin để frontend tích hợp chức năng gọi voice/video. Hãy tham khảo các example code và implement theo từng bước để đảm bảo tính ổn định của hệ thống.
