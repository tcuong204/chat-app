import { voiceCallService } from "./voiceCallService";

/**
 * Test WebRTC functionality
 */
export const testWebRTC = async () => {
  console.log("=== WebRTC Test Start ===");

  try {
    // Test 1: Check if WebRTC is ready
    console.log("Test 1: Checking WebRTC readiness...");
    const isReady = voiceCallService.isWebRTCReady();
    console.log("WebRTC Ready:", isReady);

    // Test 2: Wait for WebRTC
    console.log("Test 2: Waiting for WebRTC...");
    const readyAfterWait = await voiceCallService.waitForWebRTC(10000);
    console.log("WebRTC Ready after wait:", readyAfterWait);

    // Test 3: Check global objects
    console.log("Test 3: Checking global WebRTC objects...");
    console.log("RTCPeerConnection:", typeof RTCPeerConnection);
    console.log("navigator:", typeof navigator);
    console.log(
      "navigator.mediaDevices:",
      navigator?.mediaDevices ? "available" : "not available"
    );

    // Test 4: Try to create a test peer connection
    if (typeof RTCPeerConnection !== "undefined") {
      console.log("Test 4: Creating test RTCPeerConnection...");
      const testPC = new RTCPeerConnection();
      console.log("Test RTCPeerConnection created successfully");
      testPC.close();
      console.log("Test RTCPeerConnection closed successfully");
    } else {
      console.log("Test 4: RTCPeerConnection not available");
    }

    // Test 5: Check getUserMedia availability
    if (navigator?.mediaDevices?.getUserMedia) {
      console.log("Test 5: getUserMedia is available");
    } else {
      console.log("Test 5: getUserMedia is NOT available");
    }
  } catch (error) {
    console.error("WebRTC Test Error:", error);
  }

  console.log("=== WebRTC Test End ===");
};

/**
 * Test microphone permissions
 */
export const testMicrophone = async () => {
  console.log("=== Microphone Test Start ===");

  try {
    const result = await voiceCallService.testMicrophone();
    console.log("Microphone test result:", result);
  } catch (error) {
    console.error("Microphone test error:", error);
  }

  console.log("=== Microphone Test End ===");
};
