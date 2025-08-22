#!/usr/bin/env node

/**
 * WebRTC Test Script
 * Run this to check if WebRTC is available in your environment
 */

console.log('🔍 Testing WebRTC Availability...\n');

// Check if we're in a Node.js environment
if (typeof window === 'undefined') {
  console.log('📱 Environment: Node.js/React Native');
  
  // Check for react-native-webrtc
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check if react-native-webrtc is installed
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const hasWebRTC = packageJson.dependencies && packageJson.dependencies['react-native-webrtc'];
      
      if (hasWebRTC) {
        console.log('✅ react-native-webrtc is installed');
        console.log(`   Version: ${hasWebRTC}`);
      } else {
        console.log('❌ react-native-webrtc is NOT installed');
        console.log('   Run: npm install react-native-webrtc');
      }
    }
    
    // Check if this is an Expo project
    const appJsonPath = path.join(__dirname, '..', 'app.json');
    if (fs.existsSync(appJsonPath)) {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      console.log('✅ Expo project detected');
      
      // Check for necessary permissions
      if (appJson.expo && appJson.expo.android && appJson.expo.android.permissions) {
        const permissions = appJson.expo.android.permissions;
        const requiredPermissions = ['CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'];
        
        console.log('📋 Android Permissions:');
        requiredPermissions.forEach(permission => {
          const hasPermission = permissions.some(p => 
            p === permission || p === `android.permission.${permission}`
          );
          console.log(`   ${hasPermission ? '✅' : '❌'} ${permission}`);
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Error reading project files:', error.message);
  }
  
  console.log('\n📋 To fix WebRTC issues:');
  console.log('1. Ensure you\'re using a development build (not Expo Go)');
  console.log('2. Run: npx expo run:android');
  console.log('3. Install the development build on your device');
  console.log('4. Test voice calls in the app');
  
} else {
  console.log('🌐 Environment: Browser');
  console.log('✅ WebRTC should be available in browsers');
}

console.log('\n🎯 Next Steps:');
console.log('1. Go to Profile tab in your app');
console.log('2. Check the WebRTC Status section');
console.log('3. All items should show "✓ Available"');
console.log('4. If not, use development build instead of Expo Go');

console.log('\n🚀 Run this command to create a development build:');
console.log('   npx expo run:android');



