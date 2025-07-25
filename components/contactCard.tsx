import { getAccount } from "@/utils/secureStore";
import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Button,
  Image,
  Keyboard,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { sendFriendRequest } from "../api/friendApi";
import { showError, showSuccess } from "../utils/customToast";
interface ContactCardProps {
  contact: {
    id: number | string;
    name: string;
    avatar: string;
    online?: boolean;
    favorite?: boolean;
    phoneNumber?: string;
    type?: "contact" | "group";
    members?: number;
    typing?: boolean;
    lastMessage?: string;
    time?: string;
    hasVoice?: boolean;
    pinned?: boolean;
    isFriend?: boolean;
    friendedAt?: string;
  };
  onPress: (id: number | string) => void;
  showActions?: boolean;
  showPhone?: boolean;
  showOption?: boolean;
  showLastMessage?: boolean;
  className?: string;
  fetchFriends?: () => void;
  addFriend?: (phoneNumber: string) => void;
  onShowFriendOption?: (friendInfo: {
    avatar: string;
    name: string;
    friendId: string;
    friendedAt?: string;
  }) => void;
}
const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onPress,
  showActions = false,
  showPhone = false,
  showLastMessage = false,
  className = "",
  fetchFriends,
  addFriend,
  onShowFriendOption,
}) => {
  const [imageError, setImageError] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [friendMessage, setFriendMessage] = useState("");

  return (
    <>
      <TouchableOpacity
        className={`flex-row items-center px-6 py-4 border-b border-gray-100 ${className}`}
        onPress={() =>
          router.push({
            pathname: "/profile/[id]",
            params: { id: String(contact.id) },
          })
        }
      >
        <View className="relative">
          {!imageError ? (
            <Image
              source={
                typeof contact.avatar === "string"
                  ? { uri: contact.avatar }
                  : contact.avatar
              }
              className="w-14 h-14 rounded-full"
              resizeMode="cover"
              style={{ width: 56, height: 56 }}
              onError={() => setImageError(true)}
            />
          ) : (
            <View className="w-14 h-14 rounded-full bg-gray-300 flex items-center justify-center">
              <Text className="text-gray-600 font-bold text-lg">
                {contact.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {contact.online && (
            <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></View>
          )}
          {contact.favorite && (
            <View className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
              <Text className="text-white text-xs">⭐</Text>
            </View>
          )}
          {contact.pinned && (
            <View className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <Text className="text-white text-xs">📌</Text>
            </View>
          )}
          {contact.type === "group" && (
            <View className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
              <Text className="text-white text-xs">G</Text>
            </View>
          )}
        </View>

        <View className="flex-1 ml-4">
          <View className="flex flex-row items-center justify-between ml-4">
            <View className="flex mt-1">
              <Text className="font-semibold text-gray-800 text-base font-manrope">
                {contact.name}
              </Text>
              {showPhone && contact.phoneNumber && (
                <Text className="text-gray-600 text-sm">
                  {contact.phoneNumber}
                </Text>
              )}
              {showLastMessage && contact.lastMessage && (
                <Text
                  className={`text-sm ${
                    contact.typing ? "text-blue-500 italic" : "text-gray-600"
                  } font-nunito`}
                  numberOfLines={1}
                >
                  {contact.hasVoice && "🎵 "}
                  {contact.lastMessage}
                </Text>
              )}
              {contact.type === "group" && contact.members && (
                <Text className="text-gray-600 text-sm">
                  {contact.members} members
                </Text>
              )}
              {contact.type === "contact" && !showPhone && !showLastMessage && (
                <Text className="text-gray-600 text-sm">
                  {contact.online ? "Online" : "Offline"}
                </Text>
              )}
            </View>
            {showLastMessage && contact.time && (
              <Text className="text-gray-500 text-sm font-nunito">
                {contact.time}
              </Text>
            )}
            {showActions && (
              <View className="flex flex-row space-x-2">
                <TouchableOpacity
                  className="p-4"
                  onPress={() => onPress(contact.id)}
                >
                  <AntDesign name="message1" size={24} color="#a855f7" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="p-4"
                  onPress={() =>
                    onShowFriendOption?.({
                      avatar: contact.avatar,
                      name: contact.name,
                      friendId: String(contact.id),
                      friendedAt: contact.friendedAt, // nếu có, truyền thêm
                    })
                  }
                >
                  <AntDesign name="ellipsis1" size={24} color="#a855f7" />
                </TouchableOpacity>
              </View>
            )}
            {!contact.isFriend && (
              <View className="flex flex-row space-x-2">
                <TouchableOpacity
                  className="p-2"
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowFriendModal(true);
                  }}
                >
                  <AntDesign name="adduser" size={20} color="#a855f7" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      {/* Friend Request Modal */}
      <Modal
        visible={showFriendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFriendModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              padding: 24,
              borderRadius: 12,
              alignItems: "center",
              minWidth: 280,
            }}
          >
            <Text
              style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12 }}
            >
              Thêm bạn
            </Text>
            <Image
              source={
                typeof contact.avatar === "string"
                  ? { uri: contact.avatar }
                  : contact.avatar
              }
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                marginBottom: 8,
              }}
              resizeMode="cover"
            />
            <Text
              style={{ fontWeight: "bold", fontSize: 16, marginBottom: 12 }}
            >
              {contact.name}
            </Text>
            <TextInput
              placeholder="Nhập lời nhắn kết bạn..."
              value={friendMessage}
              onChangeText={setFriendMessage}
              style={{
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 8,
                padding: 8,
                width: 200,
                marginBottom: 16,
              }}
              maxLength={100}
            />
            <View style={{ flexDirection: "row", marginTop: 8 }}>
              <Button title="Hủy" onPress={() => setShowFriendModal(false)} />
              <View style={{ width: 16 }} />
              <Button
                title="Gửi"
                onPress={async () => {
                  try {
                    // Gọi API gửi lời mời kết bạn
                    const account = await getAccount();
                    await sendFriendRequest(
                      String(contact.phoneNumber),
                      friendMessage
                    );
                    showSuccess("Đã gửi lời mời kết bạn!");
                  } catch (e) {
                    showError("Gửi lời mời thất bại!");
                  }
                  setShowFriendModal(false);
                  fetchFriends?.(); // Cập nhật danh sách bạn bè
                  setFriendMessage("");
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ContactCard;
