import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Camera } from "expo-camera";
import Constants from "expo-constants";
import type { PermissionStatus } from "expo-modules-core";
import { Platform } from "react-native";
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
} from "react-native-webrtc";
import { io, Socket } from "socket.io-client";

// WebRTC objects are imported from react-native-webrtc above

// Types
interface CallData {
  callId: string;
  callerId: string;
  callerName?: string;
  callerAvatar?: string;
  callType: "voice" | "video";
  sdpOffer?: RTCSessionDescriptionInit;
  sdpAnswer?: RTCSessionDescriptionInit;
  conversationId?: string;
}

interface CallState {
  callId: string | null;
  state: "idle" | "initiating" | "ringing" | "connecting" | "active" | "ended";
  isInitiator: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
}

interface DebugInfo {
  localDescription: string;
  remoteDescription: string;
  iceConnectionState: string;
  callId: string | null;
  callState: string;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  facingMode: "user" | "environment" | "unknown";
}

interface MediaPermissions {
  camera: PermissionStatus;
  microphone: PermissionStatus;
}

export class VoiceCallService {
  // WebRTC Components
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  // Socket Connection
  private socket: Socket | null = null;
  public isConnected: boolean = false;
  public onDisconnect: (() => void) | null = null;

  // Call State
  private currentCallId: string | null = null;
  private callState: CallState["state"] = "idle";
  private isInitiator: boolean = false;
  private isMuted: boolean = false;
  private isSpeakerOn: boolean = false;

  // Video Call State
  public isVideoCall: boolean = false;
  private isVideoEnabled: boolean = true;
  private currentFacingMode: "user" | "environment" = "user";

  // ICE Candidate Queues
  private iceCandidateQueue: RTCIceCandidate[] = [];
  private remoteIceCandidateQueue: RTCIceCandidate[] = [];

  // Store incoming call data
  private incomingCallData: CallData | null = null;

  // Audio Context for visualization
  private audioContext: AudioContext | null = null;

  // WebRTC availability flag
  private webRTCInitialized: boolean = false;
  private webRTCInitializationPromise: Promise<void> | null = null;

