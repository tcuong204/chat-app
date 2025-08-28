import { LOCALIP } from "@/constants/localIp";
import { voiceCallService } from "@/utils/voiceCallService";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { refreshToken } from "../api/authApi";
import { getAccount, saveAccount } from "../utils/secureStore";
import { TabBarProvider } from "../utils/tabBarContext";
import "./global.css";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope: require("../assets/fonts/Manrope-Regular.ttf"),
    Roboto: require("../assets/fonts/Roboto-Regular.ttf"),
    Nunito: require("../assets/fonts/Nunito-Regular.ttf"),
  });
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkLogin() {
      const account = await getAccount();
      // console.log(account);
      !account ? router.replace("/(auth)/welcome") : router.replace("/(tabs)");
      setCheckingAuth(false);
    }
    const setupVoiceCall = async () => {
      const account = await getAccount();
      if (account && (account as any)?.accessToken) {
        try {
          console.log("Setting up voice call service...");
          await voiceCallService.connect(
            `https://${LOCALIP}`,
            (account as any).user.id,
            (account as any).accessToken
          );
          console.log("Voice call service connected successfully");

          // Setup voice call handling after successful connection
          voiceCallService.onIncomingCall = (callData) => {
            console.log("Incoming call received:", callData);
            router.push({
              pathname: "/voice-call",
              params: {
                targetUserId: callData.callerId,
                targetUserName: callData.callerName || "Unknown",
                isIncoming: "true",
                callType: callData.callType,
              },
            });
          };
        } catch (error) {
          console.error("Failed to connect voice call service:", error);
        }
      }
    };

    checkLogin();
    setupVoiceCall(); // Call this after checkLogin

    // Refresh token mỗi 15 phút
    const interval = setInterval(async () => {
      const account = await getAccount();
      const refresh = (account as any)?.refreshToken;
      if (refresh) {
        const newToken = await refreshToken(refresh);
        console.log("New token:", (newToken as any)?.accessToken);

        if ((newToken as any)?.accessToken) {
          await saveAccount({
            ...account,
            accessToken: (newToken as any).accessToken,
          });
        }
      }
      console.log("access", (account as any)?.accessToken);
    }, 10 * 60 * 1000); // 15 phút
    return () => clearInterval(interval);
  }, []);

  // Handle incoming call -> navigate to call UI with accept/decline
  useEffect(() => {
    // Only set up if not already set up
    if (voiceCallService.isConnected) {
      console.log("Voice call service already connected, skipping setup");
      return;
    }

    console.log("Setting up incoming call handler...");

    const MAX_RETRIES = 3;
    const getRetryDelay = (retry: number) =>
      Math.min(1000 * Math.pow(2, retry), 10000);

    async function setupVoiceCall(retryCount = 0) {
      try {
        // Get account for authentication
        const account = await getAccount();
        if (!account) {
          console.log("No account found, skipping voice call setup");
          return;
        }

        // Check WebRTC status
        const webrtcStatus = voiceCallService.getWebRTCStatus();
        console.log("WebRTC Status:", webrtcStatus);

        // Connect to voice call service with auth token
        try {
          // Only connect if not already connected
          if (!voiceCallService.isConnected) {
            // Clean up any existing handlers before connecting
            voiceCallService.onDisconnect = null;
            voiceCallService.onIncomingCall = null;

            await voiceCallService.connect(
              `https://${LOCALIP}`,
              (account as any).userId,
              (account as any).accessToken
            );
          }
          console.log("Voice call service connected");
        } catch (error) {
          if (retryCount < MAX_RETRIES) {
            const delay = getRetryDelay(retryCount);
            console.log(
              `Retrying connection in ${delay}ms... (Attempt ${
                retryCount + 1
              }/${MAX_RETRIES})`
            );
            setTimeout(() => {
              setupVoiceCall(retryCount + 1);
            }, delay);
            return;
          } else {
            console.error(
              "Max retry attempts reached. Voice call service failed to connect."
            );
          }
        }

        // Set up disconnect handler
        voiceCallService.onDisconnect = () => {
          if (retryCount < MAX_RETRIES) {
            const delay = getRetryDelay(retryCount);
            console.log(
              `Server disconnected. Retrying in ${delay}ms... (Attempt ${
                retryCount + 1
              }/${MAX_RETRIES})`
            );
            setTimeout(() => {
              setupVoiceCall(retryCount + 1);
            }, delay);
          } else {
            console.error("Max retry attempts reached after disconnect.");
          }
        };
        let lastCallTime = 0;
        // Set up incoming call handler
        const prevIncoming = voiceCallService.onIncomingCall;
        voiceCallService.onIncomingCall = (data: {
          callId: string;
          callerId: string;
          callerName?: string;
          callType: "voice" | "video";
        }) => {
          const now = Date.now();

          // Nếu lần gọi mới cách lần trước < 2 giây thì bỏ qua
          if (now - lastCallTime < 2000) {
            console.log("Bỏ qua incoming call duplicate:", data);
            return;
          }
          lastCallTime = now;
          console.log("Incoming call received:", data);
          setTimeout(() => {
            router.push({
              pathname: "/voice-call",
              params: {
                targetUserId: data.callerId,
                targetUserName: data.callerName || "Cuộc gọi đến",
                isIncoming: "true",
                callType: data.callType, // Thêm loại cuộc gọi vào params
              },
            });
          }, 1000); // delay 300ms để tránh double push
        };

        return () => {
          if (voiceCallService.isConnected) {
            voiceCallService.disconnect();
            voiceCallService.onDisconnect = null;
            voiceCallService.onIncomingCall = null;
          }
        };
      } catch (error) {
        console.error("Error setting up voice call:", error);
      }
    }

    setupVoiceCall();
  }, []);
  if (!fontsLoaded) {
    return (
      <GestureHandlerRootView className="flex-1 items-center justify-center bg-white">
        <Text style={{ fontSize: 18, color: "#a855f7" }}>Đang tải...</Text>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <TabBarProvider>
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ animation: "flip" }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="messages/[id]"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack>
          <Toast />
        </BottomSheetModalProvider>
      </TabBarProvider>
    </GestureHandlerRootView>
  );
}
