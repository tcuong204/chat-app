import { getFriendRequests } from "@/api/friendApi";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { ImageBackground, SafeAreaView, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTabBar } from "../../utils/tabBarContext";

const _layout = () => {
  const [newRequest, setNewRequest] = useState(0);
  const { isTabBarVisible } = useTabBar();

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await getFriendRequests({
          type: "incoming",
          status: "PENDING",
        });
        setNewRequest(res?.total || 0);
      } catch (e) {
        setNewRequest(0);
      }
    };
    fetchRequests();
  }, []);

  const TabIcon = ({ focused, title, icons, badge }: any) => {
    return focused ? (
      <ImageBackground className="flex  overflow-hidden items-center justify-center flex-1 min-w-[114px] min-h-[52px]  rounded-[50] mt-4">
        <Ionicons name={icons} size={24} color="#A066EA" />
        <Text className="font-roboto font-semibold text-base text-[#A066EA]">
          {title}
        </Text>
        {badge > 0 && (
          <View
            style={{
              position: "absolute",
              top: 6,
              right: 24,
              backgroundColor: "red",
              borderRadius: 8,
              minWidth: 16,
              height: 16,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
              {badge}
            </Text>
          </View>
        )}
      </ImageBackground>
    ) : (
      <View className="">
        <Ionicons name={icons} size={24} color="#ccc" />
        {badge > 0 && (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              backgroundColor: "red",
              borderRadius: 8,
              minWidth: 16,
              height: 16,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
              {badge}
            </Text>
          </View>
        )}
      </View>
    );
  };
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-white">
        <Tabs
          screenOptions={{
            tabBarShowLabel: false,
            tabBarStyle: {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              elevation: 0,
              marginBottom: 0,
              overflow: "hidden",
              backgroundColor: "#fff",
              borderWidth: 2,
              borderBottomWidth: 0,
              borderColor: "#e4e4e4",
              display: isTabBarVisible ? "flex" : "none",
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Chat",
              headerShown: false,
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  focused={focused}
                  title="Đoạn chat"
                  icons="chatbubble-ellipses-outline"
                />
              ),
            }}
          />
          <Tabs.Screen
            name="contact"
            options={{
              title: "Contacts",
              headerShown: false,
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  focused={focused}
                  title="Danh bạ"
                  icons="people-outline"
                  badge={newRequest}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              headerShown: false,
              tabBarIcon: ({ focused }) => (
                <TabIcon focused={focused} title="Menu" icons="menu" />
              ),
            }}
          />
        </Tabs>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export default _layout;
