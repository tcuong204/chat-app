/**
 * WebRTC Voice Call Service - Phase 2 Implementation
 * 
 * Handles WebRTC media stream integration for voice calls:
 * - Microphone access and audio stream management
 * - PeerConnection setup and ICE candidate exchange
 * - SDP offer/answer negotiation
 * - Call state management and error handling
 * 
 * Integration với NestJS backend through Socket.IO
 */

class VoiceCallService {
  constructor() {
    // WebRTC Components
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;

    // Socket Connection
    this.socket = null;
    this.isConnected = false;

    // Call State
    this.currentCallId = null;
    this.callState = 'idle'; // idle, initiating, ringing, active, ended
    this.isInitiator = false;
    this.isMuted = false;
    this.isSpeakerOn = false;

    // Video Call State - NEW for Phase 2
    this.isVideoCall = false;
    this.isVideoEnabled = true;
    this.currentFacingMode = 'user'; // 'user' for front camera, 'environment' for back camera
    this.localVideoElement = null;
    this.remoteVideoElement = null;

    // ICE Candidate Queue (for candidates generated before callId or remote description is available)
    this.iceCandidateQueue = [];
    this.remoteIceCandidateQueue = [];

    // Store incoming call data
    this.incomingCallData = null;

    // Audio Context for visualization
    this.audioContext = null;
    this.localAnalyzer = null;
    this.remoteAnalyzer = null;

    // Configuration with enhanced ICE settings for LAN connectivity
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10,
      // Extended ICE gathering timeout for LAN connections
      iceGatheringTimeout: 30000,  // 30 seconds instead of default 15
      // Prefer IPv4 and avoid virtual interfaces like WSL
      iceCheckingTimeout: 20000,
      // Additional configuration for better LAN connectivity
      enableCpuOveruseDetection: false,
      // Force ICE to use proper IP addresses for LAN
      enableDscp: true,
      // Enhanced SDP semantics for LAN connections
      sdpSemantics: 'unified-plan',
      // Force to only use valid network interfaces
      rtcpMuxPolicy: 'require',
      // Reduce DTLS fingerprint to force better candidate selection
      enableDtlsSrtp: true,
      // Port range configuration to avoid reserved ports
      portRange: {
        min: 10,  // Start from port 10000
        max: 200000   // End at port 20000
      }
    };

    // Event callbacks (will be set by UI)
    this.onCallStateChanged = null;
    this.onIncomingCall = null;
    this.onCallEnded = null;
    this.onError = null;
    this.onDebugUpdate = null;