  // Configuration
  private config: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceCandidatePoolSize: 10,
  };

  // Event callbacks
  public onCallStateChanged: ((state: CallState) => void) | null = null;
  public onIncomingCall: ((callData: CallData) => void) | null = null;
  public onCallEnded: (() => void) | null = null;
  public onError: ((error: { message: string; code?: string }) => void) | null =
    null;
  public onDebugUpdate: ((debugInfo: DebugInfo) => void) | null = null;
  public onRemoteStreamUpdate: ((stream: MediaStream | null) => void) | null =
    null;

  constructor() {
    this.setupAudioSession();
    this.initializeWebRTC();
  }

  /**
   * Initialize WebRTC components
   */
  private async initializeWebRTC(): Promise<void> {
    if (this.webRTCInitializationPromise) {
      return this.webRTCInitializationPromise;
    }

    this.webRTCInitializationPromise = this._initializeWebRTC();
    return this.webRTCInitializationPromise;
  }

  private async _initializeWebRTC(): Promise<void> {
    try {
      this.log("info", "Initializing WebRTC...");

      // Check if we're in a development build or Expo Go
      if (Platform.OS === "web") {
        // Web platform - WebRTC should be available
        this.webRTCInitialized = true;
        this.log("success", "WebRTC initialized for web platform");
        return;
      }

      // For React Native, we need to wait for react-native-webrtc to be available
      let retries = 0;
      const maxRetries = 100; // Increased retries for slower devices

      while (
        (typeof RTCPeerConnection === "undefined" ||
          !mediaDevices ||
          typeof mediaDevices.getUserMedia !== "function") &&
        retries < maxRetries
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries++;

        if (retries % 10 === 0) {
          this.log(
            "info",
            `WebRTC initialization attempt ${retries}/${maxRetries}`
          );
        }
      }

      if (typeof RTCPeerConnection === "undefined") {
        this.log(
          "error",
          "RTCPeerConnection is not available after initialization attempts"
        );
        this.webRTCInitialized = false;
        return;
      }

      if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
        this.log(
          "error",
          "mediaDevices.getUserMedia is not available after initialization attempts"
        );
        this.webRTCInitialized = false;
        return;
      }

      // Test basic WebRTC functionality
      try {
        const testPC = new RTCPeerConnection();
        testPC.close();
        this.log("success", "RTCPeerConnection creation test passed");
        this.webRTCInitialized = true;
      } catch (testError) {
        this.log("error", `RTCPeerConnection test failed: ${testError}`);
        this.webRTCInitialized = false;
        return;
      }

      this.log(
        "success",
        `WebRTC initialized successfully after ${retries} attempts`
      );
    } catch (error) {
      this.log("error", `Failed to initialize WebRTC: ${error}`);
      this.webRTCInitialized = false;
    }
  }

  /**
   * Setup audio session for Expo
   */
  private async setupAudioSession(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      this.log("error", `Failed to setup audio session: ${error}`);
    }
  }

  /**
   * Connect to NestJS backend via Socket.IO
   */
  async connect(
    serverUrl: string,
    userId: string,
    authToken?: string
  ): Promise<void> {
    try {
      console.log("VoiceCall Debug - Connecting with:", {
        serverUrl,
        userId,
        hasToken: !!authToken,
      });
      this.log("info", `Connecting to ${serverUrl} as user ${userId}`);

      const socketOptions: any = {
        transports: ["websocket", "polling"],
        autoConnect: false,
      };

      if (authToken) {
        socketOptions.auth = {
          token: authToken,
          userId: userId,
          deviceId: "expo-voice-call-" + Date.now(),
          deviceType: "mobile",
          platform: "expo",
        };
        socketOptions.extraHeaders = {
          Authorization: `Bearer ${authToken}`,
        };
      }

      this.socket = io(`${serverUrl}/chat`, socketOptions);
      this.setupSocketListeners();
      this.socket.connect();

      return new Promise((resolve, reject) => {
        this.socket!.on("connect", () => {
          this.isConnected = true;
          this.log(
            "success",
            `Connected to server with socket ID: ${this.socket!.id}`
          );
          resolve();
        });

        this.socket!.on("disconnect", () => {
          this.isConnected = false;
          this.log("warning", "Disconnected from server");
          if (this.onDisconnect) {
            this.onDisconnect();
          }
        });

        this.socket!.on("connect_error", (error) => {
          this.log("error", `Connection failed: ${error.message}`);
          this.log("error", `Full error: ${JSON.stringify(error)}`);
          // Thêm thông tin debug
          this.log("info", `Connection URL: ${serverUrl}/chat`);
          this.log("info", `Socket options: ${JSON.stringify(socketOptions)}`);
          reject(error);
        });

        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error("Connection timeout"));
          }
        }, 10000);
      });
    } catch (error) {
      this.log("error", `Failed to connect: ${error}`);
      throw error;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      // Remove all listeners trước khi disconnect
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null; // Đặt về null
      this.isConnected = false;
      this.log("info", "Disconnected from server");
    }

    // Reset toàn bộ state
    this.cleanup();
    this.resetServiceState();
  }

  private resetServiceState(): void {
    this.currentCallId = null;
    this.callState = "idle";
    this.isInitiator = false;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.isVideoCall = false;
    this.isVideoEnabled = true;
    this.currentFacingMode = "user";
    this.incomingCallData = null;
    this.iceCandidateQueue = [];
    this.remoteIceCandidateQueue = [];
    // ĐÃ XOÁ: reset các callback để không làm mất callback UI
  }
  /**
   * Setup Socket.IO event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on("disconnect", () => {
      this.isConnected = false;
      this.log("warning", "Disconnected from server");
    });

    this.socket.on("call:initiated", (data: { callId: string }) => {
      this.log("success", `Call initiated successfully: ${data.callId}`);
      this.currentCallId = data.callId;
      this.flushIceCandidateQueue();
      this.updateDebugInfo();
    });

    this.socket.on("call:incoming", (data: CallData) => {
      console.log("VoiceCall Debug - Received incoming call event:", data);
      this.log(
        "success",
        `Incoming call from ${data.callerId}: ${data.callId}`
      );
      this.handleIncomingCall(data);
    });

    this.socket.on("call:accepted", (data: CallData) => {
      this.log("success", `Call accepted: ${data.callId}`);
      this.handleCallAccepted(data);
    });

    this.socket.on("call:accept_confirmed", (data: CallData) => {
      this.log("success", `Call accept confirmed: ${data.callId}`);
      this.handleCallAcceptConfirmed(data);
    });

    this.socket.on("call:declined", (data: CallData) => {
      this.log("warning", `Call declined: ${data.callId}`);
      if (this.currentCallId === data.callId) {
        this.handleCallDeclined(data);
        this.cleanup();
        this.callState = "ended";
        this.notifyStateChange();
        if (this.onCallEnded) {
          this.onCallEnded();
        }
      }
    });

    this.socket.on("call:ended", (data: CallData) => {
      this.log("info", `Call ended: ${data.callId}`);
      if (this.currentCallId === data.callId) {
        this.handleCallHangup(data);
      }
    });

    // Handle call timeout (no answer)
    this.socket.on(
      "call:timeout",
      (data: { callId: string; reason?: string }) => {
        this.log(
          "warning",
          `Call timeout: ${data.callId} - ${data.reason || "No answer"}`
        );
        console.debug("📞 Call timeout data:", data);
        if (this.currentCallId === data.callId) {
          // Construct a minimal CallData object for handleCallHangup
          const timeoutCallData: CallData = {
            callId: data.callId,
            callerId: "", // Unknown in timeout
            callType: "voice", // Default to voice, adjust if needed
          };
          this.handleCallHangup(timeoutCallData);
          // Notify UI that call timed out
          if (this.onError) {
            this.onError({
              message: "Cuộc gọi đã hết thời gian chờ",
              code: "CALL_TIMEOUT",
            });
          }
        }
      }
    );

    this.socket.on(
      "call:ice_candidate",
      (data: { callId: string; candidate: RTCIceCandidate }) => {
        this.log("info", `ICE candidate received for call: ${data.callId}`);
        this.handleIceCandidate(data);
      }
    );

    this.socket.on("call:error", (data: { message: string; code?: string }) => {
      this.log("error", `Call error: ${data.message}`);
      if (this.onError) {
        this.onError(data);
      }
    });
  }

  /**
   * Test microphone access
   */
  async testMicrophone(): Promise<boolean> {
    try {
      this.log("info", "Testing microphone access...");

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Microphone permission denied");
      }

      // Test recording
      const recording = new Audio.Recording();
      try {
        await recording.prepareToRecordAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        await recording.startAsync();

        // Record for 1 second
        setTimeout(async () => {
          await recording.stopAndUnloadAsync();
        }, 1000);

        this.log("success", "Microphone test completed successfully");
        return true;
      } catch (recordingError) {
        this.log("error", `Recording test failed: ${recordingError}`);
        throw recordingError;
      }
    } catch (error) {
      this.log("error", `Microphone test failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get user media with Expo camera/audio
   */
  private async ensurePermissions(
    includeVideo: boolean = false
  ): Promise<void> {
    try {
      // Kiểm tra quyền hiện tại
      const { status: currentAudioStatus } = await Audio.getPermissionsAsync();

      if (currentAudioStatus !== "granted") {
        this.log("info", "Requesting audio permission...");
        const { status: audioStatus } = await Audio.requestPermissionsAsync();

        if (audioStatus !== "granted") {
          throw new Error(
            "Quyền microphone bị từ chối. Vui lòng cấp quyền trong Settings."
          );
        }
      }

      if (includeVideo) {
        const { status: currentCameraStatus } =
          await Camera.getCameraPermissionsAsync();

        if (currentCameraStatus !== "granted") {
          this.log("info", "Requesting camera permission...");
          const { status: cameraStatus } =
            await Camera.requestCameraPermissionsAsync();

          if (cameraStatus !== "granted") {
            throw new Error(
              "Quyền camera bị từ chối. Vui lòng cấp quyền trong Settings."
            );
          }
        }
      }

      this.log("success", "All permissions granted");
    } catch (error) {
      this.log("error", `Permission error: ${error}`);
      throw error;
    }
  }
  public debugAudioState(): void {
    if (!this.localStream) {
      console.log("🎤 Không có local stream");
      return;
    }

    const audioTracks = this.localStream.getAudioTracks();
    console.log(`🎤 Số lượng audio tracks: ${audioTracks.length}`);

    audioTracks.forEach((track, index) => {
      console.log(`🎤 Track ${index}:`, {
        id: track.id,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        kind: track.kind,
      });
    });

    if (this.peerConnection) {
      const senders = this.peerConnection.getSenders();
      console.log(`📡 Số lượng RTC Senders: ${senders.length}`);

      senders.forEach((sender, index) => {
        if (sender.track) {
          console.log(`📡 Sender ${index}:`, {
            kind: sender.track.kind,
            enabled: sender.track.enabled,
            readyState: sender.track.readyState,
          });
        }
      });
    }
  }
  private async getUserMedia(
    includeVideo: boolean = false,
    facingMode: "front" | "back" = "front"
  ): Promise<MediaStream> {
    try {
      await this.ensurePermissions(includeVideo);

      // Bắt đầu với constraints cơ bản, sau đó thử nâng cao
      await this.ensurePermissions(includeVideo);

      const constraints: any = {
        audio: true, // Luôn bật audio
      };

      if (includeVideo) {
        constraints.video = {
          facingMode: facingMode === "front" ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        };
      }

      try {
        const stream = await mediaDevices.getUserMedia(constraints);
        this.localStream = stream;
        return stream;
      } catch (basicError) {
        // Fallback về enhanced audio constraints
        constraints.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };

        const stream = await mediaDevices.getUserMedia(constraints);
        this.localStream = stream;
        return stream;
      }
    } catch (error) {
      this.log("error", `getUserMedia failed: ${error}`);
      throw error;
    }
  }
  private async ensureAudioTracksEnabled(): Promise<void> {
    if (!this.localStream) return;

    // Chờ một chút để tracks sẵn sàng
    await new Promise((resolve) => setTimeout(resolve, 100));

    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach((track, index) => {
      this.log(
        "info",
        `Audio track ${index}: enabled=${track.enabled}, readyState=${track.readyState}`
      );
      track.enabled = !this.isMuted;
    });
  }
  /**
   * Start a voice call
   */
  async startCall(targetUserId: string): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error("Not connected to server");
      }
      await this.getUserMedia();
      this.createPeerConnection();

      this.localStream!.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
      if (this.callState !== "idle") {
        throw new Error("Already in a call");
      }

      // Check if we're in a development build
      if (!this.isDevelopmentBuild()) {
        throw new Error(
          "WebRTC requires a development build. You cannot use Expo Go for voice calls. " +
            "Please run 'npx expo run:android' instead of 'npx expo start'."
        );
      }
      this.debugAudioState();
      this.isMuted = false;
      await this.ensureAudioTracksEnabled();
      // Ensure WebRTC is available
      if (typeof RTCPeerConnection === "undefined") {
        const status = this.getWebRTCStatus();
        throw new Error(
          `WebRTC is not available: ${
            status.errorMessage || "Unknown error"
          }. ` +
            `Platform: ${status.platform}. ` +
            `If you're using Expo Go, you need to create a development build with 'expo run:android' or 'expo run:ios'.`
        );
      }

      // Wait for WebRTC to be fully ready
      const webRTCReady = await this.waitForWebRTC(10000);
      if (!webRTCReady) {
        const status = this.getWebRTCStatus();
        throw new Error(
          `WebRTC failed to initialize within timeout. Status: ${JSON.stringify(
            status
          )}. ` +
            `Please ensure you're using a development build and not Expo Go.`
        );
      }

      this.log("info", `Starting voice call to user: ${targetUserId}`);
      this.callState = "initiating";
      this.isInitiator = true;

      await this.getUserMedia();
      this.createPeerConnection();

      this.localStream!.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
      // Đảm bảo mở mic khi bắt đầu cuộc gọi
      this.setMuted(false);

      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await this.peerConnection!.setLocalDescription(offer);

      this.socket!.emit("call:initiate", {
        targetUserId: targetUserId,
        callType: "voice",
        sdpOffer: offer,
      });

      this.updateDebugInfo();
      this.notifyStateChange();
    } catch (error) {
      this.log("error", `Failed to start call: ${error}`);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Start a video call
   */
  async startVideoCall(
    targetUserId: string,
    facingMode: "front" | "back" = "front"
  ): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error("Not connected to server");
      }

      if (this.callState !== "idle") {
        throw new Error("Already in a call");
      }

      this.log("info", `Starting video call to user: ${targetUserId}`);
      this.callState = "initiating";
      this.isInitiator = true;
      this.isVideoCall = true;

      await this.getUserMedia(true, facingMode);
      this.createPeerConnection();

      this.localStream!.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
      // Đảm bảo mở mic khi bắt đầu cuộc gọi video
      this.setMuted(false);

      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection!.setLocalDescription(offer);

      this.socket!.emit("call:initiate", {
        targetUserId: targetUserId,
        callType: "video",
        sdpOffer: offer,
      });

      this.updateDebugInfo();
      this.notifyStateChange();
    } catch (error) {
      this.log("error", `Failed to start video call: ${error}`);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callData?: CallData): Promise<void> {
    try {
      const actualCallData = this.incomingCallData || callData;
      if (!actualCallData) {
        throw new Error("No call data available");
      }

      if (this.callState !== "ringing") {
        throw new Error("No incoming call to answer");
      }

      // Kiểm tra socket connection trước khi answer
      if (!this.socket || !this.isConnected) {
        throw new Error("Socket not connected. Cannot answer call.");
      }
      await this.getUserMedia(this.isVideoCall);
      console.log("answer");
      this.debugAudioState();

      this.log("info", `Answering call: ${actualCallData.callId}`);
      this.callState = "connecting";
      this.notifyStateChange();

      if (!this.peerConnection) {
        this.createPeerConnection();
      }

      this.localStream!.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
      // Đảm bảo mở mic khi trả lời cuộc gọi
      this.setMuted(false);

      if (!actualCallData.sdpOffer || !actualCallData.sdpOffer.sdp) {
        throw new Error("Invalid SDP offer: missing sdp");
      }
      await this.peerConnection!.setRemoteDescription({
        type: actualCallData.sdpOffer.type,
        sdp: actualCallData.sdpOffer.sdp,
      });
      await this.flushRemoteIceCandidateQueue();

      const answer = await this.peerConnection!.createAnswer();

      await this.peerConnection!.setLocalDescription(answer);

      // Kiểm tra socket lại trước khi emit
      if (!this.socket || !this.isConnected) {
        throw new Error("Socket disconnected during call setup");
      }

      this.socket.emit("call:accept", {
        callId: this.currentCallId,
        sdpAnswer: answer,
      });

      this.updateDebugInfo();
      this.notifyStateChange();
    } catch (error) {
      this.log("error", `Failed to answer call: ${error}`);
      // Chỉ decline nếu có currentCallId hợp lệ
      if (this.currentCallId) {
        this.declineCall(this.currentCallId);
      }
      throw error;
    }
  }

  /**
   * Decline an incoming call
   */
  declineCall(callId: string): void {
    this.log("info", `Declining call: ${callId}`);
    if (this.socket && this.isConnected) {
      this.socket.emit("call:decline", {
        callId: callId,
        reason: "declined",
      });
    } else {
      this.log("warning", "Socket not connected, cannot send decline signal");
    }
    this.cleanup();
  }

  /**
   * Hang up current call
   */
  hangupCall(): void {
    if (!this.currentCallId) {
      this.log("warning", "No active call to hang up");
      return;
    }

    this.log("info", `Hanging up call: ${this.currentCallId}`);
    if (this.socket && this.isConnected) {
      this.socket.emit("call:hangup", {
        callId: this.currentCallId,
        reason: "user_hangup",
      });
    } else {
      this.log("warning", "Socket not connected, cannot send hangup signal");
    }
    this.cleanup();
  }

  /**
   * Toggle mute/unmute
   */
  toggleMute(): boolean {
    if (!this.localStream) {
      this.log("warning", "No local stream to mute");
      return false;
    }

    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });

    this.log("info", `Audio ${this.isMuted ? "muted" : "unmuted"}`);
    return this.isMuted;
  }

  // Bật/tắt micro theo trạng thái mong muốn
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Toggle speaker on/off
   */
  toggleSpeaker(): boolean {
    this.isSpeakerOn = !this.isSpeakerOn;

    // Use Expo Audio to control speaker
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: !this.isSpeakerOn,
    });

    this.log("info", `Speaker ${this.isSpeakerOn ? "on" : "off"}`);
    return this.isSpeakerOn;
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera(): Promise<boolean> {
    if (!this.localStream || !this.isVideoCall) {
      this.log("warning", "No video stream available to switch camera");
      return false;
    }

    try {
      this.log("info", "Switching camera...");

      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.stop();
        this.localStream!.removeTrack(track);
      });

      const newFacingMode =
        this.currentFacingMode === "user" ? "back" : "front";

      const newVideoStream = await this.getUserMedia(true, newFacingMode);
      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      this.localStream.addTrack(newVideoTrack);

      if (this.peerConnection) {
        const sender = this.peerConnection
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");

        if (sender) {
          await sender.replaceTrack(newVideoTrack);
          this.log("success", "Camera switched successfully");
        }
      }

      return true;
    } catch (error) {
      this.log("error", `Failed to switch camera: ${error}`);
      return false;
    }
  }

  /**
   * Toggle video on/off
   */
  toggleVideo(): boolean {
    if (!this.localStream || !this.isVideoCall) {
      this.log("warning", "No video stream available to toggle");
      return false;
    }

    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });

    this.isVideoEnabled = videoTracks[0]?.enabled || false;
    this.log("info", `Video ${this.isVideoEnabled ? "enabled" : "disabled"}`);

    return this.isVideoEnabled;
  }

  /**
   * Get available cameras
   */
  async getAvailableCameras(): Promise<CameraDevice[]> {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Camera permission denied");
      }

      // In React Native, camera enumeration is handled differently
      // This is a simplified version - you might need platform-specific code
      return [
        {
          deviceId: "front",
          label: "Front Camera",
          facingMode: "user",
        },
        {
          deviceId: "back",
          label: "Back Camera",
          facingMode: "environment",
        },
      ];
    } catch (error) {
      this.log("error", `Failed to get cameras: ${error}`);
      return [];
    }
  }

  /**
   * Check media permissions
   */
  async checkCameraPermissions(): Promise<MediaPermissions> {
    try {
      const { status: cameraStatus } = await Camera.getCameraPermissionsAsync();
      const { status: audioStatus } = await Audio.getPermissionsAsync();

      return {
        camera: cameraStatus,
        microphone: audioStatus,
      };
    } catch (error) {
      this.log("warning", `Permission check failed: ${error}`);
      return {
        camera: "denied" as PermissionStatus,
        microphone: "denied" as PermissionStatus,
      };
    }
  }

  /**
   * Request media permissions
   */
  async requestMediaPermissions(
    includeVideo: boolean = false
  ): Promise<boolean> {
    try {
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      if (audioStatus !== "granted") {
        return false;
      }

      if (includeVideo) {
        const { status: cameraStatus } =
          await Camera.requestCameraPermissionsAsync();
        if (cameraStatus !== "granted") {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.log("error", `Permission request failed: ${error}`);
      return false;
    }
  }

  // Private helper methods...

  private createPeerConnection(): void {
    this.log("info", "Creating PeerConnection...");

    // Ensure WebRTC is available
    if (typeof RTCPeerConnection === "undefined") {
      throw new Error(
        "RTCPeerConnection is not available. Please ensure react-native-webrtc is properly configured."
      );
    }

    this.peerConnection = new RTCPeerConnection(this.config);

    (this.peerConnection as any).ontrack = (event: any) => {
      if (!this.peerConnection) {
        return;
      }
      this.log("success", `Remote ${event.track.kind} stream received`);
      this.remoteStream = event.streams[0];

      if (this.onRemoteStreamUpdate) {
        this.onRemoteStreamUpdate(this.remoteStream);
      }
    };

    (this.peerConnection as any).onicecandidate = (event: any) => {
      if (!this.peerConnection) {
        return;
      }
      if (event.candidate) {
        if (this.currentCallId) {
          this.socket!.emit("call:ice_candidate", {
            callId: this.currentCallId,
            candidate: event.candidate,
          });
        } else {
          this.iceCandidateQueue.push(event.candidate);
        }
      }
    };

    (this.peerConnection as any).oniceconnectionstatechange = () => {
      if (!this.peerConnection) {
        return;
      }
      const state = this.peerConnection.iceConnectionState;
      this.log("info", `ICE connection state: ${state}`);

      if (state === "connected" || state === "completed") {
        this.callState = "active";
        this.notifyStateChange();
      } else if (state === "failed" || state === "disconnected") {
        this.cleanup();
      }

      this.updateDebugInfo();
    };
  }

  private handleIncomingCall(data: CallData): void {
    this.log("success", `Processing incoming call: ${data.callId}`);

    // Reset any existing call state first
    if (this.callState !== "idle") {
      this.cleanup();
    }

    // Store call data but don't create PeerConnection yet
    this.currentCallId = data.callId;
    this.callState = "ringing";
    this.isInitiator = false;
    this.isVideoCall = data.callType === "video";
    this.incomingCallData = data;

    // Notify about incoming call
    if (this.onIncomingCall) {
      this.onIncomingCall(data);
    }

    this.notifyStateChange();
  }

  private async handleCallAccepted(data: CallData): Promise<void> {
    if (!this.isInitiator || this.currentCallId !== data.callId) return;

    try {
      if (this.callState !== "idle") {
        this.cleanup();
      }
      this.callState = "active";
      if (data.sdpAnswer && this.peerConnection) {
        if (!data.sdpAnswer.sdp) {
          throw new Error("Invalid SDP answer: missing sdp");
        }
        await this.peerConnection.setRemoteDescription({
          type: data.sdpAnswer.type,
          sdp: data.sdpAnswer.sdp,
        });
        await this.flushRemoteIceCandidateQueue();
      }
      this.updateDebugInfo();
      this.notifyStateChange();
    } catch (error) {
      this.log("error", `Failed to handle call accepted: ${error}`);
    }
  }

  private handleCallAcceptConfirmed(data: CallData): void {
    if (this.isInitiator || this.currentCallId !== data.callId) return;

    this.callState = "active";
    if (this.remoteIceCandidateQueue.length > 0) {
      this.flushRemoteIceCandidateQueue();
    }
    this.updateDebugInfo();
    this.notifyStateChange();
  }

  private handleCallDeclined(data: CallData): void {
    if (this.currentCallId === data.callId) {
      this.log("warning", `Call declined by user`);

      // Update state first
      this.callState = "ended";
      this.notifyStateChange();

      // Cleanup resources
      this.cleanup();

      // Notify call ended
      if (this.onCallEnded) {
        this.onCallEnded();
      }
    }
  }

  private handleCallHangup(data: CallData): void {
    if (this.currentCallId === data.callId) {
      this.log("info", `Call ended by remote user: ${data.callId}`);

      // First update state
      this.callState = "ended";
      this.notifyStateChange();

      // Then cleanup resources
      this.cleanup();

      // Finally notify call ended
      if (this.onCallEnded) {
        this.onCallEnded();
      }
    }
  }

  private async handleIceCandidate(data: {
    callId: string;
    candidate: RTCIceCandidate;
  }): Promise<void> {
    try {
      if (!this.peerConnection || data.callId !== this.currentCallId) return;

      if (!this.peerConnection.remoteDescription) {
        this.remoteIceCandidateQueue.push(data.candidate);
        return;
      }

      await this.peerConnection.addIceCandidate(data.candidate);
    } catch (error) {
      this.log("error", `Failed to add ICE candidate: ${error}`);
    }
  }

  private flushIceCandidateQueue(): void {
    if (this.iceCandidateQueue.length > 0 && this.currentCallId) {
      this.iceCandidateQueue.forEach((candidate) => {
        this.socket!.emit("call:ice_candidate", {
          callId: this.currentCallId,
          candidate: candidate,
        });
      });
      this.iceCandidateQueue = [];
    }
  }

  private async flushRemoteIceCandidateQueue(): Promise<void> {
    if (
      this.remoteIceCandidateQueue.length > 0 &&
      this.peerConnection &&
      this.peerConnection.remoteDescription
    ) {
      const candidates = [...this.remoteIceCandidateQueue];
      this.remoteIceCandidateQueue = [];

      for (const candidate of candidates) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
        } catch (error) {
          this.log("error", `Failed to add queued ICE candidate: ${error}`);
        }
      }
    }
  }

  private updateDebugInfo(): void {
    if (this.onDebugUpdate) {
      const debugInfo: DebugInfo = {
        localDescription: this.peerConnection?.localDescription?.sdp || "",
        remoteDescription: this.peerConnection?.remoteDescription?.sdp || "",
        iceConnectionState: this.peerConnection?.iceConnectionState || "new",
        callId: this.currentCallId,
        callState: this.callState,
      };
      this.onDebugUpdate(debugInfo);
    }
  }

  private notifyStateChange(): void {
    if (this.onCallStateChanged) {
      const state: CallState = {
        callId: this.currentCallId,
        state: this.callState,
        isInitiator: this.isInitiator,
        isMuted: this.isMuted,
        isSpeakerOn: this.isSpeakerOn,
      };
      this.onCallStateChanged(state);
    }
  }

  private cleanup(): void {
    this.log("info", "Cleaning up call resources");

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          this.log("warning", `Error stopping track: ${e}`);
        }
      });
      this.localStream = null;
    }

    if (this.peerConnection) {
      // Detach handlers to prevent callbacks after null
      try {
        (this.peerConnection as any).ontrack = null;
        (this.peerConnection as any).onicecandidate = null;
        (this.peerConnection as any).oniceconnectionstatechange = null;
        (this.peerConnection as any).onconnectionstatechange = null;
        (this.peerConnection as any).onicegatheringstatechange = null;
        (this.peerConnection as any).onsignalingstatechange = null;
      } catch (e) {
        this.log("warning", `Error detaching handlers: ${e}`);
      }

      try {
        this.peerConnection.close();
      } catch (e) {
        this.log("warning", `Error closing peer connection: ${e}`);
      }
      this.peerConnection = null;
    }

    this.currentCallId = null;
    this.callState = "idle";
    this.isInitiator = false;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.incomingCallData = null;
    this.isVideoCall = false;
    this.isVideoEnabled = true;
    this.currentFacingMode = "user";

    this.iceCandidateQueue = [];
    this.remoteIceCandidateQueue = [];

    this.updateDebugInfo();
  }

  private log(
    level: "info" | "success" | "warning" | "error" | "debug",
    message: string
  ): void {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logEntry);
  }

  /**
   * Get current call state
   */
  getCallState(): CallState {
    return {
      callId: this.currentCallId,
      state: this.callState,
      isInitiator: this.isInitiator,
      isMuted: this.isMuted,
      isSpeakerOn: this.isSpeakerOn,
    };
  }

  /**
   * Check if WebRTC is ready for calls
   */
  isWebRTCReady(): boolean {
    return (
      this.webRTCInitialized &&
      typeof RTCPeerConnection !== "undefined" &&
      !!mediaDevices &&
      typeof mediaDevices.getUserMedia === "function"
    );
  }

  /**
   * Wait for WebRTC to be ready
   */
  async waitForWebRTC(timeoutMs: number = 5000): Promise<boolean> {
    try {
      // First, ensure WebRTC initialization has started
      await this.initializeWebRTC();

      // Wait for initialization to complete
      const startTime = Date.now();
      while (!this.webRTCInitialized && Date.now() - startTime < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return this.isWebRTCReady();
    } catch (error) {
      this.log("error", `Error waiting for WebRTC: ${error}`);
      return false;
    }
  }

  /**
   * Get detailed WebRTC status information
   */
  getWebRTCStatus(): {
    isInitialized: boolean;
    rtcPeerConnectionAvailable: boolean;
    navigatorAvailable: boolean;
    mediaDevicesAvailable: boolean;
    platform: string;
    errorMessage?: string;
  } {
    type WebRTCStatus = {
      isInitialized: boolean;
      rtcPeerConnectionAvailable: boolean;
      navigatorAvailable: boolean;
      mediaDevicesAvailable: boolean;
      platform: string;
      errorMessage?: string;
    };
    const status: WebRTCStatus = {
      isInitialized: this.webRTCInitialized,
      rtcPeerConnectionAvailable: typeof RTCPeerConnection !== "undefined",
      navigatorAvailable: typeof (global as any).navigator !== "undefined",
      mediaDevicesAvailable:
        !!mediaDevices && typeof mediaDevices.getUserMedia === "function",
      platform: Platform.OS,
    };

    if (!status.rtcPeerConnectionAvailable) {
      status.errorMessage =
        "RTCPeerConnection is not available. This usually means react-native-webrtc is not properly installed or linked.";
    } else if (!status.navigatorAvailable) {
      status.errorMessage = "navigator object is not available.";
    } else if (!status.mediaDevicesAvailable) {
      status.errorMessage = "mediaDevices.getUserMedia is not available.";
    } else if (!status.isInitialized) {
      status.errorMessage = "WebRTC initialization is still in progress.";
    }

    return status;
  }

  /**
   * Check if this is a development build (required for WebRTC)
   */
  isDevelopmentBuild(): boolean {
    // In Expo, WebRTC won't work in Expo Go (appOwnership === 'expo').
    // Dev Client ('guest') and standalone builds ('standalone') are OK.
    // On web, allow.
    if (Platform.OS === "web") return true;
    try {
      return Constants.appOwnership !== "expo";
    } catch {
      // If Constants not available for some reason, fall back to allowing.
      return true;
    }
  }
}
export const voiceCallService = new VoiceCallService();
