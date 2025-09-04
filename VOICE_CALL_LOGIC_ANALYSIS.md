# Hướng dẫn Tích hợp và Sử dụng Tính năng Gọi điện Voice/Video

## Tổng quan

Ứng dụng chat này đã tích hợp chức năng gọi điện voice/video sử dụng công nghệ WebRTC với SignalR qua Socket.IO. Hệ thống bao gồm:

- **Voice Call Service**: Xử lý logic WebRTC và quản lý cuộc gọi (`utils/voiceCallService.ts`)
- **UI Interface**: Giao diện người dùng cho cuộc gọi (`components/VoiceCallInterface.tsx`)
- **Socket Integration**: Kết nối real-time với backend NestJS
- **Test Application**: Ứng dụng test độc lập trong thư mục `test-app/`

## Kiến trúc hệ thống

### 1. **Backend (NestJS)**

- WebSocket Gateway cho signaling
- Authentication qua JWT token
- Quản lý trạng thái cuộc gọi
- ICE candidate exchange

### 2. **Frontend (React Native)**

- WebRTC PeerConnection
- MediaStream management
- Socket.IO client
- UI components

### 3. **Test Environment**

- HTML test app với đầy đủ chức năng
- Authentication service
- Debug tools và network analysis

## Logic Flow của Cuộc gọi

### 1. **Khởi tạo và Kết nối**

```javascript
// 1. Kết nối Socket.IO với authentication
await voiceCallService.connect(serverUrl, userId, authToken);

// 2. Setup WebRTC configuration
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Multiple STUN servers for reliability
  ],
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  iceCandidatePoolSize: 10,
};
```

### 2. **Bắt đầu Cuộc gọi (Caller)**

```javascript
// 1. Tạo offer và gửi qua socket
async startCall(targetUserId, isVideoCall = false) {
  // Setup local media stream
  this.localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: isVideoCall
  });

  // Create peer connection
  this.peerConnection = new RTCPeerConnection(this.config);

  // Add local stream
  this.localStream.getTracks().forEach(track => {
    this.peerConnection.addTrack(track, this.localStream);
  });

  // Create and send offer
  const offer = await this.peerConnection.createOffer();
  await this.peerConnection.setLocalDescription(offer);

  // Send via socket
  this.socket.emit('call:initiate', {
    targetUserId,
    callType: isVideoCall ? 'video' : 'voice',
    sdpOffer: offer
  });
}
```

### 3. **Nhận Cuộc gọi (Callee)**

```javascript
// Listen for incoming calls
this.socket.on('call:incoming', (callData) => {
  // Show incoming call UI
  this.showIncomingCallModal(callData);

  // Store call data
  this.incomingCallData = callData;
});

// Answer call
async answerCall() {
  const callData = this.incomingCallData;

  // Setup local media
  this.localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: callData.callType === 'video'
  });

  // Setup peer connection
  this.setupPeerConnection();

  // Set remote description from offer
  await this.peerConnection.setRemoteDescription(callData.sdpOffer);

  // Create answer
  const answer = await this.peerConnection.createAnswer();
  await this.peerConnection.setLocalDescription(answer);

  // Send answer via socket
  this.socket.emit('call:accept', {
    callId: callData.callId,
    sdpAnswer: answer
  });
}
```

### 4. **ICE Candidate Exchange**

```javascript
// Send ICE candidates
this.peerConnection.onicecandidate = (event) => {
  if (event.candidate && this.currentCallId) {
    this.socket.emit("call:ice-candidate", {
      callId: this.currentCallId,
      candidate: event.candidate,
    });
  }
};

// Receive ICE candidates
this.socket.on("call:ice-candidate", (data) => {
  if (this.peerConnection && data.candidate) {
    this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});
```

## Các Chức năng Chi tiết

### 1. **Voice Call**

```javascript
// Bắt đầu cuộc gọi voice
await voiceCallService.startCall(targetUserId, false);

// Controls trong cuộc gọi
voiceCallService.toggleMute(); // Bật/tắt micro
voiceCallService.toggleSpeaker(); // Bật/tắt loa ngoài
voiceCallService.hangupCall(); // Kết thúc cuộc gọi
```

### 2. **Video Call**

```javascript
// Bắt đầu cuộc gọi video
await voiceCallService.startCall(targetUserId, true);

// Video controls
voiceCallService.toggleVideo(); // Bật/tắt camera
voiceCallService.switchCamera(); // Chuyển camera trước/sau

// Video elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

localVideo.srcObject = voiceCallService.localStream;
remoteVideo.srcObject = voiceCallService.remoteStream;
```

### 3. **Trạng thái Cuộc gọi**

```javascript
// Lắng nghe thay đổi trạng thái
voiceCallService.onCallStateChanged = (state) => {
  switch (state) {
    case "idle": // Không có cuộc gọi
    case "initiating": // Đang khởi tạo
    case "ringing": // Đang đổ chuông
    case "connecting": // Đang kết nối
    case "active": // Cuộc gọi đang diễn ra
    case "ended": // Cuộc gọi kết thúc
  }
};
```

