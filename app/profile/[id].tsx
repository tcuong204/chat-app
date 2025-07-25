import { images } from "@/constants/images";
import AntDesign from "@expo/vector-icons/AntDesign";
import BottomSheet from "@gorhom/bottom-sheet";
import { router, Stack } from "expo-router";
import React, { useMemo, useRef } from "react";
import {
  Image,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const ProfileScreen = () => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%"], []);
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView className="bg-white flex-1 relative">
        {/* Header Image */}
        <Image
          source={images.defaultAvatar}
          style={{ position: "relative" }}
          className="w-full h-96 relative"
          resizeMode="cover"
        />
        <View className="absolute top-20 left-4 bg-bgSecondary rounded-full ">
          <TouchableOpacity className="p-2" onPress={() => router.back()}>
            <AntDesign name="arrowleft" size={24} color="#a855f7" />
          </TouchableOpacity>
        </View>
        <View className="absolute top-20 right-4 bg-bgSecondary rounded-full ">
          <TouchableOpacity className="p-2" onPress={() => router.back()}>
            <AntDesign name="ellipsis1" size={24} color="#a855f7" />
          </TouchableOpacity>
        </View>
        {/* Content */}
        <BottomSheet ref={bottomSheetRef} index={0} snapPoints={snapPoints}>
          <View className="p-4 bg-white rounded-t-3xl">
            {/* Name & Distance */}
            <Text className="text-2xl font-bold">Ngô Văn Đức</Text>
            <Text className="text-sm text-gray-500 mb-2">2 km away</Text>

            {/* Mutual connections */}
            <View className="flex-row items-center mb-4">
              <Image
                source={{ uri: "https://example.com/friend1.jpg" }}
                className="w-6 h-6 rounded-full mr-1"
              />
              <Image
                source={{ uri: "https://example.com/friend2.jpg" }}
                className="w-6 h-6 rounded-full mr-2 -ml-2"
              />
              <Text className="text-sm text-blue-600 font-semibold">
                23 mutual connections
              </Text>
            </View>

            {/* Action buttons */}
            <View className="flex-row justify-between space-x-4 mb-6">
              <TouchableOpacity className="flex-1 bg-blue-600 py-3 rounded-xl items-center">
                <Text className="text-white font-bold">High five</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-gray-200 py-3 rounded-xl items-center">
                <Text className="text-blue-600 font-bold">Say hi</Text>
              </TouchableOpacity>
            </View>

            {/* Bio section */}
            <View>
              <Text className="text-sm text-gray-600 mb-1 font-semibold">
                Something you should know about me...
              </Text>
              <Text className="text-base text-gray-800">
                I can put both legs behind my head and cross the street with...
              </Text>
            </View>
          </View>
        </BottomSheet>
      </SafeAreaView>
    </>
  );
};

export default ProfileScreen;
