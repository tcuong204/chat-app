import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useRef, useState } from "react";
import { Animated, Image, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

interface MessageCardProps {
  chat: {
    id: number;
    name: string;
    lastMessage: string;
    time: string;
    avatar: string;
    online?: boolean;
    pinned?: boolean;
    typing?: boolean;
    type?: string;
    hasVoice?: boolean;
    isRead?: boolean;
    unreadCount?: number;
  };
  onPress: (id: number) => void;
  onDelete?: (id: number) => void;
  onPin?: (id: number) => void;
  openRow: number | null;
  setOpenRow: (id: number | null) => void;
  isSwipingId: number | null;
  setIsSwipingId: (id: number | null) => void;
  swipeRef: React.MutableRefObject<Map<number, Swipeable>>;
}

const MessageCard: React.FC<MessageCardProps> = ({
  chat,
  onPress,
  onDelete,
  onPin,
  openRow,
  setOpenRow,
  isSwipingId,
  setIsSwipingId,
  swipeRef,
}) => {
  const pressStart = useRef(0);
  const [imageError, setImageError] = useState(false);
  // console.log("openRow", openRow);
  // console.log("isSwipingId", isSwipingId);
  const renderRightActions = (progress: any, dragX: any) => {
    const transDelete = dragX.interpolate({
      inputRange: [-60, 0],
      outputRange: [0, 60],
      extrapolate: "clamp",
    });
    const opacityDelete = dragX.interpolate({
      inputRange: [-60, 0],
      outputRange: [1, 0.3],
      extrapolate: "clamp",
    });

    const transPin = dragX.interpolate({
      inputRange: [-60, 0],
      outputRange: [0, 60],
      extrapolate: "clamp",
    });
    const opacityPin = dragX.interpolate({
      inputRange: [-60, 0],
      outputRange: [1, 0.3],
      extrapolate: "clamp",
    });

    return (
      <View style={{ flexDirection: "row", width: 120 }}>
        <Animated.View
          style={{
            transform: [{ translateX: transDelete }],
            opacity: opacityDelete,
            width: 60,
          }}
        >
          <TouchableOpacity
            style={{
              backgroundColor: "#ef4444",
              justifyContent: "center",
              alignItems: "center",
              width: 60,
              height: "100%",
            }}
            onPress={() => onDelete?.(chat.id)}
          >
            <AntDesign name="delete" size={24} color="white" />
          </TouchableOpacity>
        </Animated.View>
        <Animated.View
          style={{
            transform: [{ translateX: transPin }],
            opacity: opacityPin,
            width: 60,
          }}
        >
          <TouchableOpacity
            style={{
              backgroundColor: "#facc15",
              justifyContent: "center",
              alignItems: "center",
              width: 60,
              height: "100%",
            }}
            onPress={() => onPin?.(chat.id)}
          >
            <AntDesign name="pushpin" size={24} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={(ref) => {
        if (ref) {
          swipeRef.current.set(chat.id, ref);
        }
      }}
      renderRightActions={renderRightActions}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (openRow && openRow !== chat.id) {
          const prevRef = swipeRef.current.get(openRow);
          prevRef?.close();
        }
        setOpenRow(chat.id);
      }}
      onSwipeableClose={() => {
        if (openRow === chat.id) {
          setOpenRow(null);
        }
      }}
    >
      <TouchableOpacity
        onLongPress={() => {
          const prevRef = swipeRef.current.get(chat.id);
          prevRef?.close();
        }}
        onPressIn={() => {
          pressStart.current = Date.now();
        }}
        onPress={() => {
          const duration = Date.now() - pressStart.current;
          const currentRef = swipeRef.current.get(chat.id);

          if (openRow && openRow !== chat.id) {
            // Nếu có dòng đang mở và khác dòng hiện tại → đóng dòng đang mở
            const openRef = swipeRef.current.get(openRow);
            openRef?.close();
          }

          if (duration < 200 && openRow === null && isSwipingId === null) {
            // Nếu là click ngắn → xử lý mở nội dung tin nhắn
            onPress(chat.id);
          } else {
            // Nếu giữ lâu → đóng dòng hiện tại (nếu đang mở)
            currentRef?.close();
          }
        }}
        className={`flex-row items-center px-6 py-4 border-b ${
          !chat.isRead || chat.isRead == undefined
            ? "bg-gray-100"
            : "border-gray-500"
        } `}
      >
        <View className="relative ">
          <Image
            source={
              typeof chat.avatar === "string"
                ? { uri: chat.avatar }
                : chat.avatar
            }
            className="w-14 h-14 rounded-full"
            resizeMode="cover"
            onError={() => setImageError(true)}
            style={{ width: 50, height: 50 }}
          />
          {chat.online && (
            <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></View>
          )}
          {chat.pinned && (
            <View className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <AntDesign name="pushpin" size={12} color="white" />
            </View>
          )}
        </View>

        <View className="flex-1 ml-6">
          <View className="flex flex-row items-center justify-between">
            <View className="flex ">
              <Text className="font-semibold text-gray-800 text-base font-manrope">
                {chat.name}
              </Text>
              {chat.typing ? (
                <Text
                  className="text-blue-500 text-sm italic font-roboto"
                  style={{ color: "#3b82f6" }}
                >
                  {chat.lastMessage || ""}
                </Text>
              ) : (
                <Text
                  className="text-gray-600 text-sm font-nunito"
                  numberOfLines={1}
                >
                  {chat.lastMessage || ""}
                </Text>
              )}
            </View>
            <View className="flex items-end">
              <Text className="text-gray-500 text-sm font-nunito">
                {chat.time || ""}
              </Text>
              {chat.unreadCount && chat.unreadCount > 0 && (
                <View className="mt-1 bg-red-500 rounded-full px-2 py-1 min-w-[20px] items-center">
                  <Text className="text-white text-xs font-bold">
                    {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

export default MessageCard;