## Socket Events

### 1. **Outgoing Events (Client → Server)**

```javascript
// Khởi tạo cuộc gọi
socket.emit("call:initiate", {
  targetUserId: string,
  callType: "voice" | "video",
  sdpOffer: RTCSessionDescription,
});

// Chấp nhận cuộc gọi
socket.emit("call:accept", {
  callId: string,
  sdpAnswer: RTCSessionDescription,
});

// Từ chối cuộc gọi
socket.emit("call:decline", {
  callId: string,
});

// Kết thúc cuộc gọi
socket.emit("call:hangup", {
  callId: string,
});

// Gửi ICE candidate
socket.emit("call:ice-candidate", {
  callId: string,
  candidate: RTCIceCandidate,
});
```

### 2. **Incoming Events (Server → Client)**

```javascript
// Cuộc gọi đến
socket.on("call:incoming", (data) => {
  // data: { callId, callerId, callerName, callType, sdpOffer }
});

// Cuộc gọi được chấp nhận
socket.on("call:accepted", (data) => {
  // data: { callId, sdpAnswer }
});

// Cuộc gọi bị từ chối
socket.on("call:declined", (data) => {
  // data: { callId, reason }
});

// Cuộc gọi kết thúc
socket.on("call:ended", (data) => {
  // data: { callId, reason }
});

// Nhận ICE candidate
socket.on("call:ice-candidate", (data) => {
  // data: { callId, candidate }
});
```

## Authentication

### 1. **JWT Token**

```javascript
// Login để lấy token
const authService = new AuthService(serverUrl);
const { accessToken, user } = await authService.login(phoneNumber, password);

// Sử dụng token cho Socket.IO
await voiceCallService.connect(serverUrl, user.id, accessToken);
```

### 2. **Socket Authentication**

```javascript
const socketOptions = {
  auth: {
    token: authToken,
    userId: userId,
    deviceId: "unique-device-id",
    deviceType: "mobile",
    platform: "react-native",
  },
  extraHeaders: {
    Authorization: `Bearer ${authToken}`,
  },
};
```

## Testing và Debug

### 1. **Test Application**

Trong thư mục `test-app/` có sẵn ứng dụng test HTML với đầy đủ chức năng:

- `voice-call-test.html`: Giao diện test
- `voice-call-service.js`: Service logic
- `voice-call-app.js`: UI controller
- `auth-service.js`: Authentication

### 2. **Debug Tools**

```javascript
// Kiểm tra trạng thái WebRTC
const debugInfo = voiceCallService.getDebugInfo();
console.log("ICE Connection State:", debugInfo.iceConnectionState);
console.log("Call State:", debugInfo.callState);

// Network analysis
await voiceCallService.analyzeNetworkConfig();

// Test microphone
await voiceCallService.testMicrophone();

// Test camera
await voiceCallService.testCamera();
```

### 3. **Common Issues**

```javascript
// WSL/Docker IP detection
if (voiceCallService.isWSLInterface(ip)) {
  console.warn("WSL interface detected - may cause connectivity issues");
}

// Permission check
const permissions = await voiceCallService.checkPermissions();
if (permissions.microphone !== "granted") {
  console.error("Microphone permission required");
}
```

## Production Deployment

### 1. **STUN/TURN Servers**

```javascript
const productionConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:your-turn-server.com:3478",
      username: "your-username",
      credential: "your-password",
    },
  ],
};
```

### 2. **Error Handling**

```javascript
voiceCallService.onError = (error) => {
  console.error("Call error:", error);

  // Show user-friendly message
  switch (error.type) {
    case "PERMISSION_DENIED":
      showToast("Vui lòng cấp quyền microphone/camera");
      break;
    case "NETWORK_ERROR":
      showToast("Lỗi kết nối mạng");
      break;
    case "WEBRTC_ERROR":
      showToast("Lỗi kỹ thuật, vui lòng thử lại");
      break;
  }
};
```

### 3. **Performance Optimization**

```javascript
// Cleanup resources
voiceCallService.cleanup = () => {
  if (this.localStream) {
    this.localStream.getTracks().forEach((track) => track.stop());
  }
  if (this.peerConnection) {
    this.peerConnection.close();
  }
  if (this.audioContext) {
    this.audioContext.close();
  }
};

// Memory management
window.addEventListener("beforeunload", () => {
  voiceCallService.cleanup();
});
```

## Tài liệu tham khảo

1. [WebRTC Documentation](https://webrtc.org/getting-started/overview)
2. [React Native WebRTC](https://github.com/react-native-webrtc/react-native-webrtc)
3. [Socket.IO Client API](https://socket.io/docs/v4/client-api/)
4. [NestJS WebSocket Gateway](https://docs.nestjs.com/websockets/gateways)
5. [Expo AV Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
