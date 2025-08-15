import { search } from "@/api/searchApi";
import { socketManager } from "@/utils/socket";
import { useDebounce } from "@/utils/useDebounce";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  RefreshControl,
  Swipeable,
} from "react-native-gesture-handler";
import { useSharedValue, withTiming } from "react-native-reanimated";

import {
  createDirectConversation,
  deleteConversation,
  getUserConversations,
} from "@/api/conversationApi";
import { getFriends } from "@/api/friendApi";
import { images } from "@/constants/images";
import { showSuccess } from "@/utils/customToast";
import { getAccount } from "@/utils/secureStore";
import {
  ContactCard,
  Header,
  MessageCard,
  NewMessageModal,
  TabNavigation,
} from "../../components";
import { Friend } from "./contact";

interface LastMessageUpdatePayload {
  conversationId: string;
  lastMessage: {
    messageId: string;
    content: string;
    messageType: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    filesInfo?: any[];
    fileInfo?: any;
  };
  unreadCount: number;
  timestamp: number;
}

export default function Index() {
  const swipeRefs = useRef<Map<number, Swipeable>>(new Map());
  const [name, setName] = useState("");
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [isSwipingId, setIsSwipingId] = useState<number | null>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const translateY = useSharedValue(0);
  const translateYAnimated = useRef(new Animated.Value(0)).current;
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [contactsData, setContactsData] = useState<Friend[]>([]);
  const [tabs, setTabs] = useState([
    { id: "all" as const, label: "Tất cả", active: true },
    { id: "group" as const, label: "Nhóm", active: false },
    { id: "direct" as const, label: "Liên hệ", active: false },
  ]);
  type Chat = {
    id: string;
    name: string;
    lastMessage: string;
    time: string;
    avatar: string;
    online?: boolean;
    typing?: boolean;
    hasVoice?: boolean;
    pinned?: boolean;
  };

  const [chatData, setChatData] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastMessages, setLastMessages] = useState<{
    [conversationId: string]: any;
  }>({});
  const [unreadCounts, setUnreadCounts] = useState<{
    [conversationId: string]: number;
  }>({});

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.active)?.id || "all",
    [tabs]
  );
  const getUser = async () => {
    const res = await getAccount();
    setName((res as any).user?.fullName);
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
            fetchConversations();
          } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
            // Vẫn xóa local data và chuyển trang ngay cả khi API fail
            console.error("Xóa nhóm không thành công:", error);
          }
        },
      },
    ]);
  };
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getUserConversations({
        sortBy: "name",
        limit: 20,
        offset: 0,
        pinned: "",
        type: activeTab,
        search: "",
        unReadOnly: false,
      });

      const conversations = response.conversations || [];
      setChatData(conversations);

      // Request last messages for all conversations from socket
      if (conversations.length > 0) {
        const conversationIds = conversations.map((conv: any) => conv.id);
        console.log("📨 Conversations found:", conversationIds);

        // Ensure socket is connected before requesting last messages
        if (!socketManager.isSocketConnected()) {
          console.log("🔌 Socket not connected, attempting to connect...");
          try {
            await socketManager.connect();
            console.log("✅ Socket connected successfully");
          } catch (error) {
            console.error("❌ Failed to connect socket:", error);
          }
        }

        if (socketManager.isSocketConnected()) {
          socketManager.requestLastMessages(conversationIds);
          console.log(
            "📨 Requested last messages for conversations:",
            conversationIds
          );
        } else {
          console.log(
            "⚠️ Socket still not connected, last messages will be requested later"
          );
        }
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]); // Add dependency array for useCallback

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
    getUser();
    getFriends();
    // Also request fresh last messages from socket
    if (chatData.length > 0 && socketManager.isSocketConnected()) {
      const conversationIds = chatData.map((conv: any) => conv.id);
      socketManager.requestLastMessages(conversationIds);
    }

    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, [chatData, fetchConversations]); // Now fetchConversations is available

  const directConversation = async (participantId: string) => {
    try {
      const res = await createDirectConversation(participantId);
      res && router.push(`/messages/${res.conversation.id}`);
    } catch (error) {
      console.log(error);
    }
  };

  const handleContactPress = useCallback((contactId: string) => {
    setShowNewMessageModal(false);
    setSearchQuery("");
    directConversation(contactId);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowNewMessageModal(false);
    setSearchQuery("");
  }, []);

  const handleSearchPress = useCallback(() => {
    setIsSearchMode(true);
    translateY.value = withTiming(-50, { duration: 200 });
    Animated.timing(translateYAnimated, {
      toValue: -50,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSearchClose = useCallback(() => {
    setIsSearchMode(false);
    setSearchQuery("");
    translateY.value = withTiming(0, { duration: 200 });
    Animated.timing(translateYAnimated, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSearchContactPress = useCallback((contactId: string) => {
    setIsSearchMode(false);
    setSearchQuery("");
    directConversation(contactId);
  }, []);

  const handleChatPress = useCallback(
    (chatId: number) => {
      // Clear unread count when entering conversation
      if (unreadCounts[chatId] && unreadCounts[chatId] > 0) {
        setUnreadCounts((prev) => ({
          ...prev,
          [chatId]: 0,
        }));
      }
      router.push(`/messages/${chatId}`);
    },
    [unreadCounts]
  );

  const handleDeleteChat = useCallback((chatId: number) => {
    // Handle delete chat logic
    handledeleteConversation(chatId.toString());
    fetchConversations();
  }, []);

  const handlePinChat = useCallback((chatId: number) => {
    // Handle pin chat logic
    console.log("Pin chat:", chatId);
  }, []);

  const handleTabPress = (tabId: string) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => ({
        ...tab,
        active: tab.id === tabId,
      }))
    );
  };

  const debouncedQuery = useDebounce(searchQuery, 500); // 500ms debounce

  // Filter contacts based on search query (chỉ dùng khi không có query)
  const fetchFriends = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFriends();
      // Nếu API trả về mảng trực tiếp
      // setContactsData(res);
      // Nếu API trả về object có field users hoặc friends
      setContactsData(res.friends || res.users || res || []);
    } catch (e) {
      setContactsData([]);
    }
    setLoading(false);
  }, []); // No dependencies needed for fetchFriends
  useEffect(() => {
    if (debouncedQuery.trim() === "") {
      setSearchResults([]);
      return;
    }
    // Gọi API search mới
    search(debouncedQuery).then((res) => {
      setSearchResults(res.users || []);
    });
  }, [debouncedQuery]);
  // Socket event handlers for last message updates
  const handleLastMessageUpdate = useCallback(
    (data: LastMessageUpdatePayload) => {
      console.log("📨 Last message update received in index:", data);
      console.log("📨 Conversation ID:", data.conversationId);
      console.log("📨 Last message:", data.lastMessage);
      console.log("📨 Unread count:", data.unreadCount);

      setLastMessages((prev) => {
        const updated = {
          ...prev,
          [data.conversationId]: data.lastMessage,
        };
        console.log("📨 Updated lastMessages state:", updated);
        console.log("📨 Previous state:", prev);
        console.log("📨 New data:", data);
        return updated;
      });
      setUnreadCounts((prev) => {
        const updated = {
          ...prev,
          [data.conversationId]: data.unreadCount,
        };
        console.log("📨 Updated unreadCounts state:", updated);
        return updated;
      });
    },
    []
  );

  const handleLastMessagesResponse = useCallback(
    (data: { updates: LastMessageUpdatePayload[] }) => {
      console.log("📨 Last messages response received in index:", data);
      console.log("📨 Number of updates:", data.updates.length);

      const newLastMessages: { [conversationId: string]: any } = {};
      const newUnreadCounts: { [conversationId: string]: number } = {};

      data.updates.forEach((update) => {
        console.log(
          "📨 Processing update for conversation:",
          update.conversationId
        );
        console.log("📨 Update data:", update);
        newLastMessages[update.conversationId] = update.lastMessage;
        newUnreadCounts[update.conversationId] = update.unreadCount;
      });

      console.log("📨 New last messages:", newLastMessages);
      console.log("📨 New unread counts:", newUnreadCounts);

      setLastMessages((prev) => {
        const updated = { ...prev, ...newLastMessages };
        console.log("📨 Updated lastMessages state:", updated);
        return updated;
      });
      setUnreadCounts((prev) => {
        const updated = { ...prev, ...newUnreadCounts };
        console.log("📨 Updated unreadCounts state:", updated);
        return updated;
      });
    },
    []
  );

  // Connect to socket and set up listeners
  useEffect(() => {
    const connectSocket = async () => {
      try {
        console.log("🔌 Attempting to connect socket in index...");
        await socketManager.connect();

        // Set up event listeners using SocketManager methods (more reliable)
        socketManager.onConversationEvent((data) => {
          console.log("📨 Conversation event received in index:", data);
          if (data.type === "last_message_update") {
            handleLastMessageUpdate(data);
          } else if (data.type === "last_messages_response") {
            handleLastMessagesResponse(data);
          }
        });

        console.log("✅ Socket connected and listeners set up in index");
        console.log(
          "🔌 Socket connection info:",
          socketManager.getConnectionInfo()
        );
      } catch (error) {
        console.error("❌ Failed to connect socket in index:", error);
      }
    };

    connectSocket();

    // Cleanup
    return () => {
      // Don't clear all listeners as it affects other components
      // Instead, properly manage conversation listeners
      console.log("🧹 Cleaning up index.tsx socket listeners");
    };
  }, [handleLastMessageUpdate, handleLastMessagesResponse]); // Removed chatData dependency

  // Initial data fetch
  useEffect(() => {
    fetchConversations();
    fetchFriends();
  }, [fetchConversations, fetchFriends]); // Add dependencies

  useEffect(() => {
    fetchConversations();
    fetchFriends();
    getUser();
  }, [tabs, fetchConversations, fetchFriends]); // Add dependencies

  // Request last messages when socket connects and chatData changes
  useEffect(() => {
    if (socketManager.isSocketConnected() && chatData.length > 0) {
      const conversationIds = chatData.map((conv: any) => conv.id);
      console.log(
        "🔄 Socket connected and chatData available, requesting last messages:",
        conversationIds
      );
      socketManager.requestLastMessages(conversationIds);
    } else {
      console.log("⚠️ Cannot request last messages:", {
        socketConnected: socketManager.isSocketConnected(),
        chatDataLength: chatData.length,
      });
    }
  }, [chatData]); // Only depend on chatData, removed lastMessages and unreadCounts

  // Request last messages after socket connection is established
  useEffect(() => {
    const requestInitialMessages = () => {
      if (chatData.length > 0) {
        const conversationIds = chatData.map((conv: any) => conv.id);
        console.log(
          "🔄 Requesting initial last messages after socket setup:",
          conversationIds
        );
        socketManager.requestLastMessages(conversationIds);
      }
    };

    const connectionHandler = (connected: boolean) => {
      if (connected) {
        console.log("✅ Socket connected, requesting initial messages");
        requestInitialMessages();
      }
    };

    // Listen for socket connection events
    socketManager.onConnectionChange(connectionHandler);

    // If already connected, request immediately
    if (socketManager.isSocketConnected()) {
      requestInitialMessages();
    }

    // Cleanup - remove connection listener
    return () => {
      socketManager.offConnectionChange(connectionHandler);
    };
  }, [chatData]);
  // Replace renderContactItem with renderUserItem for new API user shape
  const renderUserItem = ({ item }: { item: any }) => (
    <ContactCard
      contact={{
        id: item.id,
        name: item.fullName,
        avatar: item.avatarUrl || images.defaultAvatar,
        online: item.isOnline,
        isFriend: item.isFriend,

        phoneNumber: item.phoneNumber,
        // add more fields if needed
      }}
      setIsSearchMode={setIsSearchMode}
      onPress={handleSearchContactPress}
      showPhone={false}
      showLastMessage={false}
    />
  );

  // Render chat item function
  const renderChatItem = ({ item }: { item: any }) => {
    // Get last message from socket data or fallback to API data
    const socketLastMessage = lastMessages[item.id];
    const socketUnreadCount = unreadCounts[item.id] || 0;

    console.log(`📱 Rendering chat item ${item.id}:`, {
      itemId: item.id,
      socketLastMessage: socketLastMessage,
      socketUnreadCount: socketUnreadCount,
      apiLastMessage: item.lastMessage,
      apiTime: item.time,
    });
    const lastMessageContent =
      socketLastMessage?.messageType === "text"
        ? `${socketLastMessage?.senderName || "Unknown"}: ${
            socketLastMessage?.content || ""
          }`
        : socketLastMessage?.messageType === "file"
        ? `${socketLastMessage?.senderName || "Unknown"} đã gửi 1 file`
        : "Chưa có tin nhắn";

    const lastMessageTime = socketLastMessage
      ? new Date(socketLastMessage.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : item.time || "";

    return (
      <MessageCard
        chat={{
          id: item.id,
          isRead: socketLastMessage?.isRead,
          name: item.name || item.fullName,
          lastMessage: lastMessageContent,
          time: lastMessageTime,
          avatar: item.avatarUrl || item.avatar || images.defaultAvatar,
          online: item.isOnline || item.online,
          typing: item.typing,
          hasVoice: item.hasVoice,
          pinned: item.pinned,
          unreadCount: socketUnreadCount,
        }}
        onPress={handleChatPress}
        onDelete={handleDeleteChat}
        onPin={handlePinChat}
        openRow={openRow}
        setOpenRow={setOpenRow}
        isSwipingId={isSwipingId}
        setIsSwipingId={setIsSwipingId}
        swipeRef={swipeRefs}
      />
    );
  };
  return (
    <GestureHandlerRootView>
      <SafeAreaView className="flex-1 bg-white">
        <Animated.View
          style={{
            flex: 1,
            transform: [{ translateY: translateYAnimated }],
          }}
        >
          <View className="flex flex-col h-full bg-gray-50">
            {/* Header - Now handles its own search mode */}
            <Header
              title={name}
              subtitle="Hello,"
              showSearch={true}
              showNewMessage={true}
              searchValue={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
              }}
              translateY={translateYAnimated}
              onSearchPress={handleSearchPress}
              onNewMessagePress={() => setShowNewMessageModal(true)}
              isSearchMode={isSearchMode}
              onSearchClose={handleSearchClose}
            />
            {/* Content */}
            {isSearchMode ? (
              // Search Results
              <View className="flex-1 bg-white">
                {searchQuery.length === 0 ? (
                  <View className="px-4 py-4">
                    <Text className="text-lg font-semibold text-gray-800 mb-4">
                      Tìm kiếm gần đây
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View className="flex-row space-x-2">
                        {["Larry", "Natalie", "Jennifer", "Sofia"].map(
                          (search, index) => (
                            <TouchableOpacity
                              key={index}
                              className="px-4 py-2 bg-gray-100 rounded-full"
                              onPress={() => setSearchQuery(search)}
                            >
                              <Text className="text-gray-700 font-medium">
                                {search}
                              </Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                    </ScrollView>
                  </View>
                ) : (
                  <FlatList
                    data={searchResults}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>
            ) : (
              // Chat List
              <View className="flex-1 bg-bgPrimary">
                {/* Tab Navigation */}
                <TabNavigation tabs={tabs} onTabPress={handleTabPress} />

                {/* Chat Messages */}
                <View className="bg-bgPrimary rounded-lg flex-1">
                  <FlatList
                    data={chatData}
                    renderItem={renderChatItem}
                    keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                      />
                    }
                  />
                </View>
              </View>
            )}

            {/* New Message Modal */}
            <NewMessageModal
              setSearchQuery={setSearchQuery}
              show={showNewMessageModal}
              setShow={setShowNewMessageModal}
              onClose={handleCloseModal}
              contacts={searchResults}
              friends={contactsData}
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
              }}
              onContactPress={handleContactPress}
            />
          </View>
        </Animated.View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
