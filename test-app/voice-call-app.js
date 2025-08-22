/**
 * Voice Call Test Application - Main UI Controller
 * 
 * Connects the VoiceCallService với HTML UI elements
 * Handles user interactions và updates UI based on call state
 */

class VoiceCallApp {
  constructor() {
    this.voiceService = new VoiceCallService();
    this.authService = null;
    this.currentUser = null;
    this.authToken = null;
    this.callDurationInterval = null;
    this.callStartTime = null;

    // Initialize app
    this.initializeEventListeners();
    this.setupServiceCallbacks();
    this.updateConnectionStatus(false);
  }

  /**
   * Initialize all event listeners for UI elements
   */
  initializeEventListeners() {
    // Authentication controls
    document.getElementById('healthCheckBtn').addEventListener('click', () => {
      this.handleHealthCheck();
    });

    document.getElementById('loginBtn').addEventListener('click', () => {
      this.handleLogin();
    });

    document.getElementById('disconnectBtn').addEventListener('click', () => {
      this.handleDisconnect();
    });

    // Quick test user buttons
    document.getElementById('useTestUser1').addEventListener('click', () => {
      this.useTestUser('user1');
    });

    document.getElementById('useTestUser2').addEventListener('click', () => {
      this.useTestUser('user2');
    });

    document.getElementById('testMicBtn').addEventListener('click', () => {
      this.handleTestMicrophone();
    });

    // Call controls
    document.getElementById('startCallBtn').addEventListener('click', () => {
      this.handleStartCall();
    });

    // NEW Task 1.3: Video Call Controls
    document.getElementById('startVideoCallBtn').addEventListener('click', () => {
      this.handleStartVideoCall();
    });

    // Video call control buttons
    document.getElementById('toggleVideoBtn').addEventListener('click', () => {
      this.handleToggleVideo();
    });

    document.getElementById('toggleVideoBtn2').addEventListener('click', () => {
      this.handleToggleVideo();
    });

    document.getElementById('switchCameraBtn').addEventListener('click', () => {
      this.handleSwitchCamera();
    });

    document.getElementById('switchCameraBtn2').addEventListener('click', () => {
      this.handleSwitchCamera();
    });

    document.getElementById('muteAudioBtn').addEventListener('click', () => {
      this.handleToggleMute();
    });

    document.getElementById('hangupVideoBtn').addEventListener('click', () => {
      this.handleHangup();
    });

    // Camera mode selection
    document.getElementById('cameraMode').addEventListener('change', () => {
      this.updateCameraSelection();
    });

    // Test camera button - NEW Task 1.4
    document.getElementById('testCameraBtn').addEventListener('click', () => {
      this.handleTestCamera();
    });

    document.getElementById('answerCallBtn').addEventListener('click', () => {
      this.handleAnswerCall();
    });

    document.getElementById('muteBtn').addEventListener('click', () => {
      this.handleToggleMute();
    });

    document.getElementById('speakerBtn').addEventListener('click', () => {
      this.handleToggleSpeaker();
    });

    document.getElementById('hangupBtn').addEventListener('click', () => {
      this.handleHangup();
    });

    // Quick call buttons
    document.getElementById('callUser1').addEventListener('click', () => {
      this.quickCall('6878adb69c41789577b3b9d1');
    });

    document.getElementById('callUser2').addEventListener('click', () => {
      this.quickCall('687895cb7dd3bd7b1960762d');
    });

    // Incoming call modal
    document.getElementById('acceptCallBtn').addEventListener('click', () => {
      this.handleAcceptIncomingCall();
    });

    document.getElementById('declineCallBtn').addEventListener('click', () => {
      this.handleDeclineIncomingCall();
    });

    // Utility
    document.getElementById('clearLogsBtn').addEventListener('click', () => {
      this.clearLogs();
    });

    // Enter key handlers
    document.getElementById('targetUserId').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleStartCall();
      }
    });

    document.getElementById('password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });
  }

  /**
   * Setup callbacks for VoiceCallService events
   */
  setupServiceCallbacks() {
    // Set up VoiceCallService callbacks

    this.voiceService.onCallStateChanged = (state) => {
      this.handleCallStateChange(state);
    };

    this.voiceService.onIncomingCall = (callData) => {
      this.log('success', `📱 UI RECEIVED INCOMING ${callData.callType?.toUpperCase() || 'VOICE'} CALL CALLBACK: ${callData.callId}`);

      // Show video container for video calls
      if (callData.callType === 'video') {
        this.showVideoContainer();
      }

      this.showIncomingCallModal(callData);
    };

    this.voiceService.onCallEnded = () => {
      this.hideIncomingCallModal();
      this.hideVideoContainer(); // Hide video container when call ends
      this.resetCallUI();
    };

    this.voiceService.onError = (error) => {
      this.showError(error.message);
      // Hide video container on error
      if (this.voiceService.isVideoCall) {
        this.hideVideoContainer();
      }
    };

    this.voiceService.onDebugUpdate = (debugInfo) => {
      this.updateDebugInfo(debugInfo);
    };

    // All callbacks set up successfully
  }

  /**
   * Handle health check button click
   */
  async handleHealthCheck() {
    const healthBtn = document.getElementById('healthCheckBtn');
    const serverUrl = document.getElementById('serverUrl').value.trim();

    if (!serverUrl) {
      this.showError('Please enter server URL');
      return;
    }

    try {
      healthBtn.disabled = true;
      healthBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Checking...';

      this.authService = new AuthService(serverUrl);
      const isHealthy = await this.authService.healthCheck();

      if (isHealthy) {
        this.showSuccess('Server is healthy');
        healthBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Server OK';
        healthBtn.className = 'w-full px-4 py-2 bg-green-600 text-white rounded-lg cursor-default';
      } else {
        throw new Error('Health check failed');
      }

    } catch (error) {
      this.showError(`Health check failed: ${error.message}`);
      healthBtn.disabled = false;
      healthBtn.innerHTML = '<i class="fas fa-heartbeat mr-2"></i>Health Check';
      healthBtn.className = 'w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors';
    }
  }

  /**
   * Handle login button click
   */
  async handleLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const serverUrl = document.getElementById('serverUrl').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!serverUrl || !phoneNumber || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    try {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Logging in...';

      // Initialize auth service if not already done
      if (!this.authService) {
        this.authService = new AuthService(serverUrl);
      }

      // Login to get JWT token
      const loginResult = await this.authService.login(phoneNumber, password);
      // Login successful
      this.authToken = loginResult.accessToken;
      this.currentUser = loginResult.user;

      this.log('success', `Logged in as ${this.currentUser.fullName || this.currentUser.username}`);

      // Connect to Socket.IO with authentication
      await this.voiceService.connect(serverUrl, this.currentUser.id, this.authToken);

      this.updateConnectionStatus(true);
      this.updateUserInfo();
      this.enableControls();

      this.showSuccess('Logged in and connected successfully');

      loginBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Connected';
      loginBtn.className = 'w-full px-4 py-2 bg-green-600 text-white rounded-lg cursor-default';

      // Show disconnect button
      document.getElementById('disconnectBtn').classList.remove('hidden');

    } catch (error) {
      this.showError(`Login failed: ${error.message}`);
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login & Connect';
    }
  }

  /**
   * Handle disconnect button click  
   */
  handleDisconnect() {
    this.voiceService.disconnect();
    this.updateConnectionStatus(false);
    this.hideUserInfo();
    this.disableControls();
    this.resetAuthUI();
    this.showInfo('Disconnected successfully');
  }

  /**
   * Use test user credentials
   */
  useTestUser(userKey) {
    const user = TEST_USERS[userKey];
    if (user) {
      document.getElementById('phoneNumber').value = user.phoneNumber;
      document.getElementById('password').value = user.password;
      this.showInfo(`Using ${user.fullName} credentials`);
    }
  }

  /**
   * Quick call to specific user
   */
  quickCall(userId) {
    document.getElementById('targetUserId').value = userId;
    this.handleStartCall();
  }

  /**
   * Handle test microphone button click
   */
  async handleTestMicrophone() {
    const testBtn = document.getElementById('testMicBtn');

    try {
      testBtn.disabled = true;
      testBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Testing...';

      await this.voiceService.testMicrophone();
      this.showSuccess('Microphone test completed successfully');

    } catch (error) {
      this.showError(`Microphone test failed: ${error.message}`);
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="fas fa-microphone mr-2"></i>Test Microphone';
    }
  }

  /**
   * Handle start call button click
   */
  async handleStartCall() {
    const targetUserId = document.getElementById('targetUserId').value.trim();

    if (!targetUserId) {
      this.showError('Please enter target user ID');
      return;
    }

    if (!this.voiceService.isConnected) {
      this.showError('Please login and connect first');
      return;
    }

    if (!this.authToken) {
      this.showError('Authentication required');
      return;
    }

    try {
      await this.voiceService.startCall(targetUserId);
      this.showSuccess('Call initiated successfully');

    } catch (error) {
      this.showError(`Failed to start call: ${error.message}`);
    }
  }

  /**
   * Handle start video call - NEW Task 1.3
   */
  async handleStartVideoCall() {
    const targetUserId = document.getElementById('targetUserId').value.trim();
    const cameraMode = document.getElementById('cameraMode').value;

    if (!targetUserId) {
      this.showError('Please enter target user ID');
      return;
    }

    if (!this.voiceService.isConnected) {
      this.showError('Please login and connect first');
      return;
    }

    if (!this.authToken) {
      this.showError('Authentication required');
      return;
    }

    try {
      // Check camera permissions first - NEW Task 1.4
      // Checking camera permissions
      const hasPermissions = await this.requestVideoPermissions();

      if (!hasPermissions) {
        this.showError('Camera permissions required for video calls');
        return;
      }

      this.log('info', `Starting video call to ${targetUserId} with ${cameraMode} camera...`);

      // Show video container
      this.showVideoContainer();

      await this.voiceService.startVideoCall(targetUserId, cameraMode);
      this.showSuccess('Video call initiated successfully');

    } catch (error) {
      this.showError(`Failed to start video call: ${error.message}`);
      this.hideVideoContainer();
    }
  }

  /**
   * Handle toggle video on/off - NEW Task 1.3
   */
  handleToggleVideo() {
    if (!this.voiceService.isVideoCall) {
      this.showError('No video call active');
      return;
    }

    try {
      const isVideoEnabled = this.voiceService.toggleVideo();
      this.log('info', `Video ${isVideoEnabled ? 'enabled' : 'disabled'}`);
      this.showSuccess(`Video ${isVideoEnabled ? 'enabled' : 'disabled'}`);

    } catch (error) {
      this.showError(`Failed to toggle video: ${error.message}`);
    }
  }

  /**
   * Handle switch camera - NEW Task 1.3
   */
  async handleSwitchCamera() {
    if (!this.voiceService.isVideoCall) {
      this.showError('No video call active');
      return;
    }

    try {
      this.log('info', 'Switching camera...');
      const success = await this.voiceService.switchCamera();

      if (success) {
        this.showSuccess('Camera switched successfully');
      } else {
        this.showError('Failed to switch camera');
      }

    } catch (error) {
      this.showError(`Camera switch error: ${error.message}`);
    }
  }

  /**
   * Show video container and controls - NEW Task 1.3
   */
  showVideoContainer() {
    const videoContainer = document.getElementById('videoContainer');
    const cameraSelection = document.getElementById('cameraSelection');

    if (videoContainer) {
      videoContainer.classList.remove('hidden');
      videoContainer.classList.add('active');
    }

    if (cameraSelection) {
      cameraSelection.classList.remove('hidden');
    }

    // Video container displayed
  }

  /**
   * Hide video container and controls - NEW Task 1.3
   */
  hideVideoContainer() {
    const videoContainer = document.getElementById('videoContainer');
    const cameraSelection = document.getElementById('cameraSelection');

    videoContainer.classList.add('hidden');
    videoContainer.classList.remove('active');
    cameraSelection.classList.add('hidden');

    // Video container hidden
  }

  /**
   * Update camera selection display - NEW Task 1.3
   */
  async updateCameraSelection() {
    const cameraMode = document.getElementById('cameraMode').value;
    // Camera mode selected

    // Load available cameras when camera selection is shown
    await this.loadAvailableCameras();
  }

  /**
   * Load and populate available cameras - NEW Task 1.4
   */
  async loadAvailableCameras() {
    try {
      // Check permissions first
      const permissions = await this.voiceService.checkCameraPermissions();

      if (permissions.camera === 'denied') {
        this.log('warning', 'Camera permission denied - cannot enumerate cameras');
        return;
      }

      // Get available cameras
      const cameras = await this.voiceService.getAvailableCameras();

      if (cameras.length === 0) {
        this.log('warning', 'No cameras found on this device');
        return;
      }

      // Update camera selection dropdown
      const cameraSelect = document.getElementById('cameraMode');
      if (cameraSelect && cameras.length > 2) {
        // Clear existing options
        cameraSelect.innerHTML = '';

        // Add camera options
        cameras.forEach((camera, index) => {
          const option = document.createElement('option');
          option.value = camera.deviceId;
          option.textContent = camera.label;

          // Select front camera by default
          if (camera.facingMode === 'user' || index === 0) {
            option.selected = true;
          }

          cameraSelect.appendChild(option);
        });

        this.log('success', `Loaded ${cameras.length} cameras`);
      } else {
        // Using default camera options
      }

    } catch (error) {
      this.log('error', `Failed to load cameras: ${error.message}`);
    }
  }

  /**
   * Request media permissions for video calls - NEW Task 1.4
   */
  async requestVideoPermissions() {
    try {
      // Requesting video call permissions

      const granted = await this.voiceService.requestMediaPermissions(true);

      if (granted) {
        this.showSuccess('Camera and microphone permissions granted');
        await this.loadAvailableCameras();
        return true;
      } else {
        this.showError('Camera or microphone permission denied');
        return false;
      }

    } catch (error) {
      this.showError(`Permission request failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle test camera button click - NEW Task 1.4
   */
  async handleTestCamera() {
    try {
      // Testing camera access

      const success = await this.requestVideoPermissions();

      if (success) {
        this.log('success', '✅ Camera test completed successfully');

        // Show camera selection if not already visible
        const cameraSelection = document.getElementById('cameraSelection');
        if (cameraSelection.classList.contains('hidden')) {
          cameraSelection.classList.remove('hidden');
        }
      } else {
        this.log('error', '❌ Camera test failed');
      }

    } catch (error) {
      this.showError(`Camera test failed: ${error.message}`);
    }
  }

  /**
   * Handle answer call button click (from incoming call UI)
   */
  async handleAnswerCall() {
    try {
      await this.voiceService.answerCall(this.pendingCallData);
      this.hideIncomingCallModal();
      this.showSuccess('Call answered successfully');

    } catch (error) {
      this.showError(`Failed to answer call: ${error.message}`);
    }
  }

  /**
   * Handle accept incoming call from modal
   */
  async handleAcceptIncomingCall() {
    if (this.pendingCallData) {
      await this.handleAnswerCall();
    }
  }

  /**
   * Handle decline incoming call from modal
   */
  handleDeclineIncomingCall() {
    if (this.pendingCallData) {
      this.voiceService.declineCall(this.pendingCallData.callId);
      this.hideIncomingCallModal();
      this.showInfo('Call declined');
    }
  }

  /**
   * Handle mute toggle
   */
  handleToggleMute() {
    const isMuted = this.voiceService.toggleMute();
    const muteBtn = document.getElementById('muteBtn');

    if (isMuted) {
      muteBtn.innerHTML = '<i class="fas fa-microphone mr-2"></i>Unmute';
      muteBtn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
      muteBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
      muteBtn.innerHTML = '<i class="fas fa-microphone-slash mr-2"></i>Mute';
      muteBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
      muteBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
    }
  }

  /**
   * Handle speaker toggle
   */
  handleToggleSpeaker() {
    const isSpeakerOn = this.voiceService.toggleSpeaker();
    const speakerBtn = document.getElementById('speakerBtn');

    if (isSpeakerOn) {
      speakerBtn.innerHTML = '<i class="fas fa-volume-down mr-2"></i>Speaker Off';
      speakerBtn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
      speakerBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    } else {
      speakerBtn.innerHTML = '<i class="fas fa-volume-up mr-2"></i>Speaker';
      speakerBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      speakerBtn.classList.add('bg-purple-600', 'hover:bg-purple-700');
    }
  }

  /**
   * Handle hangup button click
   */
  handleHangup() {
    this.voiceService.hangupCall();
    this.showInfo('Call ended');
  }

  /**
   * Handle call state changes from VoiceCallService
   */
  handleCallStateChange(state) {
    this.log('info', `Call state changed: ${state.state}`);

    // Update call info
    this.updateCallInfo(state);

    // Update UI based on state
    switch (state.state) {
      case 'idle':
        this.resetCallUI();
        break;

      case 'initiating':
        this.showCallInitiating();
        break;

      case 'ringing':
        this.showCallRinging();
        break;

      case 'active':
        this.showCallActive();
        this.startCallDuration();
        break;

      case 'ended':
        this.resetCallUI();
        this.stopCallDuration();
        break;
    }
  }

  /**
   * Show incoming call modal
   */
  showIncomingCallModal(callData) {
    this.log('success', `🚀 SHOWING INCOMING ${callData.callType?.toUpperCase() || 'VOICE'} CALL MODAL for ${callData.callId}`);
    this.pendingCallData = callData;

    // Update modal content
    const callerInfo = document.getElementById('callerInfo');
    const modal = document.getElementById('incomingCallModal');
    const callTypeIcon = document.getElementById('callTypeIcon');
    const callTypeTitle = document.getElementById('callTypeTitle');
    const callTypeDescription = document.getElementById('callTypeDescription');

    if (!callerInfo || !modal) {
      this.log('error', `❌ Modal elements not found! callerInfo: ${!!callerInfo}, modal: ${!!modal}`);
      return;
    }

    // Set caller info
    callerInfo.textContent = callData.callerName || callData.callerId;

    // Update modal based on call type
    const isVideoCall = callData.callType === 'video';
    if (callTypeIcon) {
      callTypeIcon.className = isVideoCall
        ? 'fas fa-video text-6xl text-blue-600 mb-4 call-active'
        : 'fas fa-phone-alt text-6xl text-blue-600 mb-4 call-active';
    }

    if (callTypeTitle) {
      callTypeTitle.textContent = isVideoCall ? 'Incoming Video Call' : 'Incoming Voice Call';
    }

    if (callTypeDescription) {
      callTypeDescription.textContent = isVideoCall ? 'Video call with camera' : 'Voice call';
    }

    modal.classList.remove('hidden');

    this.log('success', `✅ ${isVideoCall ? 'Video' : 'Voice'} call modal shown successfully for call from ${callData.callerName || callData.callerId}`);
  }

  /**
   * Hide incoming call modal
   */
  hideIncomingCallModal() {
    document.getElementById('incomingCallModal').classList.add('hidden');
    this.pendingCallData = null;
  }

  /**
   * Update user info display
   */
  updateUserInfo() {
    if (this.currentUser) {
      document.getElementById('userInfo').classList.remove('hidden');
      document.getElementById('userName').textContent = this.currentUser.fullName || this.currentUser.username;
      document.getElementById('userPhone').textContent = this.currentUser.phoneNumber;
      document.getElementById('userId').textContent = this.currentUser._id;
    }
  }

  /**
   * Hide user info display
   */
  hideUserInfo() {
    document.getElementById('userInfo').classList.add('hidden');
  }

  /**
   * Enable controls after successful authentication
   */
  enableControls() {
    document.getElementById('testMicBtn').disabled = false;
    document.getElementById('startCallBtn').disabled = false;
  }

  /**
   * Disable controls when not authenticated
   */
  disableControls() {
    document.getElementById('testMicBtn').disabled = true;
    document.getElementById('startCallBtn').disabled = true;
  }

  /**
   * Reset authentication UI
   */
  resetAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login & Connect';
    loginBtn.className = 'w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors';

    const healthBtn = document.getElementById('healthCheckBtn');
    healthBtn.disabled = false;
    healthBtn.innerHTML = '<i class="fas fa-heartbeat mr-2"></i>Health Check';
    healthBtn.className = 'w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors';

    document.getElementById('disconnectBtn').classList.add('hidden');

    this.authToken = null;
    this.currentUser = null;
  }

  /**
   * Update connection status UI
   */
  updateConnectionStatus(isConnected) {
    const statusDot = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    const webrtcStatus = document.getElementById('webrtcStatus');

    if (isConnected) {
      statusDot.className = 'w-3 h-3 rounded-full bg-green-500 mr-3';
      statusText.textContent = 'Connected';
      webrtcStatus.className = 'w-3 h-3 rounded-full bg-yellow-500';
    } else {
      statusDot.className = 'w-3 h-3 rounded-full bg-red-500 mr-3';
      statusText.textContent = 'Disconnected';
      webrtcStatus.className = 'w-3 h-3 rounded-full bg-gray-500';
    }
  }

  /**
   * Update call info display
   */
  updateCallInfo(state) {
    const callInfo = document.getElementById('callInfo');
    const callId = document.getElementById('currentCallId');
    const callStatus = document.getElementById('callStatusText');

    if (state.callId) {
      callInfo.classList.remove('hidden');
      callId.textContent = state.callId;
      callStatus.textContent = state.state.toUpperCase();
    } else {
      callInfo.classList.add('hidden');
    }
  }

  /**
   * Show call initiating state
   */
  showCallInitiating() {
    document.getElementById('startCallBtn').classList.add('hidden');
    document.getElementById('hangupBtn').classList.remove('hidden');

    // Disable controls until call is active
    document.getElementById('muteBtn').disabled = true;
    document.getElementById('speakerBtn').disabled = true;
  }

  /**
   * Show call ringing state
   */
  showCallRinging() {
    document.getElementById('startCallBtn').classList.add('hidden');
    document.getElementById('answerCallBtn').classList.remove('hidden');
    document.getElementById('hangupBtn').classList.remove('hidden');
  }

  /**
   * Show call active state
   */
  showCallActive() {
    document.getElementById('startCallBtn').classList.add('hidden');
    document.getElementById('answerCallBtn').classList.add('hidden');
    document.getElementById('hangupBtn').classList.remove('hidden');

    // Enable controls
    document.getElementById('muteBtn').disabled = false;
    document.getElementById('speakerBtn').disabled = false;

    // Update WebRTC status
    document.getElementById('webrtcStatus').className = 'w-3 h-3 rounded-full bg-green-500';

    this.showSuccess('Call connected successfully');
  }

  /**
   * Reset call UI to idle state
   */
  resetCallUI() {
    document.getElementById('startCallBtn').classList.remove('hidden');
    document.getElementById('answerCallBtn').classList.add('hidden');
    document.getElementById('hangupBtn').classList.add('hidden');

    // Reset control buttons
    document.getElementById('muteBtn').disabled = true;
    document.getElementById('speakerBtn').disabled = true;

    // Reset button states
    const muteBtn = document.getElementById('muteBtn');
    muteBtn.innerHTML = '<i class="fas fa-microphone-slash mr-2"></i>Mute';
    muteBtn.className = 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50';

    const speakerBtn = document.getElementById('speakerBtn');
    speakerBtn.innerHTML = '<i class="fas fa-volume-up mr-2"></i>Speaker';
    speakerBtn.className = 'px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50';

    // Reset WebRTC status
    const webrtcStatus = document.getElementById('webrtcStatus');
    if (this.voiceService.isConnected) {
      webrtcStatus.className = 'w-3 h-3 rounded-full bg-yellow-500';
    } else {
      webrtcStatus.className = 'w-3 h-3 rounded-full bg-gray-500';
    }
  }

  /**
   * Start call duration timer
   */
  startCallDuration() {
    this.callStartTime = Date.now();
    this.callDurationInterval = setInterval(() => {
      const elapsed = Date.now() - this.callStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);

      document.getElementById('callDuration').textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  /**
   * Stop call duration timer
   */
  stopCallDuration() {
    if (this.callDurationInterval) {
      clearInterval(this.callDurationInterval);
      this.callDurationInterval = null;
    }

    document.getElementById('callDuration').textContent = '00:00';
  }

  /**
   * Update debug information
   */
  updateDebugInfo(debugInfo) {
    document.getElementById('localSdp').value = debugInfo.localDescription;
    document.getElementById('remoteSdp').value = debugInfo.remoteDescription;

    const iceState = document.getElementById('iceState');
    const iceStateDetails = document.getElementById('iceStateDetails');

    iceState.textContent = debugInfo.iceConnectionState;

    // Update ICE state styling
    switch (debugInfo.iceConnectionState) {
      case 'new':
        iceState.className = 'px-3 py-1 bg-gray-600 text-white rounded-lg text-sm font-mono';
        iceStateDetails.textContent = 'ICE connection not started';
        break;
      case 'checking':
        iceState.className = 'px-3 py-1 bg-yellow-600 text-white rounded-lg text-sm font-mono';
        iceStateDetails.textContent = 'ICE connectivity checks in progress';
        break;
      case 'connected':
        iceState.className = 'px-3 py-1 bg-green-600 text-white rounded-lg text-sm font-mono';
        iceStateDetails.textContent = 'ICE connection established';
        break;
      case 'completed':
        iceState.className = 'px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-mono';
        iceStateDetails.textContent = 'ICE connection completed';
        break;
      case 'failed':
        iceState.className = 'px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-mono';
        iceStateDetails.textContent = 'ICE connection failed';
        break;
      case 'disconnected':
        iceState.className = 'px-3 py-1 bg-orange-600 text-white rounded-lg text-sm font-mono';
        iceStateDetails.textContent = 'ICE connection disconnected';
        break;
      case 'closed':
        iceState.className = 'px-3 py-1 bg-gray-600 text-white rounded-lg text-sm font-mono';
        iceStateDetails.textContent = 'ICE connection closed';
        break;
    }
  }

  /**
   * Clear logs
   */
  clearLogs() {
    const logsElement = document.getElementById('logs');
    logsElement.innerHTML = '<div class="log-entry">[INFO] Logs cleared</div>';
  }

  /**
   * Show success notification
   */
  showSuccess(message) {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
    }).showToast();
  }

  /**
   * Show error notification
   */
  showError(message) {
    Toastify({
      text: message,
      duration: 5000,
      gravity: "top",
      position: "right",
      backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
    }).showToast();
  }

  /**
   * Show info notification
   */
  showInfo(message) {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "linear-gradient(to right, #667eea, #764ba2)",
    }).showToast();
  }

  /**
   * Log utility that delegates to voice service
   */
  log(level, message) {
    this.voiceService.log(level, message);
  }
}

// Initialize the application when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.voiceCallApp = new VoiceCallApp();
});
