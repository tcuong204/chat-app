# Voice Call Setup Guide

## Overview

This app includes voice and video calling functionality using WebRTC technology. The voice call service is implemented in `utils/voiceCallService.ts`.

## Prerequisites

- `react-native-webrtc` package is already installed
- Android permissions for camera and microphone are configured
- WebRTC native dependencies are added to Android build

## Setup Steps

### 1. Android Configuration

The following configurations have been added to `android/app/build.gradle`:

- NDK ABI filters for multiple architectures
- WebRTC native library dependency

### 2. Permissions

The following permissions are already configured in `android/app/src/main/AndroidManifest.xml`:

- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`
- `android.permission.MODIFY_AUDIO_SETTINGS`

## Usage

### Basic Voice Call

```typescript
import { voiceCallService } from "./utils/voiceCallService";

// Connect to server
await voiceCallService.connect("your-server-url", "user-id", "auth-token");

// Start a voice call
await voiceCallService.startCall("target-user-id");

// Answer incoming call
await voiceCallService.answerCall();

// End call
voiceCallService.hangupCall();
```

### Testing WebRTC

Use the test utilities to debug WebRTC issues:

```typescript
import { testWebRTC, testMicrophone } from "./utils/webrtcTest";

// Test WebRTC initialization
await testWebRTC();

// Test microphone permissions
await testMicrophone();
```

## Troubleshooting

### Common Issues

#### 1. "getUserMedia is not available" Error

**Cause**: WebRTC is not properly initialized
**Solution**:

- Ensure `react-native-webrtc` is installed
- Wait for WebRTC initialization to complete
- Check if the device supports WebRTC

#### 2. "RTCPeerConnection is not available" Error

**Cause**: WebRTC native library is not loaded
**Solution**:

- Clean and rebuild the Android project
- Check that WebRTC native dependencies are properly linked
- Verify NDK configuration

#### 3. Permission Denied Errors

**Cause**: Camera or microphone permissions not granted
**Solution**:

- Request permissions before starting calls
- Check Android manifest permissions
- Ensure user grants permissions at runtime

### Debug Steps

1. **Check WebRTC Status**:

   ```typescript
   const isReady = voiceCallService.isWebRTCReady();
   console.log("WebRTC Ready:", isReady);
   ```

2. **Wait for WebRTC**:

   ```typescript
   const ready = await voiceCallService.waitForWebRTC(10000);
   console.log("WebRTC Ready after wait:", ready);
   ```

3. **Check Console Logs**:
   The service provides detailed logging for debugging. Look for:

   - WebRTC initialization messages
   - Permission status
   - Connection state changes

4. **Test Basic Functionality**:
   ```typescript
   await testWebRTC();
   await testMicrophone();
   ```

### Android Build Issues

If you encounter build errors:

1. **Clean Project**:

   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

2. **Rebuild**:

   ```bash
   npx expo run:android
   ```

3. **Check NDK Version**:
   Ensure the NDK version in `android/build.gradle` matches your installed version

## Architecture

The voice call service uses:

- **WebRTC**: For peer-to-peer communication
- **Socket.IO**: For signaling and call management
- **Expo AV**: For audio session management
- **Expo Camera**: For camera permissions and access

## Performance Notes

- WebRTC initialization may take a few seconds on slower devices
- The service includes retry logic for WebRTC availability
- Audio quality is optimized for voice calls
- Video calls require additional bandwidth and processing power

## Security Considerations

- All WebRTC communication is peer-to-peer
- Signaling goes through your secure server
- Audio/video streams are encrypted end-to-end
- Permissions are requested at runtime
