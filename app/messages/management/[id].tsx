import {
  deleteConversation,
  getConversationDetails,
} from "@/api/conversationApi";
import { getFriends } from "@/api/friendApi";
import { Friend } from "@/app/(tabs)/contact";
import { CreateGroupModal } from "@/components";
import { images } from "@/constants/images";
import { showSuccess } from "@/utils/customToast";
import AntDesign from "@expo/vector-icons/AntDesign";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DirectConversation } from "../[id]";

const MessageManagement = () => {
  const param = useLocalSearchParams<{ id: string }>();
  const [conversations, setConversations] = useState<DirectConversation | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [contactsData, setContactsData] = useState<Friend[]>([]);
  const handleCloseModal = useCallback(() => {
    setShowNewMessageModal(false);
    setSearchQuery("");
  }, []);

  const getConversations = async () => {
    try {
      const response = await getConversationDetails(param.id as string);
      setConversations(response || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };
  const handledeleteConversation = async (conversationId: string) => {
    Alert.alert("Xóa nhóm", "Bạn có chắc chắn muốn xóa nhóm này?", [
      {
        text: "Hủy",
        style: "cancel",
      },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            // Lấy access token từ SecureStore
            const response = await deleteConversation(conversationId);
            showSuccess("Xóa nhóm thành công");
            router.push("/(tabs)");
          } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
            // Vẫn xóa local data và chuyển trang ngay cả khi API fail
            console.error("Xóa nhóm không thành công:", error);
          }
        },
      },
    ]);
  };
  const fetchFriends = async () => {
    try {
      const res = await getFriends();
      // Nếu API trả về mảng trực tiếp
      // setContactsData(res);
      // Nếu API trả về object có field users hoặc friends
      setContactsData(res.friends || res.users || res || []);
    } catch (e) {
      setContactsData([]);
    }
  };
  useEffect(() => {}, []);
  useEffect(() => {
    getConversations();
    fetchFriends();
  }, []);
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 ">
        <View className="bg-transparent px-6 py-4">
          <View className=" flex">
            <View className="flex flex-row items-center justify-start">
              <TouchableOpacity onPress={() => router.back()} className="mr-4">
                <AntDesign
                  name="arrowleft"
                  size={24}
                  color="#a855f7"
                  className="p-4"
                />
              </TouchableOpacity>
            </View>
            <View className="flex flex-row justify-center">
              <Image
                source={
                  typeof conversations?.avatarUrl === "string"
                    ? { uri: conversations.avatarUrl }
                    : images.defaultAvatar
                }
                className="w-28 h-28 rounded-full mr-3"
              />
            </View>
          </View>
        </View>
        <View className="flex justify-center flex-row">
          <Text className="text-xl font-bold font-manrope">
            {conversations?.name}
          </Text>
        </View>
        <TouchableOpacity
          className=" bg-white rounded-full flex flex-row items-center justify-between p-4 mt-4"
          onPress={() => setShowNewMessageModal(true)}
        >
          <View className="flex flex-row items-center">
            <AntDesign
              name="addusergroup"
              size={24}
              color="black"
              className="mx-4"
            />
            <Text className="font-nunito">
              Tạo nhóm với {conversations?.name}
            </Text>
          </View>
          <AntDesign name="right" size={20} color="black" />
        </TouchableOpacity>
        <TouchableOpacity
          className=" bg-white rounded-full flex flex-row items-center justify-between p-4 mt-4"
          onPress={() => {}}
        >
          <View className="flex flex-row items-center">
            <AntDesign
              name="picture"
              size={24}
              color="black"
              className="mx-4"
            />
            <Text className="font-nunito">
              Xem file phương tiện và liên kết
            </Text>
          </View>
          <AntDesign name="right" size={20} color="black" />
        </TouchableOpacity>
        <TouchableOpacity
          className=" bg-white rounded-full flex flex-row items-center justify-between p-4 mt-4"
          onPress={() => {}}
        >
          <View className="flex flex-row items-center">
            <AntDesign
              name="minuscircleo"
              size={24}
              color="black"
              className="mx-4"
            />
            <Text className="font-nunito">Chặn {conversations?.name}</Text>
          </View>
          <AntDesign name="right" size={20} color="black" />
        </TouchableOpacity>
        <TouchableOpacity
          className=" bg-white rounded-full flex flex-row items-center justify-between p-4 mt-4"
          onPress={() => {}}
        >
          <TouchableOpacity
            className="flex flex-row items-center"
            onPress={() =>
              conversations && handledeleteConversation(conversations?.id)
            }
          >
            <AntDesign name="export2" size={24} color="red" className="mx-4" />
            <Text className="font-nunito text-red-500">
              Xóa cuộc trò chuyện
            </Text>
          </TouchableOpacity>
          <AntDesign name="right" size={20} color="red" />
        </TouchableOpacity>
      </View>
      <CreateGroupModal
        setSearchQuery={setSearchQuery}
        show={showNewMessageModal}
        setShow={setShowNewMessageModal}
        onClose={handleCloseModal}
        searchQuery={searchQuery}
        contacts={contactsData}
        onSearchChange={(q) => {
          setSearchQuery(q);
        }}
        onContactPress={() => {}}
      />
    </SafeAreaView>
  );
};

export default MessageManagement;

const styles = StyleSheet.create({});
