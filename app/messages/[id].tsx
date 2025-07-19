import AntDesign from "@expo/vector-icons/AntDesign";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router, Stack } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
const MovieDetails = () => {
  const messages = [
    { id: 1, text: "Hey 👋", sender: "other", time: "09:38 AM" },
    {
      id: 2,
      text: "Are you available for a New UI Project",
      sender: "other",
      time: "09:38 AM",
    },
    { id: 3, text: "Hello!", sender: "me", time: "09:40 AM" },
    {
      id: 4,
      text: "yes, have some space for the new task",
      sender: "me",
      time: "09:40 AM",
    },
    {
      id: 5,
      text: "Cool, should I share the details now?",
      sender: "other",
      time: "09:42 AM",
    },
    { id: 6, text: "Yes Sure, please", sender: "me", time: "09:43 AM" },
    {
      id: 7,
      text: "Great, here is the SOW of the Project",
      sender: "other",
      time: "09:45 AM",
    },
    {
      id: 8,
      text: "UI Brief.docx",
      sender: "other",
      time: "09:45 AM",
      file: true,
      fileSize: "249.18 KB",
    },
  ];
  const [inputFocused, setInputFocused] = useState(false);
  const [message, setMessage] = useState("");
  const inputAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const handleFocus = () => {
    setInputFocused(true);
    Animated.timing(inputAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };
  const handleBlur = () => {
    setInputFocused(false);
    Animated.timing(inputAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const inputTranslate = inputAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10], // Kéo sang trái 120px khi focus
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        // keyboardVerticalOffset={90}
      >
        <View className="flex-1 bg-gray-50">
          <Stack.Screen options={{ headerShown: false }} />
          {/* Header */}
          <View className="bg-transparent px-6 py-4">
            <View className=" flex flex-row justify-between items-center">
              <View className="flex flex-row items-center">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="mr-4"
                >
                  <AntDesign
                    name="arrowleft"
                    size={24}
                    className="text-primary p-4"
                  />
                </TouchableOpacity>
                <View className="flex flex-row">
                  <Image
                    source={{ uri: "https://i.pravatar.cc/150?img=1" }}
                    className="w-10 h-10 rounded-full mr-3"
                  />
                  <View>
                    <Text className=" font-bold font-manrope">
                      Larry Machigo
                    </Text>
                    <Text className=" text-sm font-nunito">Online</Text>
                  </View>
                </View>
              </View>

              <View className="flex flex-row space-x-2">
                <TouchableOpacity className="p-2 bg-white/20 rounded-full">
                  <FontAwesome name="phone" size={24} color="#a855f7" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="p-2 bg-white/20 rounded-full"
                  // onPress={() => setActiveScreen('videoCall')}
                >
                  <FontAwesome6 name="video" size={24} color="#a855f7" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            className="flex-1 p-4 bg-white"
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                className={`mb-4 ${
                  msg.sender === "me" ? "items-end" : "items-start"
                } flex`}
              >
                <View
                  className={`max-w-xs px-4 py-3 rounded-2xl ${
                    msg.sender === "me"
                      ? "bg-blue-500 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-800 rounded-bl-md"
                  }`}
                >
                  {msg.file ? (
                    <View className="flex items-center space-x-2">
                      <View className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                        {/* <Paperclip size={16} color="white" /> */}
                      </View>
                      <View>
                        <Text className="font-medium">{msg.text}</Text>
                        <Text className="text-xs opacity-70">
                          {msg.fileSize}
                        </Text>
                      </View>
                      <TouchableOpacity className="p-1 bg-white/20 rounded-full">
                        <Text className="text-white">↓</Text>
                      </TouchableOpacity>
                    </View>
                  ) : msg.sender == "me" ? (
                    <Text className="font-nunito text-white">{msg.text}</Text>
                  ) : (
                    <Text className="font-nunito">{msg.text}</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Input */}
          <View className="bg-white px-2 pt-3 border-t border-gray-200">
            <View className="flex flex-row items-center space-x-3">
              {/* Thanh nhập tin nhắn */}
              <View className="flex-row items-center px-4 bg-white">
                {/* 4 icon bên trái hoặc arrow-left */}
                {!inputFocused ? (
                  <View className="flex flex-row justify-between items-center">
                    <TouchableOpacity className="mr-3">
                      <AntDesign name="paperclip" size={24} color="#a855f7" />
                    </TouchableOpacity>
                    <TouchableOpacity className="mx-3">
                      <AntDesign name="camera" size={24} color="#a855f7" />
                    </TouchableOpacity>
                    <TouchableOpacity className="mx-3">
                      <AntDesign name="picture" size={24} color="#a855f7" />
                    </TouchableOpacity>
                    <TouchableOpacity className="mx-3">
                      <FontAwesome
                        name="microphone"
                        size={24}
                        color="#a855f7"
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="mr-4 flex items-center"
                    onPress={() => {
                      if (inputRef.current) inputRef.current.blur();
                    }}
                  >
                    <AntDesign name="left" size={24} color="#a855f7" />
                  </TouchableOpacity>
                )}
                {/* Animated input */}
                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ translateX: inputTranslate }],
                  }}
                >
                  <View className="bg-gray-100 rounded-full  flex-1 flex-row items-center">
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Aa"
                      className="flex-1 text-gray-800 font-medium w-full px-4 "
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      style={{ flex: 1 }}
                      ref={inputRef}
                    />
                    {message.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setMessage("")}
                        className="p-2"
                      >
                        <AntDesign name="close" size={18} color="#888" />
                      </TouchableOpacity>
                    )}
                  </View>
                </Animated.View>
                <TouchableOpacity className="ml-3">
                  <Feather name="send" size={24} color="#a855f7" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity className="p-2">
                <Feather name="send" size={24} color="#a855f7" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default MovieDetails;
