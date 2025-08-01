import { getFriendRequests, respondToFriendRequest } from "@/api/friendApi";
import FriendRequestCard from "@/components/friendRequestCard";
import { images } from "@/constants/images";
import { showError, showSuccess } from "@/utils/customToast";
import AntDesign from "@expo/vector-icons/AntDesign";
import { router, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Interface cho user trong request
interface FriendUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  isOnline: boolean;
  lastSeen: string;
  avatarUrl: string | null;
}

// Interface cho từng request
interface FriendRequest {
  id: string;
  userId: string;
  friendId: string;
  requestedBy: string;
  addMethod: string;
  canAccept: boolean;
  canCancel: boolean;
  canDecline: boolean;
  createdAt: string;
  updatedAt: string;
  requestMessage: string;
  status: string;
  timeAgo: string;
  user: FriendUser;
  avatarUrl: string | null;
  fullName: string;
}

// Interface cho response tổng thể
interface FriendRequestResponse {
  hasMore: boolean;
  limit: number;
  offset: number;
  total: number;
  type: string;
  requests: FriendRequest[];
}

const FriendRequests = () => {
  const [requests, setRequests] = useState<FriendRequestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await getFriendRequests({
        type: "incoming",
        status: "PENDING",
      });
      console.log("cccc", res);
      setRequests(res || null);
    } catch (e) {
      setRequests(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);
  console.log("aafasd", requests);

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await respondToFriendRequest(requestId, "ACCEPT");
      showSuccess("Đã chấp nhận lời mời kết bạn!");
      fetchRequests();
    } catch (e) {
      showError("Lỗi khi xác nhận!");
    }
    setProcessingId(null);
  };

  const handleDelete = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await respondToFriendRequest(requestId, "DECLINE");
      showSuccess("Đã xóa lời mời kết bạn!");
      fetchRequests();
    } catch (e) {
      showError("Lỗi khi xóa!");
    }
    setProcessingId(null);
  };
  console.log(requests);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: false }} />
      <View className=" flex flex-row justify-between items-center bg-white px-4 ">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <AntDesign
            name="arrowleft"
            size={24}
            color="#a855f7"
            className=" p-4"
          />
        </TouchableOpacity>
        <View className="flex flex-row">
          <View>
            <Text className="  text-2xl font-roboto">Lời mời kết bạn</Text>
          </View>
        </View>
        <View className="w-1/5"></View>
      </View>
      <View className="bg-white px-6 py-4" />
      <ScrollView className="flex-1">
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 40 }} />
        ) : requests?.total === 0 ? (
          <View style={{ alignItems: "center", marginTop: 5 }}>
            <View style={{ height: 12 }} />
            <View className="w-full flex flex-row justify-center bg-white">
              <Text className="text-xl font-nunito text-gray-500 py-8">
                Không có lời mời nào
              </Text>
            </View>
          </View>
        ) : (
          requests?.requests.map((req: FriendRequest, index) => (
            <FriendRequestCard
              key={index}
              avatar={req.user.avatarUrl || images.defaultAvatar}
              name={req.user.fullName || "Người dùng"}
              time={
                req.createdAt ? new Date(req.createdAt).toLocaleString() : ""
              }
              onAccept={() => handleAccept(req.id)}
              onDelete={() => handleDelete(req.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default FriendRequests;

const styles = StyleSheet.create({});
