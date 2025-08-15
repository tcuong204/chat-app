import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Camera } from "expo-camera";
import type { PermissionStatus } from "expo-modules-core";
import { io, Socket } from "socket.io-client";

// Types
interface CallData {
  callId: string;
  callerId: string;
  callerName?: string;
  callType: "voice" | "video";
  sdpOffer?: RTCSessionDescriptionInit;
  sdpAnswer?: RTCSessionDescriptionInit;
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

  constructor() {
    this.setupAudioSession();
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

        this.socket!.on("connect_error", (error) => {
          this.log("error", `Connection failed: ${error.message}`);
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
      this.socket.disconnect();
      this.isConnected = false;
      this.log("info", "Disconnected from server");
    }
    this.cleanup();
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
      this.handleCallDeclined(data);
    });

    this.socket.on("call:ended", (data: CallData) => {
      this.log("info", `Call ended: ${data.callId}`);
      this.handleCallHangup(data);
    });

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
  private async getUserMedia(
    includeVideo: boolean = false,
    facingMode: "front" | "back" = "front"
  ): Promise<MediaStream> {
    try {
      // Request permissions first
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      if (audioStatus !== "granted") {
        throw new Error("Audio permission denied");
      }

      if (includeVideo) {
        const { status: cameraStatus } =
          await Camera.requestCameraPermissionsAsync();
        if (cameraStatus !== "granted") {
          throw new Error("Camera permission denied");
        }
      }

      // For React Native, we need to use native modules or WebRTC libraries
      // This is a placeholder - you'll need react-native-webrtc for actual implementation
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      if (includeVideo) {
        constraints.video = {
          facingMode: facingMode === "front" ? "user" : "environment",
        };
      }

      // Note: In React Native, you'll need to use react-native-webrtc
      // This is just a placeholder for the web getUserMedia API
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;

      this.isVideoCall = includeVideo;
      this.currentFacingMode = facingMode === "front" ? "user" : "environment";

      return stream;
    } catch (error) {
      this.log("error", `Failed to get user media: ${error}`);
      throw error;
    }
  }

  /**
   * Start a voice call
   */
  async startCall(targetUserId: string): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error("Not connected to server");
      }

      if (this.callState !== "idle") {
        throw new Error("Already in a call");
      }

      this.log("info", `Starting voice call to user: ${targetUserId}`);
      this.callState = "initiating";
      this.isInitiator = true;

      await this.getUserMedia();
      this.createPeerConnection();

      this.localStream!.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

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

      this.log("info", `Answering call: ${actualCallData.callId}`);
      this.currentCallId = actualCallData.callId;
      this.callState = "connecting";
      this.isInitiator = false;
      this.isVideoCall = actualCallData.callType === "video";

      await this.getUserMedia(this.isVideoCall);

      if (!this.peerConnection) {
        this.createPeerConnection();
      }

      this.localStream!.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      await this.peerConnection!.setRemoteDescription(actualCallData.sdpOffer!);
      await this.flushRemoteIceCandidateQueue();

      const answer = await this.peerConnection!.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.isVideoCall,
      });

      await this.peerConnection!.setLocalDescription(answer);

      this.socket!.emit("call:accept", {
        callId: this.currentCallId,
        sdpAnswer: answer,
      });

      this.updateDebugInfo();
      this.notifyStateChange();
    } catch (error) {
      this.log("error", `Failed to answer call: ${error}`);
      this.declineCall(this.currentCallId!);
      throw error;
    }
  }

  /**
   * Decline an incoming call
   */
  declineCall(callId: string): void {
    this.log("info", `Declining call: ${callId}`);
    this.socket!.emit("call:decline", {
      callId: callId,
      reason: "declined",
    });
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
    this.socket!.emit("call:hangup", {
      callId: this.currentCallId,
      reason: "user_hangup",
    });
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
    this.peerConnection = new RTCPeerConnection(this.config);

    this.peerConnection.ontrack = (event) => {
      this.log("success", `Remote ${event.track.kind} stream received`);
      this.remoteStream = event.streams[0];
    };

    this.peerConnection.onicecandidate = (event) => {
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

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection!.iceConnectionState;
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
    this.currentCallId = data.callId;
    this.callState = "ringing";
    this.createPeerConnection();
    this.incomingCallData = data;

    if (this.onIncomingCall) {
      this.onIncomingCall(data);
    }

    this.notifyStateChange();
  }

  private async handleCallAccepted(data: CallData): Promise<void> {
    if (!this.isInitiator || this.currentCallId !== data.callId) return;

    try {
      this.callState = "active";
      if (data.sdpAnswer && this.peerConnection) {
        await this.peerConnection.setRemoteDescription(data.sdpAnswer);
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
    this.log("warning", `Call declined by user`);
    this.cleanup();
  }

  private handleCallHangup(data: CallData): void {
    this.log("info", `Call ended by remote user: ${data.callId}`);
    this.cleanup();
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
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
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

    this.notifyStateChange();
    this.updateDebugInfo();

    if (this.onCallEnded) {
      this.onCallEnded();
    }
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
}
export const voiceCallService = new VoiceCallService();
