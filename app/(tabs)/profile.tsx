import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { logout as logoutApi } from "../../api/authApi";
import { deleteAccount } from "../../utils/secureStore";

const profile = () => {
  const handleLogout = async () => {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất?", [
      {
        text: "Hủy",
        style: "cancel",
      },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          try {
            // Gọi API logout
            await logoutApi();

            // Xóa thông tin tài khoản khỏi SecureStore
            await deleteAccount();

            // Chuyển về màn hình đăng nhập
            router.replace("/(auth)/welcome");
          } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
            // Vẫn xóa local data và chuyển trang ngay cả khi API fail
            await deleteAccount();
            router.replace("/(auth)/welcome");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 p-4">
        <View className="">
          <Text className="font-extrabold text-2xl text-black font-manrope">
            Menu
          </Text>
        </View>
        <View className=" bg-white rounded-full flex flex-row items-center justify-between p-4 mt-4">
          <View className="flex flex-row items-center">
            <AntDesign
              name="setting"
              size={24}
              color="black"
              className="mx-4"
            />
            <Text className="font-nunito">Cài đặt</Text>
          </View>
          <AntDesign name="right" size={20} color="black" />
        </View>
        <TouchableOpacity
          className=" bg-white rounded-full flex flex-row items-center justify-between p-4 mt-4"
          onPress={handleLogout}
        >
          <View className="flex flex-row items-center">
            <AntDesign name="logout" size={24} color="black" className="mx-4" />
            <Text className="font-nunito">Đăng xuất</Text>
          </View>
          <AntDesign name="right" size={20} color="black" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default profile;
