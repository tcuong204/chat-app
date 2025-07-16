import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";
import { ImageBackground, Text, View } from "react-native";
const _layout = () => {
  const TabIcon = ({ focused, title, icons }: any) => {
    return focused ? (
      <ImageBackground className="flex  overflow-hidden items-center justify-center flex-1 min-w-[114px] min-h-[52px]  rounded-[50] mt-4">
        <Ionicons name={icons} size={24} color="#A066EA" />
        <Text className="font-roboto font-semibold text-base text-[#A066EA]">
          {title}
        </Text>
      </ImageBackground>
    ) : (
      <View className="">
        <Ionicons name={icons} size={24} color="#ccc" />
      </View>
    );
  };
  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarItemStyle: {
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarStyle: {
          borderRadius: 50,
          marginHorizontal: 20,
          marginBottom: 35,
          height: 52,
          overflow: "hidden",
          position: "absolute",
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: "#e4e4e4",
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
            <TabIcon focused={focused} title="Danh bạ" icons="people-outline" />
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
  );
};

export default _layout;
