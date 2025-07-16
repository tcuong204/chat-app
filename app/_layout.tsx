import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { getAccount } from "../utils/secureStore";
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
      if (!account) {
        router.replace("/(auth)/welcome");
      }
      setCheckingAuth(false);
    }
    checkLogin();
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
      <StatusBar style="dark" />
      <Stack screenOptions={{ animation: "flip" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="messages/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
