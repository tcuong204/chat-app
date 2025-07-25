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
    online: boolean;
    pinned?: boolean;
    typing?: boolean;
    hasVoice?: boolean;
  };
  onPress: (id: number) => void;
  onDelete?: (id: number) => void;
  onPin?: (id: number) => void;
  openRow: number | null;
  setOpenRow: (id: number | null) => void;
  isSwipingId: number | null;
  setIsSwipingId: (id: number | null) => void;
  openSwipeRef: React.RefObject<Swipeable | null>;
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
  openSwipeRef,
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
        if (openRow === chat.id && ref) {
          openSwipeRef.current = ref;
        }
      }}
      renderRightActions={renderRightActions}
      overshootRight={false}
      onSwipeableOpen={() => {
        if (isSwipingId !== openRow && openSwipeRef.current) {
          openSwipeRef.current.close();
        }
        setIsSwipingId(chat.id);
        setOpenRow(chat.id);
      }}
      // onSwipeableWillOpen={() => setOpenRow(chat.id)}
      onSwipeableClose={() => {
        setOpenRow(null);
      }}
      onSwipeableWillClose={() => {
        // setIsSwipingId(null);
      }}
    >
      <TouchableOpacity
        onLongPress={() => {
          if (isSwipingId !== openRow && openSwipeRef.current) {
            openSwipeRef.current.close();
          }
        }}
        className="flex-row items-center px-6 py-4 border-b border-gray-100"
        onPressIn={() => (pressStart.current = Date.now())}
        onPress={() => {
          if (isSwipingId !== openRow && openSwipeRef.current) {
            openSwipeRef.current.close();
          }
          const duration = Date.now() - pressStart.current;
          if (duration < 200 && openRow === null && isSwipingId === null) {
            onPress(chat.id);
          }
        }}
        activeOpacity={openRow === chat.id ? 1 : 0.7}
        disabled={isSwipingId === chat.id}
      >
        <View className="relative">
          {!imageError ? (
            <Image
              source={{ uri: chat.avatar }}
              className="w-14 h-14 rounded-full"
              resizeMode="cover"
              onError={() => setImageError(true)}
              width={50}
              height={50}
            />
          ) : (
            <View className="w-14 h-14 rounded-full bg-gray-300 flex items-center justify-center">
              <Text className="text-gray-600 font-bold text-lg">
                {chat.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {chat.online && (
            <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></View>
          )}
          {chat.pinned && (
            <View className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <Text className="text-white text-xs">📌</Text>
            </View>
          )}
        </View>

        <View className="flex-1 ml-6">
          <View className="flex flex-row items-center justify-between">
            <View className="flex mt-1">
              <Text className="font-semibold text-gray-800 text-base font-manrope">
                {chat.name}
              </Text>
              {chat.typing ? (
                <Text
                  className="text-blue-500 text-sm italic font-roboto"
                  style={{ color: "#3b82f6" }}
                >
                  {chat.lastMessage}
                </Text>
              ) : (
                <Text
                  className="text-gray-600 text-sm font-nunito"
                  numberOfLines={1}
                >
                  {chat.hasVoice && "🎵 "}
                  {chat.lastMessage}
                </Text>
              )}
            </View>
            <Text className="text-gray-500 text-sm font-nunito">
              {chat.time}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

export default MessageCard;
