import AntDesign from "@expo/vector-icons/AntDesign";
import React from "react";
import { Text, View } from "react-native";
const profile = () => {
  return (
    <View className="flex-1 p-4">
      <View className="mt-5">
        <Text className="font-extrabold text-2xl text-black font-manrope">
          Menu
        </Text>
      </View>
      <View className=" bg-white rounded-full flex flex-row items-center justify-between p-4 mt-4">
        <View className="flex flex-row items-center">
          <AntDesign name="setting" size={24} color="black" className="mx-4" />
          <Text className="font-nunito">Cài đặt</Text>
        </View>
        <AntDesign name="right" size={20} color="black" />
      </View>
    </View>
  );
};

export default profile;