    // Analyze network configuration on startup
    setTimeout(() => {
      this.analyzeNetworkConfig();
    }, 1000);
  }

  /**
   * Analyze local network configuration for debugging
   */
  async analyzeNetworkConfig() {
    try {
      // Get local IP using WebRTC with same config as main connection
      const tempPc = new RTCPeerConnection({
        iceServers: this.config.iceServers,
        iceTransportPolicy: 'all' // Ensure we gather all types of candidates
      });

      const localIPs = [];

      return new Promise((resolve) => {
        tempPc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate;
            // Store candidate without logging
            if (candidate.type === 'host' && candidate.address) {
              const ip = candidate.address;
              if (!localIPs.includes(ip)) {
                localIPs.push(ip);

                // Analyze IP type
                let ipType = 'Unknown';
                let firewallRisk = 'Low';

                if (ip.startsWith('192.168.')) {
                  ipType = 'LAN (Class C Private)';
                  firewallRisk = 'Low';
                } else if (ip.startsWith('10.')) {
                  ipType = 'LAN (Class A Private)';
                  firewallRisk = 'Low';
                } else if (ip.startsWith('172.')) {
                  const secondOctet = parseInt(ip.split('.')[1]);
                  if (secondOctet >= 16 && secondOctet <= 31) {
                    ipType = 'Virtual (Docker/WSL)';
                    firewallRisk = 'High - May be blocked';
                  } else {
                    ipType = 'LAN (Class B Private)';
                    firewallRisk = 'Low';
                  }
                } else if (ip.startsWith('169.254.')) {
                  ipType = 'Link-Local (APIPA)';
                  firewallRisk = 'Medium - Limited connectivity';
                } else if (ip === '127.0.0.1') {
                  ipType = 'Localhost';
                  firewallRisk = 'High - Same machine only';
                } else {
                  ipType = 'Public/Other';
                  firewallRisk = 'Variable';
                }

                // Store IP without logging details
              }
            }
          } else {
            // ICE gathering complete
            tempPc.close();
            resolve(localIPs);
          }
        };

        // Create a dummy data channel to trigger ICE gathering
        tempPc.createDataChannel('test');
        tempPc.createOffer().then(offer => tempPc.setLocalDescription(offer));
      });

    } catch (error) {
      this.log('error', `❌ Network analysis failed: ${error.message}`);
      this.log('warning', 'This might indicate firewall or network configuration issues');
      return [];
    }
  }

  /**
   * Check if IP is WSL interface
   */
  isWSLInterface(ip) {
    if (!ip.startsWith('172.')) return false;
    const parts = ip.split('.');
    const secondOctet = parseInt(parts[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  /**
   * Connect to NestJS backend via Socket.IO
   */
  async connect(serverUrl, userId, authToken = null) {
    try {
      this.log('info', `Connecting to ${serverUrl} as user ${userId}`);
      this.log('debug', `Auth token provided: ${authToken ? 'Yes' : 'No'}`);

      const socketOptions = {
        transports: ['websocket', 'polling'],
        autoConnect: false,
      };

      if (authToken) {
        socketOptions.auth = {
          token: authToken,
          userId: userId,
          deviceId: 'voice-call-test-' + Date.now(),
          deviceType: 'web',
          platform: 'web'
        };
        socketOptions.extraHeaders = {
          'Authorization': `Bearer ${authToken}`
        };
        this.log('debug', `Socket auth configured with token`);
      }

      this.socket = io(`${serverUrl}/chat`, socketOptions);

      // Setup socket event listeners
      this.setupSocketListeners();

      // Connect
      this.socket.connect();

      return new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          this.isConnected = true;
          this.log('success', `Connected to server with socket ID: ${this.socket.id}`);
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          this.log('error', `Connection failed: ${error.message}`);
          reject(error);
        });

        this.socket.on('authenticated', () => {
          this.log('success', 'Socket authentication successful');
        });

        this.socket.on('authentication_failed', (error) => {
          this.log('error', `Socket authentication failed: ${error.message}`);
          reject(new Error('Authentication failed'));
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      });

    } catch (error) {
      this.log('error', `Failed to connect: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      this.log('info', 'Disconnected from server');
    }

    this.cleanup();
  }

  /**
   * Setup Socket.IO event listeners for call signaling
   */
  setupSocketListeners() {
    // Connection events
    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.log('warning', 'Disconnected from server');
    });

    // Call signaling events
    this.socket.on('call:initiated', (data) => {
      this.log('success', `Call initiated successfully: ${data.callId}`);
      this.currentCallId = data.callId;
      console.debug('📞 Call initiated data:', data);

      // Send any queued ICE candidates immediately
      // Flush queued ICE candidates
      this.flushIceCandidateQueue();

      this.updateDebugInfo();
    });

    this.socket.on('call:incoming', (data) => {
      this.log('success', `📞 INCOMING CALL RECEIVED! From ${data.callerId}: ${data.callId}`);
      this.log('debug', `Incoming call data:`, JSON.stringify(data, null, 2));
      console.debug('📞 Incoming call data:', data);
      this.handleIncomingCall(data);
    });

    this.socket.on('call:accepted', (data) => {
      this.log('success', `Call accepted: ${data.callId}`);
      console.debug('📞 Call accepted data:', data);
      this.handleCallAccepted(data);
    });

    this.socket.on('call:accept_confirmed', (data) => {
      this.log('success', `Call accept confirmed: ${data.callId}`);
      console.debug('📞 Call accept confirmed data:', data);
      this.handleCallAcceptConfirmed(data);
    });

    this.socket.on('call:declined', (data) => {
      this.log('warning', `Call declined: ${data.callId}`);
      console.debug('📞 Call declined data:', data);
      this.handleCallDeclined(data);
    });

    this.socket.on('call:ended', (data) => {
      this.log('info', `Call ended: ${data.callId}`);
      console.debug('📞 Call ended data:', data);
      this.handleCallHangup(data);
    });

    this.socket.on('call:timeout', (data) => {
      this.log('warning', `Call timeout: ${data.callId} - ${data.reason}`);
      console.debug('📞 Call timeout data:', data);
      this.handleCallHangup(data);
    });

    this.socket.on('call:ice_candidate', (data) => {
      if (!data.callId || !data.candidate) {
        this.log('error', 'Received invalid ICE candidate data:', data);
        return;
      }
      console.debug(' 📨 ICE candidate received from remote peer for call:', data);
      this.log('info', `🧊 ICE candidate received from remote peer for call: ${data.callId}`);
      this.log('debug', `   ├─ Candidate type: ${data.candidate?.type || 'unknown'}`);
      this.log('debug', `   ├─ Protocol: ${data.candidate?.protocol || 'unknown'}`);
      this.log('debug', `   ├─ Address: ${data.candidate?.address || 'unknown'}`);
      this.log('debug', `   ├─ Port: ${data.candidate?.port || 'unknown'}`);
      this.log('debug', `   └─ Current call: ${this.currentCallId}`);

      // Process remote ICE candidate

      if (data.callId !== this.currentCallId) {
        this.log('warning', `❌ ICE candidate for wrong call ID: ${data.callId} vs ${this.currentCallId}`);
        return;
      }

      this.handleIceCandidate(data);
    });

    this.socket.on('call:renegotiate', (data) => {
      console.debug('📡 Renegotiation offer received:', data);
      this.log('info', `📡 Renegotiation offer received: ${data.callId}`);
      this.handleRenegotiation(data);
    });

    this.socket.on('call:error', (data) => {
      console.debug('📞 Call error data:', data);
      this.log('error', `Call error: ${data.message} (${data.code})`);
      if (this.onError) {
        this.onError(data);
      }
    });

    this.socket.on('call:room_joined', (data) => {
      this.log('success', `✅ Successfully joined call room: ${data.callId}`);
      console.debug('📞 Call room joined:', data);
    });
  }

  /**
   * Test microphone access and detect conflicts
   */
  async testMicrophone() {
    try {
      this.log('info', '🔍 Testing microphone access and checking for conflicts...');

      // First, check if we're in a multiple tabs scenario
      if (typeof document !== 'undefined') {
        const tabId = 'voice-call-tab-' + Date.now();
        sessionStorage.setItem('voiceCallTabId', tabId);
        this.log('debug', `Tab ID: ${tabId}`);

        // Check if other tabs are active
        try {
          const existingTabs = JSON.parse(localStorage.getItem('activeVoiceCallTabs') || '[]');
          const now = Date.now();
          const activeTabs = existingTabs.filter(tab => now - tab.timestamp < 30000); // Active in last 30 seconds

          if (activeTabs.length > 0) {
            this.log('warning', `⚠️ Detected ${activeTabs.length} other active voice call tabs`);
            this.log('warning', '   This might cause microphone conflicts in Chrome');
            this.log('info', '💡 For testing, consider:');
            this.log('info', '   • Using Chrome Incognito mode for one tab');
            this.log('info', '   • Using different browsers (Chrome + Firefox)');
            this.log('info', '   • Testing on different devices/computers');
          }

          // Register this tab as active
          activeTabs.push({ tabId, timestamp: now });
          localStorage.setItem('activeVoiceCallTabs', JSON.stringify(activeTabs));

          // Cleanup old tabs every 30 seconds
          setTimeout(() => {
            const currentTabs = JSON.parse(localStorage.getItem('activeVoiceCallTabs') || '[]');
            const stillActive = currentTabs.filter(tab => Date.now() - tab.timestamp < 30000);
            localStorage.setItem('activeVoiceCallTabs', JSON.stringify(stillActive));
          }, 30000);

        } catch (storageError) {
          this.log('debug', `Storage check failed: ${storageError.message}`);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });

      this.log('success', '✅ Microphone access granted - no conflicts detected');

      // Test audio level
      this.setupAudioVisualization(stream, 'local');

      // Stop test stream after 3 seconds
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        this.log('info', 'Microphone test completed');
      }, 3000);

      return true;
    } catch (error) {
      this.log('error', `❌ Microphone test failed: ${error.message}`);

      // Provide specific guidance based on error
      if (error.name === 'NotAllowedError') {
        this.log('error', '🚫 MICROPHONE ACCESS DENIED');
        this.log('info', '📋 Troubleshooting steps:');
        this.log('info', '   1. Click the 🎤 icon in Chrome address bar');
        this.log('info', '   2. Select "Always allow" for this site');
        this.log('info', '   3. Check if another tab is using microphone');
        this.log('info', '   4. Close other apps using microphone (Zoom, Teams, Discord)');
      } else if (error.name === 'NotReadableError') {
        this.log('error', '🔒 MICROPHONE IN USE BY ANOTHER APPLICATION');
        this.log('info', '📋 Solutions:');
        this.log('info', '   1. Close other voice call tabs');
        this.log('info', '   2. Use Incognito mode for testing');
        this.log('info', '   3. Use different browsers for testing');
        this.log('info', '   4. Test on different computers');
      }

      throw error;
    }
  }

  /**
   * Initiate a voice call
   */
  async startCall(targetUserId) {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to server');
      }

      if (this.callState !== 'idle') {
        throw new Error('Already in a call');
      }

      this.log('info', `Starting voice call to user: ${targetUserId}`);
      this.callState = 'initiating';
      this.isInitiator = true;

      // Get user media
      await this.getUserMedia();

      // Create the real peer connection FIRST
      this.createPeerConnection();

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
        this.log('debug', `Added ${track.kind} track to peer connection`);
      });

      // Create SDP offer with the real peer connection
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      this.log('debug', '📞 Creating SDP offer');

      // Set local description IMMEDIATELY to avoid SDP mismatch
      await this.peerConnection.setLocalDescription(offer);
      this.log('debug', 'Local description (offer) set successfully');

      // Validate and log our offer SDP for debugging
      this.validateAndLogSDP(offer, 'Local Offer');

      // Send offer to server to get callId
      this.socket.emit('call:initiate', {
        targetUserId: targetUserId,
        callType: 'voice',
        sdpOffer: offer
      });

      this.log('debug', 'Call initiate sent to server');
      this.updateDebugInfo();
      this.notifyStateChange();

    } catch (error) {
      this.log('error', `Failed to start call: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Start a video call - NEW for Phase 2
   * @param {string} targetUserId - The user ID to call
   * @param {string} facingMode - Camera facing mode ('user' or 'environment')
   */
  async startVideoCall(targetUserId, facingMode = 'user') {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to server');
      }

      if (this.callState !== 'idle') {
        throw new Error('Already in a call');
      }

      this.log('info', `Starting video call to user: ${targetUserId}`);
      this.callState = 'initiating';
      this.isInitiator = true;
      this.isVideoCall = true;

      // Get user media with video
      await this.getUserMedia(true, facingMode);

      // Display local video
      this.displayLocalVideo();

      // Create the real peer connection
      this.createPeerConnection();

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
        this.log('debug', `Added ${track.kind} track to peer connection`);
      });

      // Create SDP offer for video call
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await this.peerConnection.setLocalDescription(offer);
      this.log('success', 'Local video call offer created and set');

      this.validateAndLogSDP(offer, 'Local Video Offer');

      // Send video call offer to server
      this.socket.emit('call:initiate', {
        targetUserId: targetUserId,
        callType: 'video',
        sdpOffer: offer
      });

      this.log('debug', 'Video call initiate sent to server');
      this.updateDebugInfo();
      this.notifyStateChange();

    } catch (error) {
      this.log('error', `Failed to start video call: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Display local video stream
   */
  displayLocalVideo() {
    this.localVideoElement = document.getElementById('localVideo');

    if (this.localVideoElement && this.localStream) {
      this.localVideoElement.srcObject = this.localStream;
      this.log('success', '📹 Local video stream displayed successfully');
    } else {
      this.log('warning', `Local video element not found or no stream available. Element: ${!!this.localVideoElement}, Stream: ${!!this.localStream}`);
    }
  }

  /**
   * Display remote video stream
   * @param {MediaStream} stream - The remote video stream
   */
  displayRemoteVideo(stream) {
    this.remoteVideoElement = document.getElementById('remoteVideo');
    const noRemoteVideoOverlay = document.getElementById('noRemoteVideo');

    if (this.remoteVideoElement && stream) {
      this.remoteVideoElement.srcObject = stream;

      // Hide "waiting for remote video" overlay
      if (noRemoteVideoOverlay) {
        noRemoteVideoOverlay.style.display = 'none';
      }

      this.log('success', '📹 Remote video stream displayed successfully');
    } else {
      this.log('warning', `Remote video element not found or no stream. Element: ${!!this.remoteVideoElement}, Stream: ${!!stream}`);
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callData) {
    try {
      console.debug(`📞 CALL DATA RECEIVE`, callData);
      this.log('info', `Answering call: ${callData.callId}`);

      // Use stored incoming call data if available, otherwise use provided data
      const actualCallData = this.incomingCallData || callData;
      this.currentCallId = actualCallData.callId;
      this.callState = 'connecting'; // Use connecting state while setting up
      this.isInitiator = false;

      // Determine if this is a video call
      this.isVideoCall = actualCallData.callType === 'video';

      // Get user media (video if it's a video call)
      await this.getUserMedia(this.isVideoCall);

      // Display local video if video call
      if (this.isVideoCall) {
        this.displayLocalVideo();
      }

      // PeerConnection should already exist from handleIncomingCall
      // If not, create it now (fallback)
      if (!this.peerConnection) {
        this.log('warning', '⚠️ PeerConnection not found, creating it now (this should not happen)');
        this.createPeerConnection();
      } else {
        this.log('success', '✅ Using existing PeerConnection created during incoming call');
      }

      // Add local stream
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Set remote description (offer)
      await this.peerConnection.setRemoteDescription(actualCallData.sdpOffer);
      this.log('debug', '📡 Remote description (offer) set successfully');

      // Validate and log SDP for debugging
      this.validateAndLogSDP(actualCallData.sdpOffer, 'Remote Offer');

      // Process any queued remote ICE candidates IMMEDIATELY after setting remote description
      // Process queued remote ICE candidates
      await this.flushRemoteIceCandidateQueue();

      // Create and send answer
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.isVideoCall
      });
      this.log('debug', '📞 Creating SDP answer');

      await this.peerConnection.setLocalDescription(answer);
      this.log('debug', 'Local description (answer) set');

      // Validate and log our answer SDP for debugging
      this.validateAndLogSDP(answer, 'Local Answer');

      // Send answer to server
      this.socket.emit('call:accept', {
        callId: this.currentCallId,
        sdpAnswer: answer
      });

      this.log('debug', 'Call accept sent to server');

      // Double-check for any additional remote ICE candidates that arrived
      setTimeout(async () => {
        await this.flushRemoteIceCandidateQueue();
      }, 100);

      this.updateDebugInfo();
      this.notifyStateChange();

    } catch (error) {
      this.log('error', `Failed to answer call: ${error.message}`);
      this.declineCall(this.currentCallId);
      throw error;
    }
  }

  /**
   * Decline an incoming call
   */
  declineCall(callId) {
    this.log('info', `Declining call: ${callId}`);

    this.socket.emit('call:decline', {
      callId: callId,
      reason: 'declined'
    });

    this.cleanup();
  }

  /**
   * Hang up current call
   */
  hangupCall() {
    if (!this.currentCallId) {
      this.log('warning', 'No active call to hang up');
      return;
    }

    this.log('info', `Hanging up call: ${this.currentCallId}`);

    this.socket.emit('call:hangup', {
      callId: this.currentCallId,
      reason: 'user_hangup'
    });

    this.cleanup();
  }

  /**
   * Toggle mute/unmute
   */
  toggleMute() {
    if (!this.localStream) {
      this.log('warning', 'No local stream to mute');
      return false;
    }

    this.isMuted = !this.isMuted;

    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });

    this.log('info', `Audio ${this.isMuted ? 'muted' : 'unmuted'}`);
    return this.isMuted;
  }

  /**
   * Toggle speaker on/off
   */
  toggleSpeaker() {
    this.isSpeakerOn = !this.isSpeakerOn;

    // In web browsers, this would typically control audio output device
    // For now, we'll just log the state
    this.log('info', `Speaker ${this.isSpeakerOn ? 'on' : 'off'}`);
    return this.isSpeakerOn;
  }

  /**
   * Switch camera between front and back - NEW for Phase 2
   */
  async switchCamera() {
    if (!this.localStream || !this.isVideoCall) {
      this.log('warning', 'No video stream available to switch camera');
      return false;
    }

    try {
      this.log('info', '🔄 Switching camera...');

      // Stop current video track
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.stop();
        this.localStream.removeTrack(track);
      });

      // Switch camera facing mode
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
      this.log('debug', `Switching to ${this.currentFacingMode} camera`);

      // Get new video stream with switched camera
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { min: 15, ideal: 30, max: 60 },
          facingMode: this.currentFacingMode
        }
      });

      // Add new video track to local stream
      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      this.localStream.addTrack(newVideoTrack);

      // Replace video track in peer connection
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s =>
          s.track && s.track.kind === 'video'
        );

        if (sender) {
          await sender.replaceTrack(newVideoTrack);
          this.log('success', '✅ Camera switched successfully');
        } else {
          this.log('warning', 'No video sender found in peer connection');
        }
      }

      // Update local video display
      this.displayLocalVideo();

      return true;
    } catch (error) {
      this.log('error', `❌ Failed to switch camera: ${error.message}`);
      return false;
    }
  }

  /**
   * Toggle video on/off - NEW for Phase 2
   */
  toggleVideo() {
    if (!this.localStream || !this.isVideoCall) {
      this.log('warning', 'No video stream available to toggle');
      return false;
    }

    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !track.enabled;
    });

    this.isVideoEnabled = videoTracks[0]?.enabled || false;
    this.log('info', `Video ${this.isVideoEnabled ? 'enabled' : 'disabled'}`);

    this.updateVideoUI();

    return this.isVideoEnabled;
  }

  /**
   * Update video UI elements - NEW for Phase 2
   */
  updateVideoUI() {
    const toggleBtn = document.getElementById('toggleVideoBtn');
    const toggleBtn2 = document.getElementById('toggleVideoBtn2');
    const muteAudioBtn = document.getElementById('muteAudioBtn');

    // Update video button icons
    const videoIcon = this.isVideoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
    if (toggleBtn) {
      const iconElement = toggleBtn.querySelector('i') || toggleBtn;
      iconElement.className = `${videoIcon} text-sm`;
    }
    if (toggleBtn2) {
      const iconElement = toggleBtn2.querySelector('i') || toggleBtn2;
      iconElement.className = `${videoIcon}`;
    }

    // Update audio button if available
    if (muteAudioBtn) {
      const audioIcon = this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
      const iconElement = muteAudioBtn.querySelector('i') || muteAudioBtn;
      iconElement.className = audioIcon;
    }

    // Update local video opacity
    if (this.localVideoElement) {
      this.localVideoElement.style.opacity = this.isVideoEnabled ? '1' : '0.3';
    }

    // Update camera mode indicator
    const switchCameraBtn = document.getElementById('switchCameraBtn');
    const switchCameraBtn2 = document.getElementById('switchCameraBtn2');
    const cameraTitle = this.currentFacingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera';

    if (switchCameraBtn) switchCameraBtn.title = cameraTitle;
    if (switchCameraBtn2) switchCameraBtn2.title = cameraTitle;

    this.log('debug', `Video UI updated - Video: ${this.isVideoEnabled}, Camera: ${this.currentFacingMode}`);
  }

  /**
   * Get available camera devices - NEW Task 1.4
   */
  async getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      this.log('debug', `Found ${videoDevices.length} video input devices`);

      return videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        facingMode: this.guessDeviceFacingMode(device.label)
      }));

    } catch (error) {
      this.log('error', `Failed to enumerate cameras: ${error.message}`);
      return [];
    }
  }

  /**
   * Guess camera facing mode from device label - NEW Task 1.4
   */
  guessDeviceFacingMode(label) {
    const lowerLabel = label.toLowerCase();

    if (lowerLabel.includes('front') || lowerLabel.includes('user') || lowerLabel.includes('selfie')) {
      return 'user';
    } else if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('environment')) {
      return 'environment';
    }

    return 'unknown';
  }

  /**
   * Check camera permissions - NEW Task 1.4
   */
  async checkCameraPermissions() {
    try {
      if (!navigator.permissions) {
        this.log('warning', 'Permissions API not supported');
        return 'unknown';
      }

      const cameraPermission = await navigator.permissions.query({ name: 'camera' });
      const micPermission = await navigator.permissions.query({ name: 'microphone' });

      this.log('debug', `Camera permission: ${cameraPermission.state}, Microphone permission: ${micPermission.state}`);

      return {
        camera: cameraPermission.state,
        microphone: micPermission.state
      };

    } catch (error) {
      this.log('warning', `Permission check failed: ${error.message}`);
      return 'unknown';
    }
  }

  /**
   * Request camera and microphone permissions - NEW Task 1.4
   */
  async requestMediaPermissions(includeVideo = false) {
    try {
      this.log('info', `Requesting ${includeVideo ? 'camera and microphone' : 'microphone'} permissions...`);

      const constraints = { audio: true };
      if (includeVideo) {
        constraints.video = true;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());

      this.log('success', `✅ ${includeVideo ? 'Camera and microphone' : 'Microphone'} permissions granted`);
      return true;

    } catch (error) {
      this.log('error', `❌ Permission request failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate and log SDP for debugging purposes
   */
  validateAndLogSDP(sdp, type) {
    try {
      this.log('info', `🔍 Analyzing ${type} SDP...`);

      const sdpText = sdp.sdp || sdp;
      const lines = sdpText.split('\n');

      // Check for common issues
      let issues = [];
      let warnings = [];
      let hasValidIP = false;
      let audioPort = null;
      let connectionIP = null;
      let originIP = null;

      lines.forEach((line, index) => {
        console.debug(`Analyzing line ${index + 1}: ${line}`);
        // Check origin line
        if (line.startsWith('o=')) {
          const originMatch = line.match(/o=\S+ \S+ \S+ IN IP4 ([^\s]+)/);
          if (originMatch) {
            originIP = originMatch[1];
            // Note: 127.0.0.1 and 0.0.0.0 are normal placeholders in initial SDP
            if (originIP.startsWith('192.168.') || originIP.startsWith('10.') || originIP.startsWith('172.')) {
              this.log('success', `✅ Good origin IP: ${originIP}`);
            }
          }
        }

        // Check connection line
        if (line.startsWith('c=')) {
          const connMatch = line.match(/c=IN IP4 ([^\s]+)/);
          if (connMatch) {
            connectionIP = connMatch[1];
            // Note: 0.0.0.0 is normal placeholder, will be replaced by ICE candidates
            if (connectionIP !== '0.0.0.0' && connectionIP !== '127.0.0.1') {
              hasValidIP = true;
              this.log('success', `✅ Good connection IP: ${connectionIP}`);
            }
          }
        }

        // Check media line
        if (line.startsWith('m=audio')) {
          const parts = line.split(' ');
          audioPort = parseInt(parts[1]);
          if (audioPort <= 1024) {
            warnings.push(`Line ${index + 1}: Using reserved port ${audioPort} - may be blocked by firewall`);
          } else if (audioPort === 9) {
            issues.push(`Line ${index + 1}: Using port 9 (discard protocol) - will cause connection failure`);
          } else {
            this.log('success', `✅ Audio port: ${audioPort}`);
          }
        }

        // Check RTCP line
        if (line.startsWith('a=rtcp:')) {
          const rtcpMatch = line.match(/a=rtcp:\d+ IN IP4 ([^\s]+)/);
          if (rtcpMatch) {
            const rtcpIP = rtcpMatch[1];
            // Note: 0.0.0.0 is normal placeholder for RTCP
            if (rtcpIP !== '0.0.0.0') {
              this.log('success', `✅ RTCP IP: ${rtcpIP}`);
            }
          }
        }

        // Check for candidate lines in SDP
        if (line.startsWith('a=candidate:')) {
          const candidateMatch = line.match(/a=candidate:\S+ \d+ \S+ \d+ ([^\s]+) \d+ typ (\S+)/);
          if (candidateMatch) {
            const candidateIP = candidateMatch[1];
            const candidateType = candidateMatch[2];
            if (candidateIP.startsWith('192.168.') || candidateIP.startsWith('10.')) {
              this.log('success', `✅ Good SDP candidate: ${candidateType} ${candidateIP}`);
            }
          }
        }
      });

      // Critical issue analysis
      const criticalIssues = issues.length;
      const totalIssues = issues.length + warnings.length;

      // Log analysis results
      if (criticalIssues > 0) {
        this.log('error', `🚨 ${type} SDP Critical Issues (${criticalIssues}):`);
        issues.forEach(issue => {
          this.log('error', `   • ${issue}`);
        });
      }

      if (warnings.length > 0) {
        this.log('warning', `⚠️  ${type} SDP Warnings (${warnings.length}):`);
        warnings.forEach(warning => {
          this.log('warning', `   • ${warning}`);
        });
      }

      if (criticalIssues === 0 && warnings.length === 0) {
        this.log('success', `✅ ${type} SDP looks excellent - ready for ICE candidate exchange`);
      } else if (criticalIssues === 0) {
        this.log('info', `👍 ${type} SDP looks good (only minor warnings) - ready for ICE candidate exchange`);
      } else {
        this.log('warning', `⚠️ ${type} SDP has some issues - but ICE candidates should handle connectivity`);
      }

      // Enhanced summary
      this.log('info', `📊 ${type} SDP Analysis Summary:`);
      this.log('info', `   • Origin IP: ${originIP || 'not found'} ${originIP === '127.0.0.1' || originIP === '0.0.0.0' ? '(placeholder - normal)' : ''}`);
      this.log('info', `   • Connection IP: ${connectionIP || 'not found'} ${connectionIP === '0.0.0.0' ? '(placeholder - normal)' : ''}`);
      this.log('info', `   • Audio Port: ${audioPort || 'not found'}`);
      this.log('info', `   • Critical Issues: ${criticalIssues}`);
      this.log('info', `   • Total Issues: ${totalIssues}`);
      this.log('info', `   • Note: ICE candidates will provide actual connectivity, SDP is just initial negotiation`);
      this.log('info', `   • SDP Quality: ${this.getSdpConnectivityRating(criticalIssues, hasValidIP)}`);

      // Log first few lines for reference
      const previewLines = lines.slice(0, 6).join('\n');
      this.log('debug', `📝 ${type} SDP Preview:\n${previewLines}...`);

      return {
        hasValidIP,
        criticalIssues,
        totalIssues,
        originIP,
        connectionIP,
        audioPort
      };

    } catch (error) {
      this.log('error', `Failed to validate ${type} SDP: ${error.message}`);
      return null;
    }
  }

  /**
   * Get SDP connectivity rating based on issues
   */
  getSdpConnectivityRating(criticalIssues, hasValidIP) {
    if (criticalIssues === 0) {
      return 'Good ⭐⭐⭐⭐ (Ready for ICE)';
    } else if (criticalIssues <= 2) {
      return 'Fair ⭐⭐ (ICE will handle connectivity)';
    } else {
      return 'Issues ⭐ (Relies on ICE candidates)';
    }
  }

  /**
   * Get user media (microphone and optionally video)
   * @param {boolean} includeVideo - Whether to include video stream
   * @param {string} facingMode - Camera facing mode ('user' or 'environment')
   */
  async getUserMedia(includeVideo = false, facingMode = 'user') {
    try {
      // Check if running in same-origin multiple tabs scenario
      if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Chrome')) {
        this.log('warning', '⚠️ Chrome detected - checking for multiple tab conflicts...');

        // Try to detect if another tab is using microphone/camera
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');
          const videoInputs = devices.filter(device => device.kind === 'videoinput');
          this.log('debug', `Found ${audioInputs.length} audio and ${videoInputs.length} video input devices`);
        } catch (enumError) {
          this.log('warning', `Failed to enumerate devices: ${enumError.message}`);
        }
      }

      this.log('debug', `Requesting ${includeVideo ? 'audio + video' : 'audio only'} access...`);

      // Enhanced audio constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      };

      // Add video constraints if needed
      if (includeVideo) {
        constraints.video = {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { min: 15, ideal: 30, max: 60 },
          facingMode: facingMode // 'user' for front camera, 'environment' for back camera
        };
      }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      this.log('success', `Local ${includeVideo ? 'audio + video' : 'audio'} stream acquired successfully`);
      this.setupAudioVisualization(this.localStream, 'local');

      // Store video capability info
      this.isVideoCall = includeVideo;
      this.currentFacingMode = facingMode;

      return this.localStream;
    } catch (error) {
      this.log('error', `❌ Failed to get user media: ${error.message}`);

      // Enhanced error handling for both audio and video
      if (error.name === 'NotAllowedError') {
        if (includeVideo) {
          this.log('error', '🚫 Camera/Microphone access denied by user or browser policy');
          this.log('info', '💡 Possible solutions:');
          this.log('info', '   • Click the camera/microphone icons in Chrome address bar and allow access');
          this.log('info', '   • Check if another tab is using the camera/microphone');
          this.log('info', '   • Try refreshing the page or restarting Chrome');

          // Fallback to audio-only if video fails
          this.log('info', '🔄 Attempting fallback to audio-only call...');
          try {
            return await this.getUserMedia(false);
          } catch (audioError) {
            this.log('error', `❌ Audio fallback also failed: ${audioError.message}`);
            throw audioError;
          }
        } else {
          this.log('error', '🚫 Microphone access denied by user or browser policy');
          this.log('info', '💡 Possible solutions:');
          this.log('info', '   • Click the microphone icon in Chrome address bar and allow access');
          this.log('info', '   • Check if another tab is using the microphone');
          this.log('info', '   • Try refreshing the page or restarting Chrome');
        }
      } else if (error.name === 'NotReadableError') {
        const deviceType = includeVideo ? 'Camera/Microphone' : 'Microphone';
        this.log('error', `🔒 ${deviceType} is being used by another application`);
        this.log('info', '💡 Possible solutions:');
        this.log('info', '   • Close other applications using camera/microphone (Zoom, Teams, etc.)');
        this.log('info', '   • Close other Chrome tabs that might be using camera/microphone');
        this.log('info', '   • Check Windows sound settings for exclusive mode');
      } else if (error.name === 'NotFoundError') {
        const deviceType = includeVideo ? 'camera or microphone' : 'microphone';
        this.log('error', `🎤📹 No ${deviceType} found on this device`);
      } else if (error.name === 'OverconstrainedError') {
        this.log('error', `⚙️ ${includeVideo ? 'Camera/Microphone' : 'Microphone'} constraints not supported`);
        this.log('info', '💡 Trying with basic constraints...');

        // Fallback: try with basic constraints
        try {
          const basicConstraints = { audio: true };
          if (includeVideo) {
            basicConstraints.video = true;
          }

          this.localStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
          this.log('success', `✅ ${includeVideo ? 'Camera/Microphone' : 'Microphone'} access granted with basic constraints`);
          this.setupAudioVisualization(this.localStream, 'local');
          return this.localStream;
        } catch (fallbackError) {
          this.log('error', `❌ Fallback also failed: ${fallbackError.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Create WebRTC peer connection with enhanced monitoring
   */
  createPeerConnection() {
    this.log('info', '🔧 Creating PeerConnection with enhanced monitoring...');

    // Enhanced config for LAN connections with proper IP handling
    const enhancedConfig = {
      ...this.config,
      // Force ICE to gather all candidates including host candidates
      iceTransportPolicy: 'all',
      // Increase ICE candidate pool for better connectivity
      iceCandidatePoolSize: 20,
      // Additional constraints for LAN connections
      rtcConfiguration: {
        // Force gathering of local network candidates
        gatherIceCandidates: true,
        // Prefer local network interfaces
        preferLocalCandidates: true
      }
    };

    this.peerConnection = new RTCPeerConnection(enhancedConfig);

    // Log initial state
    this.log('debug', `Initial PeerConnection state - ICE: ${this.peerConnection.iceConnectionState}, Signaling: ${this.peerConnection.signalingState}`);

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.log('success', `🎵 Remote ${event.track.kind} stream received`);
      this.remoteStream = event.streams[0];

      // Handle audio track
      if (event.track.kind === 'audio') {
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio) {
          remoteAudio.srcObject = this.remoteStream;
          this.log('debug', '🎵 Remote audio connected to element');
        } else {
          this.log('warning', '⚠️ Remote audio element not found');
        }
        this.setupAudioVisualization(this.remoteStream, 'remote');
      }

      // Handle video track - NEW for Phase 2
      if (event.track.kind === 'video') {

        if (this.isVideoCall) {
          this.displayRemoteVideo(this.remoteStream);
          this.log('success', '📹 Remote video stream displayed');
        } else {
          this.log('info', '📹 Video track received but this is not a video call');
        }
      }
    };

    // Handle ICE candidates with enhanced debug info and filtering
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate;

        // Log detailed candidate info
        this.log('debug', `🧊 Local ICE candidate generated: ${candidate.type} (${candidate.protocol}) - ${candidate.address || 'no-address'}`);
        this.log('debug', `   └─ Foundation: ${candidate.foundation}, Priority: ${candidate.priority}, Port: ${candidate.port}`);

        // Filter out problematic candidates for LAN connections
        const shouldFilterCandidate = this.shouldFilterIceCandidate(candidate);
        if (shouldFilterCandidate) {
          this.log('warning', `🚫 Filtering out ICE candidate: ${shouldFilterCandidate}`);
          return;
        }

        if (this.currentCallId) {
          // Send immediately if we have callId
          this.socket.emit('call:ice_candidate', {
            callId: this.currentCallId,
            candidate: candidate
          });
          this.log('debug', '📤 ICE candidate sent immediately');
        } else {
          // Queue candidate if callId not available yet
          this.log('debug', '📥 Queueing ICE candidate (waiting for callId)');
          this.iceCandidateQueue.push(candidate);
        }
      } else {
        this.log('debug', '🏁 ICE candidate gathering completed');
        // Force flush any remaining queued candidates when gathering is complete
        setTimeout(() => {
          this.flushIceCandidateQueue();
        }, 100);
      }
    };

    // Handle ICE gathering state changes
    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection.iceGatheringState;
      this.log('debug', `🔍 ICE gathering state: ${state}`);

      if (state === 'complete') {
        this.log('success', '✅ ICE gathering completed successfully');
      }
    };

    // Handle connection state changes with extended timeout handling
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.log('info', `🔗 ICE connection state: ${state}`);

      if (state === 'connected' || state === 'completed') {
        this.callState = 'active';
        this.log('success', `🎉 WebRTC connection established successfully!`);
        this.notifyStateChange();
      } else if (state === 'checking') {
        this.log('info', '🔍 ICE connection checking - this may take longer for LAN connections');
        // Give more time for LAN connections
        setTimeout(() => {
          if (this.peerConnection?.iceConnectionState === 'checking') {
            this.log('warning', '⏰ ICE checking taking longer than expected, but continuing...');
          }
        }, 10000); // 10 seconds warning
      } else if (state === 'failed') {
        this.log('error', `❌ ICE connection failed: ${state}`);

        // For LAN connections, try to restart ICE if we haven't established connection yet
        if (this.callState !== 'active') {
          this.log('info', '🔄 Attempting ICE restart for LAN connection...');
          this.restartIce();
        } else {
          this.cleanup();
        }
      } else if (state === 'disconnected') {
        this.log('warning', `⚠️ ICE connection disconnected: ${state}`);

        // For LAN, disconnected doesn't always mean failed - give it time to reconnect
        setTimeout(() => {
          if (this.peerConnection?.iceConnectionState === 'disconnected') {
            this.log('error', '❌ ICE connection remained disconnected, cleaning up');
            this.cleanup();
          }
        }, 5000); // 5 second grace period
      }

      this.updateDebugInfo();
    };

    // Handle signaling state changes with detailed logging
    this.peerConnection.onsignalingstatechange = () => {
      const state = this.peerConnection.signalingState;
      this.log('debug', `📡 Signaling state changed: ${state}`);

      // Track signaling state for debugging
      if (state === 'stable') {
        this.log('debug', '✅ Signaling reached stable state');
      } else if (state === 'closed') {
        this.log('warning', '🔴 Signaling state closed');
      }
    };

    // Handle connection state changes (newer API)
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.log('info', `🔌 Connection state: ${state}`);

      if (state === 'connected') {
        this.log('success', '🚀 PeerConnection fully connected!');
      } else if (state === 'failed' || state === 'disconnected') {
        this.log('error', `💥 PeerConnection failed: ${state}`);
        this.cleanup();
      }
    };

    this.log('success', '✅ PeerConnection created with all event handlers');
  }

  /**
   * Handle incoming call event
   */
  handleIncomingCall(data) {
    this.log('success', `🚨 PROCESSING INCOMING CALL: ${data.callId}`);
    this.currentCallId = data.callId;
    this.callState = 'ringing';

    // CRITICAL: Immediately join call room to receive ICE candidates
    this.socket.emit('call:join_room', { callId: data.callId });
    this.log('debug', `📞 Joining call room: call:${data.callId} to receive ICE candidates`);

    // CRITICAL FIX: Create PeerConnection immediately to handle incoming ICE candidates
    // This prevents "No peer connection" errors when remote peer sends ICE candidates
    this.log('info', '🔧 Creating PeerConnection immediately for incoming call to handle ICE candidates');
    this.createPeerConnection();

    // Store the incoming call data for later use when user answers
    this.incomingCallData = data;
    this.log('debug', '📦 Stored incoming call data for when user answers');

    this.log('debug', `Setting call state to 'ringing' and calling onIncomingCall callback`);

    if (this.onIncomingCall) {
      this.log('debug', `onIncomingCall callback exists, calling it now`);
      this.onIncomingCall(data);
    } else {
      this.log('error', `❌ onIncomingCall callback is NOT SET!`);
    }

    this.notifyStateChange();
  }

  /**
   * Handle call accepted event (for initiator)
   */
  async handleCallAccepted(data) {
    try {
      this.log('info', `🎉 Processing call:accepted event. Is initiator: ${this.isInitiator}, CallId: ${data.callId}`);
      this.log('debug', `   ├─ Current call: ${this.currentCallId}`);
      this.log('debug', `   ├─ Has SDP answer: ${!!data.sdpAnswer}`);
      this.log('debug', `   └─ PeerConnection exists: ${!!this.peerConnection}`);

      // Only initiator should handle this event
      if (!this.isInitiator) {
        this.log('debug', 'Ignoring call:accepted event - not the initiator');
        return;
      }

      // Verify this is our call
      if (this.currentCallId !== data.callId) {
        this.log('warning', `Ignoring call:accepted for different call: ${data.callId} vs ${this.currentCallId}`);
        return;
      }

      // Check peer connection state
      if (!this.peerConnection) {
        this.log('error', 'No peer connection available to set remote description');
        return;
      }

      const currentState = this.peerConnection.signalingState;
      this.log('debug', `PeerConnection signaling state: ${currentState}`);

      this.currentCallId = data.callId;
      this.callState = 'active';

      // Set remote description (answer) only if we're in the right state
      if (data.sdpAnswer && (currentState === 'have-local-offer' || currentState === 'stable')) {
        if (currentState === 'stable') {
          this.log('warning', 'PeerConnection already in stable state, skipping setRemoteDescription');
        } else {
          // Validate and log remote answer SDP
          this.validateAndLogSDP(data.sdpAnswer, 'Remote Answer');

          await this.peerConnection.setRemoteDescription(data.sdpAnswer);
          this.log('success', '📡 Remote description (answer) set successfully');

          // Process any queued remote ICE candidates IMMEDIATELY
          this.log('info', '🔄 Flushing remote ICE candidate queue after accepting call...');
          await this.flushRemoteIceCandidateQueue();

          // Double-check for additional candidates after a short delay
          setTimeout(async () => {
            this.log('debug', '🔄 Double-checking remote ICE candidate queue...');
            await this.flushRemoteIceCandidateQueue();
          }, 200);
        }
      } else if (!data.sdpAnswer) {
        this.log('warning', 'No SDP answer received in call:accepted event');
      }

      this.updateDebugInfo();
      this.notifyStateChange();

    } catch (error) {
      this.log('error', `Failed to handle call accepted: ${error.message}`);
      this.log('debug', `PeerConnection state: ${this.peerConnection?.signalingState}`);
    }
  }

  /**
   * Handle call accept confirmed event (for acceptor)
   */
  handleCallAcceptConfirmed(data) {
    this.log('info', `🎯 Processing call:accept_confirmed event. Is initiator: ${this.isInitiator}, CallId: ${data.callId}`);
    this.log('debug', `   ├─ Current call: ${this.currentCallId}`);
    this.log('debug', `   ├─ Current state: ${this.callState}`);
    this.log('debug', `   └─ PeerConnection exists: ${!!this.peerConnection}`);

    // Only acceptor should handle this event
    if (this.isInitiator) {
      this.log('debug', 'Ignoring call:accept_confirmed event - this is the initiator');
      return;
    }

    // Verify this is our call
    if (this.currentCallId !== data.callId) {
      this.log('warning', `Ignoring call:accept_confirmed for different call: ${data.callId} vs ${this.currentCallId}`);
      return;
    }

    this.log('success', `✅ Call accept confirmed for acceptor: ${data.callId}`);
    this.callState = 'active';

    // Log peer connection state
    if (this.peerConnection) {
      this.log('debug', `📊 PeerConnection state after accept confirmed:`);
      this.log('debug', `   ├─ ICE: ${this.peerConnection.iceConnectionState}`);
      this.log('debug', `   ├─ Signaling: ${this.peerConnection.signalingState}`);
      this.log('debug', `   ├─ Connection: ${this.peerConnection.connectionState}`);
      this.log('debug', `   ├─ Has local description: ${!!this.peerConnection.localDescription}`);
      this.log('debug', `   ├─ Has remote description: ${!!this.peerConnection.remoteDescription}`);
      this.log('debug', `   └─ Remote ICE queue length: ${this.remoteIceCandidateQueue.length}`);

      // Process any queued ICE candidates
      if (this.remoteIceCandidateQueue.length > 0) {
        this.log('info', '🔄 Processing queued remote ICE candidates for acceptor...');
        this.flushRemoteIceCandidateQueue();
      }
    }

    this.updateDebugInfo();
    this.notifyStateChange();
  }

  /**
   * Handle call declined event
   */
  handleCallDeclined(data) {
    this.log('warning', `Call declined by ${data.userId}`);
    this.cleanup();
  }

  /**
   * Handle call hangup event
   */
  handleCallHangup(data) {
    this.log('info', `Call ended by remote user: ${data.callId}`);
    this.cleanup();
  }

  /**
   * Handle ICE candidate from remote peer with enhanced error handling
   */
  async handleIceCandidate(data) {
    try {
      if (!this.peerConnection || !data.candidate) {
        this.log('warning', 'No peer connection or candidate data available');
        console.log('⚠️ CANNOT PROCESS REMOTE CANDIDATE:', {
          hasPeerConnection: !!this.peerConnection,
          hasCandidate: !!data.candidate,
          callId: data.callId
        });
        return;
      }

      const candidate = data.candidate;

      // Log received candidate with detailed info
      this.log('debug', `📱 Received remote ICE candidate: ${candidate.type || 'unknown'} (${candidate.protocol || 'unknown'}) - ${candidate.address || 'no-address'}`);

      console.log('🔍 PROCESSING REMOTE ICE CANDIDATE:', {
        callId: data.callId,
        candidate: candidate,
        queueLength: this.remoteIceCandidateQueue.length,
        hasRemoteDescription: !!this.peerConnection.remoteDescription
      });

      // Validate candidate before processing
      if (!candidate.candidate || candidate.candidate.trim() === '') {
        this.log('warning', '🚫 Ignoring invalid remote ICE candidate: empty candidate string');
        console.log('❌ INVALID REMOTE CANDIDATE - Empty string:', candidate);
        return;
      }

      // Filter problematic remote candidates
      const shouldFilter = this.shouldFilterRemoteIceCandidate(candidate);
      if (shouldFilter) {
        this.log('warning', `🚫 Filtering remote ICE candidate: ${shouldFilter}`);
        console.log('❌ FILTERED REMOTE CANDIDATE:', {
          reason: shouldFilter,
          candidate: candidate
        });
        return;
      }

      // Check if we have remote description set
      if (!this.peerConnection.remoteDescription) {
        this.log('debug', '🚫 Remote description not set yet, queueing remote ICE candidate');
        this.remoteIceCandidateQueue.push(candidate);
        this.log('debug', `📥 Remote ICE queue now has ${this.remoteIceCandidateQueue.length} candidates`);
        console.log('📥 QUEUED REMOTE CANDIDATE - No remote description yet:', {
          candidate: candidate,
          queueLength: this.remoteIceCandidateQueue.length,
          signalingState: this.peerConnection.signalingState
        });
        return;
      }

      // Add ICE candidate immediately if remote description is available
      await this.peerConnection.addIceCandidate(candidate);
      this.log('debug', '✅ Remote ICE candidate added successfully');
      console.log('✅ SUCCESSFULLY ADDED REMOTE ICE CANDIDATE:', {
        candidate: {
          type: candidate.type,
          protocol: candidate.protocol,
          address: candidate.address,
          port: candidate.port
        },
        iceConnectionState: this.peerConnection.iceConnectionState,
        connectionState: this.peerConnection.connectionState
      });

    } catch (error) {
      this.log('error', `❌ Failed to add ICE candidate: ${error.message}`);
      console.log('❌ FAILED TO ADD REMOTE ICE CANDIDATE:', {
        error: error.message,
        candidate: data.candidate,
        peerConnectionState: {
          iceConnectionState: this.peerConnection?.iceConnectionState,
          signalingState: this.peerConnection?.signalingState,
          hasRemoteDescription: !!this.peerConnection?.remoteDescription
        }
      });

      // If failed due to remote description not ready, queue it
      if (error.message.includes('remote description was null') ||
        error.message.includes('Cannot add ICE candidate')) {
        this.log('debug', '📥 Queueing ICE candidate due to remote description issue');
        this.remoteIceCandidateQueue.push(data.candidate);
        this.log('debug', `📥 Remote ICE queue now has ${this.remoteIceCandidateQueue.length} candidates`);
        console.log('📥 RE-QUEUED FAILED CANDIDATE:', {
          candidate: data.candidate,
          queueLength: this.remoteIceCandidateQueue.length,
          error: error.message
        });
      }
    }
  }

  /**
   * Filter ICE candidates to improve LAN connectivity
   */
  shouldFilterIceCandidate(candidate) {
    if (!candidate || !candidate.address) {
      return false;
    }

    const address = candidate.address;
    const port = candidate.port;

    // Critical: Filter out port 9 (discard protocol) - always blocked by firewall
    if (port === 9) {
      return 'Port 9 (discard protocol) - blocked by firewall';
    }

    // Filter out all reserved ports (1-1024) except common ones
    if (port && port <= 1024 && port !== 80 && port !== 443) {
      return `Reserved port ${port} - likely blocked by firewall`;
    }

    // Filter out WSL/Docker virtual interfaces
    if (address.startsWith('172.')) {
      // Common Docker/WSL ranges: 172.16.0.0/12, 172.17.0.0/16, etc.
      const parts = address.split('.');
      const secondOctet = parseInt(parts[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return 'WSL/Docker virtual interface';
      }
    }

    // Filter out other virtual interfaces
    if (address.startsWith('169.254.')) {
      return 'Link-local address (APIPA)';
    }

    // Filter out localhost
    if (address === '127.0.0.1' || address === '::1') {
      return 'Localhost address';
    }

    // Prefer UDP over TCP for better performance
    if (candidate.protocol === 'tcp' && candidate.type === 'host') {
      // Allow TCP host candidates but with lower priority
      this.log('debug', '⚠️ TCP host candidate detected - may have lower priority');
    }

    // Log useful candidates
    if (candidate.type === 'host' &&
      (address.startsWith('192.168.') || address.startsWith('10.') || address.startsWith('172.'))) {
      this.log('success', `✅ Good LAN candidate: ${candidate.type} ${candidate.protocol} ${address}:${candidate.port}`);
    }

    return false; // Don't filter
  }

  /**
   * Filter remote ICE candidates received from peer
   */
  shouldFilterRemoteIceCandidate(candidate) {
    // Basic validation
    if (!candidate) {
      return 'Invalid candidate object';
    }

    if (!candidate.candidate || typeof candidate.candidate !== 'string') {
      return 'Missing or invalid candidate string';
    }

    // Check for undefined/null address
    if (candidate.address === undefined || candidate.address === null) {
      return 'Undefined/null address';
    }

    // Check for empty address
    if (candidate.address === '' || candidate.address.trim() === '') {
      return 'Empty address';
    }

    // Critical: Filter out port 9 (discard protocol) - always blocked by firewall
    if (candidate.port === 9) {
      return 'Remote port 9 (discard protocol) - blocked by firewall';
    }

    // Filter out all reserved ports (1-1024) except common ones
    if (candidate.port && candidate.port <= 1024 && candidate.port !== 80 && candidate.port !== 443) {
      return `Remote reserved port ${candidate.port} - likely blocked by firewall`;
    }

    // Apply same filtering logic as local candidates
    if (candidate.address) {
      const address = candidate.address;

      // Filter out WSL/Docker virtual interfaces from remote
      if (address.startsWith('172.')) {
        const parts = address.split('.');
        const secondOctet = parseInt(parts[1]);
        if (secondOctet >= 16 && secondOctet <= 31) {
          return 'Remote WSL/Docker virtual interface';
        }
      }

      // Filter out link-local addresses
      if (address.startsWith('169.254.')) {
        return 'Remote link-local address (APIPA)';
      }

      // Filter out localhost from remote (shouldn't happen but just in case)
      if (address === '127.0.0.1' || address === '::1') {
        return 'Remote localhost address';
      }

      // Log good remote candidates
      if (candidate.type === 'host' &&
        (address.startsWith('192.168.') || address.startsWith('10.') ||
          (address.startsWith('172.') && !this.isWSLInterface(address)))) {
        this.log('success', `✅ Good remote LAN candidate: ${candidate.type} ${candidate.protocol || 'unknown'} ${address}:${candidate.port || 'unknown'}`);
      }
    }

    return false; // Don't filter
  }

  /**
   * Handle renegotiation offer from remote peer
   */
  async handleRenegotiation(data) {
    try {
      if (!this.peerConnection || !data.sdpOffer) {
        this.log('warning', 'No peer connection or SDP offer for renegotiation');
        return;
      }

      this.log('info', '🔄 Processing renegotiation offer...');

      // Set remote description (renegotiation offer)
      await this.peerConnection.setRemoteDescription(data.sdpOffer);
      this.log('debug', '📡 Renegotiation remote description set');

      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.log('debug', '📡 Renegotiation answer created');

      // Send renegotiation answer
      this.socket.emit('call:renegotiate', {
        callId: this.currentCallId,
        sdpAnswer: answer
      });

      this.log('success', '✅ Renegotiation completed');

    } catch (error) {
      this.log('error', `❌ Failed to handle renegotiation: ${error.message}`);
    }
  }

  /**
   * Setup audio visualization
   */
  setupAudioVisualization(stream, type) {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const analyser = this.audioContext.createAnalyser();
      const microphone = this.audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      microphone.connect(analyser);

      if (type === 'local') {
        this.localAnalyzer = { analyser, dataArray };
      } else {
        this.remoteAnalyzer = { analyser, dataArray };
      }

      this.startAudioVisualization();

    } catch (error) {
      this.log('debug', `Audio visualization setup failed: ${error.message}`);
    }
  }

  /**
   * Start audio level visualization
   */
  startAudioVisualization() {
    const updateVisualization = () => {
      if (this.localAnalyzer) {
        this.localAnalyzer.analyser.getByteFrequencyData(this.localAnalyzer.dataArray);
        const average = this.localAnalyzer.dataArray.reduce((a, b) => a + b) / this.localAnalyzer.dataArray.length;
        this.updateAudioLevel('local', average);
      }

      if (this.remoteAnalyzer) {
        this.remoteAnalyzer.analyser.getByteFrequencyData(this.remoteAnalyzer.dataArray);
        const average = this.remoteAnalyzer.dataArray.reduce((a, b) => a + b) / this.remoteAnalyzer.dataArray.length;
        this.updateAudioLevel('remote', average);
      }

      if (this.callState === 'active' || this.callState === 'initiating') {
        requestAnimationFrame(updateVisualization);
      }
    };

    updateVisualization();
  }

  /**
   * Update audio level visualization in UI
   */
  updateAudioLevel(type, level) {
    const waves = document.querySelectorAll(`#${type}AudioLevel .audio-wave`);
    const normalizedLevel = Math.min(level / 50, 1); // Normalize to 0-1

    waves.forEach((wave, index) => {
      const threshold = (index + 1) / waves.length;
      if (normalizedLevel > threshold) {
        wave.style.animationPlayState = 'running';
        wave.style.opacity = '1';
      } else {
        wave.style.animationPlayState = 'paused';
        wave.style.opacity = '0.3';
      }
    });
  }

  /**
   * Update debug information in UI
   */
  updateDebugInfo() {
    if (this.onDebugUpdate) {
      const debugInfo = {
        localDescription: this.peerConnection?.localDescription?.sdp || '',
        remoteDescription: this.peerConnection?.remoteDescription?.sdp || '',
        iceConnectionState: this.peerConnection?.iceConnectionState || 'new',
        callId: this.currentCallId,
        callState: this.callState
      };

      this.onDebugUpdate(debugInfo);
    }
  }

  /**
   * Notify UI of state changes
   */
  notifyStateChange() {
    if (this.onCallStateChanged) {
      this.onCallStateChanged({
        callId: this.currentCallId,
        state: this.callState,
        isInitiator: this.isInitiator,
        isMuted: this.isMuted,
        isSpeakerOn: this.isSpeakerOn
      });
    }
  }

  /**
   * Process queued remote ICE candidates after remote description is set
   */
  async flushRemoteIceCandidateQueue() {
    if (this.remoteIceCandidateQueue.length > 0 && this.peerConnection && this.peerConnection.remoteDescription) {
      this.log('info', `🔄 Processing ${this.remoteIceCandidateQueue.length} queued remote ICE candidates`);
      console.log('🔄 FLUSHING REMOTE ICE CANDIDATE QUEUE:', {
        queueLength: this.remoteIceCandidateQueue.length,
        callId: this.currentCallId,
        isInitiator: this.isInitiator,
        hasRemoteDescription: !!this.peerConnection.remoteDescription,
        signalingState: this.peerConnection.signalingState
      });

      const candidates = [...this.remoteIceCandidateQueue];
      this.remoteIceCandidateQueue = [];

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        try {
          // Apply filtering to queued candidates as well
          const shouldFilter = this.shouldFilterRemoteIceCandidate(candidate);
          if (shouldFilter) {
            this.log('warning', `🚫 Filtering queued remote ICE candidate: ${shouldFilter}`);
            console.log(`❌ FILTERED QUEUED CANDIDATE ${i + 1}/${candidates.length}:`, {
              reason: shouldFilter,
              candidate: candidate
            });
            continue; // Skip this candidate
          }

          await this.peerConnection.addIceCandidate(candidate);
          this.log('debug', `✅ Queued remote ICE candidate added: ${candidate.type || 'unknown'}`);
          console.log(`✅ ADDED QUEUED CANDIDATE ${i + 1}/${candidates.length}:`, {
            candidate: {
              type: candidate.type,
              protocol: candidate.protocol,
              address: candidate.address,
              port: candidate.port
            },
            iceConnectionState: this.peerConnection.iceConnectionState
          });
        } catch (error) {
          this.log('error', `❌ Failed to add queued ICE candidate: ${error.message}`);
          console.log(`❌ FAILED TO ADD QUEUED CANDIDATE ${i + 1}/${candidates.length}:`, {
            error: error.message,
            candidate: candidate,
            peerConnectionState: {
              iceConnectionState: this.peerConnection.iceConnectionState,
              signalingState: this.peerConnection.signalingState
            }
          });

          // Log candidate details for debugging
          this.log('debug', `   └─ Failed candidate: ${JSON.stringify({
            type: candidate.type,
            address: candidate.address,
            protocol: candidate.protocol,
            port: candidate.port
          })}`);

          // Re-queue if still having issues
          if (error.message.includes('remote description was null')) {
            this.remoteIceCandidateQueue.push(candidate);
            console.log('📥 RE-QUEUED FAILED CANDIDATE due to null remote description:', candidate);
          }
        }
      }

      this.log('success', `🎯 Finished processing remote ICE candidate queue. Remaining: ${this.remoteIceCandidateQueue.length}`);
      console.log('🎯 FLUSH COMPLETE:', {
        processedCount: candidates.length,
        remainingInQueue: this.remoteIceCandidateQueue.length,
        finalIceState: this.peerConnection.iceConnectionState
      });
    } else if (this.remoteIceCandidateQueue.length > 0) {
      this.log('debug', `⏳ Cannot flush remote ICE queue yet. PeerConnection: ${!!this.peerConnection}, RemoteDescription: ${!!this.peerConnection?.remoteDescription}`);
      console.log('⏳ CANNOT FLUSH QUEUE YET:', {
        queueLength: this.remoteIceCandidateQueue.length,
        hasPeerConnection: !!this.peerConnection,
        hasRemoteDescription: !!this.peerConnection?.remoteDescription,
        signalingState: this.peerConnection?.signalingState
      });
    }
  }

  /**
   * Send queued ICE candidates when callId becomes available
   */
  flushIceCandidateQueue() {
    if (this.iceCandidateQueue.length > 0 && this.currentCallId) {
      this.log('info', `Sending ${this.iceCandidateQueue.length} queued ICE candidates`);
      console.log('📤 FLUSHING LOCAL ICE CANDIDATE QUEUE:', {
        queueLength: this.iceCandidateQueue.length,
        callId: this.currentCallId,
        isInitiator: this.isInitiator
      });

      this.iceCandidateQueue.forEach((candidate, index) => {
        this.socket.emit('call:ice_candidate', {
          callId: this.currentCallId,
          candidate: candidate
        });
        console.log(`📤 SENT QUEUED LOCAL CANDIDATE ${index + 1}/${this.iceCandidateQueue.length}:`, {
          callId: this.currentCallId,
          candidate: {
            type: candidate.type,
            protocol: candidate.protocol,
            address: candidate.address,
            port: candidate.port,
            candidateString: candidate.candidate
          }
        });
      });

      console.log('🎯 LOCAL QUEUE FLUSH COMPLETE:', {
        sentCount: this.iceCandidateQueue.length,
        callId: this.currentCallId
      });
      this.iceCandidateQueue = [];
    } else {
      console.log('⏳ CANNOT FLUSH LOCAL QUEUE:', {
        queueLength: this.iceCandidateQueue.length,
        currentCallId: this.currentCallId
      });
    }
  }

  /**
   * Restart ICE connection for failed LAN connections
   */
  async restartIce() {
    try {
      if (!this.peerConnection) {
        this.log('warning', 'Cannot restart ICE - no peer connection');
        return;
      }

      this.log('info', '🔄 Restarting ICE connection...');

      // Use restartIce() if available (modern browsers)
      if (this.peerConnection.restartIce) {
        this.peerConnection.restartIce();
        this.log('debug', '✅ ICE restart initiated using restartIce()');
      } else {
        // Fallback for older browsers - create new offer
        this.log('debug', '🔄 Using fallback ICE restart method');

        if (this.isInitiator) {
          const offer = await this.peerConnection.createOffer({ iceRestart: true });
          await this.peerConnection.setLocalDescription(offer);

          // Send renegotiation offer to peer
          this.socket.emit('call:renegotiate', {
            callId: this.currentCallId,
            sdpOffer: offer
          });

          this.log('debug', '📤 ICE restart offer sent');
        }
      }
    } catch (error) {
      this.log('error', `❌ Failed to restart ICE: ${error.message}`);
      // If restart fails, cleanup
      this.cleanup();
    }
  }

  /**
   * Cleanup call resources
   */
  cleanup() {
    this.log('info', 'Cleaning up call resources');

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        this.log('debug', `Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      this.log('debug', 'Peer connection closed');
    }

    // Reset state
    this.currentCallId = null;
    this.callState = 'idle';
    this.isInitiator = false;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.incomingCallData = null;
    this.callState = 'idle';
    this.isInitiator = false;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.remoteStream = null;
    this.localAnalyzer = null;
    this.remoteAnalyzer = null;

    // Reset video call state - NEW for Phase 2
    this.isVideoCall = false;
    this.isVideoEnabled = true;
    this.currentFacingMode = 'user';

    // Clean up video elements
    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
      this.localVideoElement = null;
    }

    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = null;
      this.remoteVideoElement = null;
    }

    // Reset video overlay - Show "waiting for remote video" message
    const noRemoteVideoOverlay = document.getElementById('noRemoteVideo');
    if (noRemoteVideoOverlay) {
      noRemoteVideoOverlay.style.display = 'flex';
    }

    // Clear ICE candidate queues
    this.iceCandidateQueue = [];
    this.remoteIceCandidateQueue = [];

    // Notify UI
    this.notifyStateChange();
    this.updateDebugInfo();

    if (this.onCallEnded) {
      this.onCallEnded();
    }
  }

  /**
   * Logging utility
   */
  log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    console.log(logEntry);

    // Add to UI logs if available
    const logsElement = document.getElementById('logs');
    if (logsElement) {
      const logDiv = document.createElement('div');
      logDiv.className = `log-entry log-${level}`;
      logDiv.textContent = logEntry;
      logsElement.appendChild(logDiv);
      logsElement.scrollTop = logsElement.scrollHeight;
    }
  }

  /**
   * Get current call state
   */
  getCallState() {
    return {
      callId: this.currentCallId,
      state: this.callState,
      isConnected: this.isConnected,
      isInitiator: this.isInitiator,
      isMuted: this.isMuted,
      isSpeakerOn: this.isSpeakerOn
    };
  }
}
