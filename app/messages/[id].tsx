import { getConversationDetails } from "@/api/conversationApi";
import {
  getConversationMessages,
  GetMessagesResponse,
  markMessageAsRead,
  Message,
  sendMessage,
} from "@/api/messageApi";
import { images } from "@/constants/images";
import { showError, showSuccess } from "@/utils/customToast";
import { socketManager } from "@/utils/socket";
import AntDesign from "@expo/vector-icons/AntDesign";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
export interface ConversationParticipant {
  userId?: string;
  role: "admin" | "member";
  joinedAt: string;
  lastSeenAt: string;
}
export interface ConversationPermissions {
  canSendMessages: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canEditGroup: boolean;
  canDeleteGroup: boolean;
}

export interface ConversationSettings {
  allowMemberInvite: boolean;
  allowMemberLeave: boolean;
  requireAdminApproval: boolean;
  maxParticipants: number;
  isPublic: boolean;
}

export interface ConversationStatus {
  isActive: boolean;
  isArchived: boolean;
  isPinned: boolean;
}

export interface DirectConversation {
  id: string;
  type: "direct";
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  createdBy: string;
  isActive: boolean;
  participants: ConversationParticipant[];
  permissions: ConversationPermissions & { isAdmin: boolean };
  settings: ConversationSettings;
  status: ConversationStatus;
}
const MovieDetails = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [conversations, setConversations] = useState<DirectConversation | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const inputAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const [message, setMessage] = useState("");
  const params = useLocalSearchParams();
  const conversationId = params.id as string;

  // Optimistic UI: Store local messages before server confirmation
  const [localMessages, setLocalMessages] = useState<{
    [key: string]: Message;
  }>({});

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
    outputRange: [0, -10],
  });

  // Load conversation details
  const getConversations = async () => {
    try {
      const response = await getConversationDetails(conversationId);
      setConversations(response || null);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  // Load messages
  const loadMessages = async () => {
    try {
      setLoading(true);
      const response: GetMessagesResponse = await getConversationMessages(
        conversationId,
        1,
        50
      );
      console.log("📨 API Response:", response);

      // API trả về { messages: [...], pagination: {...} }
      const messageList = response.messages || [];
      console.log("📝 Messages loaded:", messageList.length);

      setMessages(messageList.reverse()); // Reverse to show newest at bottom
    } catch (error) {
      console.error("Error fetching messages:", error);
      showError("Không thể tải tin nhắn");
    } finally {
      setLoading(false);
    }
  };

  // Send message with optimistic UI
  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    const messageText = message.trim();
    console.log("🚀 Starting to send message:", messageText);
    setMessage("");

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      senderId: "current_user", // Will be replaced by server
      sender: {
        id: "current_user",
        fullName: "Bạn",
        username: "current_user",
        avatarUrl: null,
        isOnline: true,
        lastSeen: new Date().toISOString(),
      },
      content: messageText,
      type: "text",
      status: "sent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log("📝 Created optimistic message:", optimisticMessage);

    // Add to local messages for optimistic UI
    setLocalMessages((prev) => ({
      ...prev,
      [optimisticMessage.localId!]: optimisticMessage,
    }));

    try {
      setSending(true);
      console.log("⏳ Setting sending state to true");

      // Check if socket is connected
      if (!socketManager.isSocketConnected()) {
        console.log("❌ Socket not connected, trying to connect...");
        await socketManager.connect();

        // Wait a bit for connection
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!socketManager.isSocketConnected()) {
          console.log("❌ Still not connected, going straight to REST API");
          throw new Error("Socket not connected");
        }
      }

      console.log("✅ Socket is connected, trying Socket.IO...");
      // Try Socket.IO first (real-time) with timeout
      try {
        const socketPromise = socketManager.sendMessage({
          conversationId,
          content: messageText,
          type: "text",
          timestamp: Date.now(),
        });
        if (socketManager.isSocketConnected()) {
          console.log("✅ Socket is connected");
        }
        // Add timeout for Socket.IO
        const serverMessage = (await Promise.race([socketPromise])) as Message;
        console.log("✅ Message sent via Socket.IO:", serverMessage);

        // Remove optimistic message and add server message
        setLocalMessages((prev) => {
          const newLocal = { ...prev };
          delete newLocal[optimisticMessage.localId!];
          return newLocal;
        });

        // Add server message to messages list
        setMessages((prev) => [...prev, serverMessage]);

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        showSuccess("Tin nhắn đã gửi thành công!");
      } catch (socketError) {
        console.log("❌ Socket failed, trying REST API:", socketError);

        // Fallback to REST API with timeout
        try {
          const restPromise = sendMessage({
            conversationId,
            content: messageText,
            type: "text",
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("REST API timeout")), 10000)
          );

          const serverMessage = (await Promise.race([
            restPromise,
            timeoutPromise,
          ])) as Message;

          // Remove optimistic message and add server message
          setLocalMessages((prev) => {
            const newLocal = { ...prev };
            delete newLocal[optimisticMessage.localId!];
            return newLocal;
          });

          // Add server message to messages list
          setMessages((prev) => [...prev, serverMessage]);

          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);

          showSuccess("Tin nhắn đã gửi thành công (REST API)!");
        } catch (restError) {
          console.error("❌ REST API also failed:", restError);
          throw restError;
        }
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
      showError("Không thể gửi tin nhắn. Vui lòng thử lại.");

      // Remove optimistic message on error
      setLocalMessages((prev) => {
        const newLocal = { ...prev };
        delete newLocal[optimisticMessage.localId!];
        return newLocal;
      });
    } finally {
      console.log("🏁 Setting sending state to false");
      setSending(false);
    }
  };

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    socketManager.startTyping(conversationId);
  }, [conversationId]);

  const handleTypingStop = useCallback(() => {
    socketManager.stopTyping(conversationId);
  }, [conversationId]);

  // Socket event handlers
  useEffect(() => {
    // Connect to socket
    socketManager.connect();

    // Join conversation
    socketManager.joinConversation(conversationId);

    // Listen for new messages
    const handleNewMessage = (newMessage: Message) => {
      if (newMessage.conversationId === conversationId) {
        setMessages((prev) => [...prev, newMessage]);

        // Mark as read
        markMessageAsRead(newMessage.id);

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    // Listen for typing indicators
    const handleTyping = (data: any) => {
      if (data.conversationId === conversationId) {
        if (data.type === "started") {
          setTypingUsers((prev) => [...prev, data.userName]);
        } else if (data.type === "stopped") {
          setTypingUsers((prev) =>
            prev.filter((user) => user !== data.userName)
          );
        }
      }
    };

    // Listen for message status updates
    const handleStatusUpdate = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId ? { ...msg, status: data.status } : msg
          )
        );
      }
    };

    // Add event listeners
    socketManager.onMessage(handleNewMessage);
    socketManager.onTyping(handleTyping);
    socketManager.onStatusUpdate(handleStatusUpdate);

    // Load initial data
    getConversations();
    loadMessages();

    // Cleanup
    return () => {
      socketManager.leaveConversation(conversationId);
      socketManager.offMessage(handleNewMessage);
      socketManager.offTyping(handleTyping);
      socketManager.offStatusUpdate(handleStatusUpdate);
    };
  }, [conversationId]);

  // Handle message input changes for typing indicators
  useEffect(() => {
    let typingTimer: ReturnType<typeof setTimeout>;

    if (message.length > 0) {
      handleTypingStart();
      typingTimer = setTimeout(() => {
        handleTypingStop();
      }, 2000);
    } else {
      handleTypingStop();
    }

    return () => {
      if (typingTimer) {
        clearTimeout(typingTimer);
      }
    };
  }, [message, handleTypingStart, handleTypingStop]);

  // Render message item
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === "current_user"; // Replace with actual user ID

    return (
      <View
        className={`mb-4 ${isOwnMessage ? "items-end" : "items-start"} flex`}
      >
        <View
          className={`max-w-xs px-4 py-3 rounded-2xl ${
            isOwnMessage
              ? "bg-blue-500 text-white rounded-br-md"
              : "bg-gray-100 text-gray-800 rounded-bl-md"
          }`}
        >
          {item.type === "text" ? (
            <Text className={`font-nunito ${isOwnMessage ? "text-white" : ""}`}>
              {item.content}
            </Text>
          ) : (
            <View className="flex items-center space-x-2">
              <View className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <AntDesign name="file1" size={16} color="white" />
              </View>
              <View>
                <Text
                  className={`font-medium ${isOwnMessage ? "text-white" : ""}`}
                >
                  {item.content}
                </Text>
                <Text
                  className={`text-xs opacity-70 ${
                    isOwnMessage ? "text-white" : ""
                  }`}
                >
                  File attachment
                </Text>
              </View>
            </View>
          )}
        </View>
        <Text className="text-xs text-gray-500 mt-1">
          {new Date(item.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  // Combine server messages with local optimistic messages
  const allMessages = [...messages, ...Object.values(localMessages)].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-gray-50">
          <Stack.Screen options={{ headerShown: false }} />

          {/* Header */}
          <View className="bg-transparent px-6 py-4">
            <View className="flex flex-row justify-between items-center">
              <View className="flex flex-row items-center">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="mr-4"
                >
                  <AntDesign
                    name="arrowleft"
                    size={24}
                    color="#a855f7"
                    className="p-4"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex flex-row"
                  onPress={() =>
                    conversations &&
                    router.push({
                      pathname: "/messages/management/[id]",
                      params: { id: String(conversations.id) },
                    })
                  }
                >
                  <Image
                    source={
                      typeof conversations?.avatarUrl === "string"
                        ? { uri: conversations.avatarUrl }
                        : images.defaultAvatar
                    }
                    className="w-10 h-10 rounded-full mr-3"
                  />
                  <View>
                    <Text className="font-bold font-manrope">
                      {conversations?.name}
                    </Text>
                    <Text className="text-sm font-nunito">
                      {typingUsers.length > 0
                        ? `${typingUsers.join(", ")} đang nhập...`
                        : socketManager.isSocketConnected()
                        ? "🟢 Online (Real-time)"
                        : "🔴 Offline (API only)"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View className="flex flex-row space-x-2">
                {/* Debug button */}
                <TouchableOpacity className="p-2 bg-white/20 rounded-full">
                  <FontAwesome name="phone" size={24} color="#a855f7" />
                </TouchableOpacity>
                <TouchableOpacity className="p-2 bg-white/20 rounded-full">
                  <FontAwesome6 name="video" size={24} color="#a855f7" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            className="flex-1 p-4 bg-white"
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            ref={flatListRef}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            showsVerticalScrollIndicator={false}
          />

          {/* Input */}
          <View className="bg-white px-2 pt-3 border-t border-gray-200">
            <View className="flex flex-row items-center space-x-3">
              <View className="flex-row items-center px-4 bg-white">
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

                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ translateX: inputTranslate }],
                  }}
                >
                  <View className="bg-gray-100 rounded-full flex-1 flex-row items-center">
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Aa"
                      className="flex-1 text-gray-800 font-medium w-full px-4"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      style={{ flex: 1 }}
                      ref={inputRef}
                      multiline
                      maxLength={1000}
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

                <TouchableOpacity
                  onPress={handleSendMessage}
                  disabled={!message.trim() || sending}
                  className={`ml-3 p-2 rounded-full ${
                    message.trim() && !sending ? "bg-blue-500" : "bg-gray-300"
                  }`}
                >
                  <Feather
                    name="send"
                    size={20}
                    color={message.trim() && !sending ? "white" : "#888"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default MovieDetails;
