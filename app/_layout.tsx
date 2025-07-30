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
    checkLogin();

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
