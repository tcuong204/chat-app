import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface ContactCardProps {
  contact: {
    id: number;
    name: string;
    avatar: string;
    online?: boolean;
    favorite?: boolean;
    phone?: string;
    type?: "contact" | "group";
    members?: number;
    typing?: boolean;
    lastMessage?: string;
    time?: string;
    hasVoice?: boolean;
    pinned?: boolean;
  };
  onPress: (id: number) => void;
  showActions?: boolean;
  showPhone?: boolean;
  showLastMessage?: boolean;
  className?: string;
}

const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onPress,
  showActions = false,
  showPhone = false,
  showLastMessage = false,
  className = "",
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <TouchableOpacity
      className={`flex-row items-center px-6 py-4 border-b border-gray-100 ${className}`}
      onPress={() => onPress(contact.id)}
    >
      <View className="relative">
        {!imageError ? (
          <Image
            source={{ uri: contact.avatar }}
            className="w-14 h-14 rounded-full"
            resizeMode="cover"
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
        <View className="flex flex-row items-center justify-between">
          <View className="flex mt-1">
            <Text className="font-semibold text-gray-800 text-base font-manrope">
              {contact.name}
            </Text>
            {showPhone && contact.phone && (
              <Text className="text-gray-600 text-sm">{contact.phone}</Text>
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
              <TouchableOpacity className="p-2">
                <Ionicons name="call-outline" size={20} color="#a855f7" />
              </TouchableOpacity>
              <TouchableOpacity className="p-2">
                <Ionicons name="videocam-outline" size={20} color="#a855f7" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ContactCard;
