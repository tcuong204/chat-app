# WebRTC Setup Guide for React Native Chat App

## Problem
You're getting the error: `"WebRTC is not available. Please wait for initialization or check if react-native-webrtc is properly installed."`

## Root Cause
The issue occurs because `react-native-webrtc` doesn't work with **Expo Go**. It requires a **development build** or **custom dev client**.

## Solution

### Option 1: Use Development Build (Recommended)

1. **Stop using Expo Go** - it doesn't support native modules like `react-native-webrtc`

2. **Create a development build:**
   ```bash
   # For Android
   npx expo run:android
   
   # For iOS
   npx expo run:ios
   ```

3. **Install the development build on your device/emulator**

4. **Run the app with the development build instead of Expo Go**

### Option 2: Use Custom Dev Client

1. **Install expo-dev-client:**
   ```bash
   npx expo install expo-dev-client
   ```

2. **Create a custom development build:**
   ```bash
   npx expo run:android --variant development
   ```

### Option 3: Eject from Expo (Not Recommended)

If you need full control, you can eject from Expo, but this makes updates more complex.

## Verification Steps

1. **Check WebRTC Status:**
   - Go to Profile tab in your app
   - Look at the "WebRTC Status" section
   - All items should show "✓ Available"

2. **Test Voice Call:**
   - Try starting a voice call
   - Should work without the WebRTC error

## Why This Happens

- **Expo Go** is a sandboxed environment that doesn't support native modules
- **react-native-webrtc** requires direct access to device hardware (camera, microphone)
- **Development builds** include the native code and can access device features

## Troubleshooting

### If WebRTC still doesn't work after development build:

1. **Check package installation:**
   ```bash
   npm list react-native-webrtc
   ```

2. **Reinstall the package:**
   ```bash
   npm uninstall react-native-webrtc
   npm install react-native-webrtc
   ```

3. **Clean and rebuild:**
   ```bash
   npx expo run:android --clear
   ```

4. **Check Android permissions in app.json:**
   ```json
   {
     "android": {
       "permissions": [
         "CAMERA",
         "RECORD_AUDIO",
         "MODIFY_AUDIO_SETTINGS"
       ]
     }
   }
   ```

### For iOS:

1. **Check Info.plist permissions:**
   - Camera usage description
   - Microphone usage description

2. **Ensure proper signing and provisioning**

## Alternative Solutions

If you can't use development builds, consider:

1. **Use Expo's built-in audio/video APIs:**
   - `expo-av` for audio recording
   - `expo-camera` for video
   - Note: These don't support peer-to-peer communication

2. **Use a different WebRTC library:**
   - `react-native-webrtc` (requires development build)
   - `@react-native-webrtc/react-native-webrtc`

3. **Implement server-side audio/video:**
   - Record audio/video and send as files
   - Less real-time but more compatible

## Quick Test

To test if WebRTC is working:

1. **Run the app with development build:**
   ```bash
   npx expo run:android
   ```

2. **Navigate to Profile tab**

3. **Check WebRTC Status section**

4. **All status items should show green checkmarks**

## Summary

- ❌ **Expo Go** - Doesn't support WebRTC
- ✅ **Development Build** - Supports WebRTC (use `expo run:android`)
- ✅ **Custom Dev Client** - Alternative approach
- ❌ **Ejecting** - Complex, not recommended

**Use `npx expo run:android` instead of `npx expo start` to fix the WebRTC issue.**



