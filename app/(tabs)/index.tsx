import { search } from "@/api/searchApi";
import { useDebounce } from "@/utils/useDebounce";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  ContactCard,
  Header,
  MessageCard,
  NewMessageModal,
  TabNavigation,
} from "../../components";
import { Friend } from "./contact";

export default function Index() {
  const swipeRefs = useRef<Map<number, Swipeable>>(new Map());
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
    { id: "all", label: "Tất cả", active: true },
    { id: "group", label: "Nhóm", active: false },
    { id: "direct", label: "Liên hệ", active: false },
  ]);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);
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
  const activeTab = tabs.find((tab) => tab.active)?.id || "all";
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
  const fetchConversations = async () => {
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

      setChatData(response.conversations || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };
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

  const handleChatPress = useCallback((chatId: number) => {
    router.push(`/messages/${chatId}`);
  }, []);

  const handleDeleteChat = useCallback((chatId: string) => {
    // Handle delete chat logic
    handledeleteConversation(chatId);
    fetchConversations();
  }, []);

  const handlePinChat = useCallback((chatId: number) => {
    // Handle pin chat logic
    console.log("Pin chat:", chatId);
  }, []);
  console.log(tabs);

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
  const fetchFriends = async () => {
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
  };
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
  useEffect(() => {
    fetchConversations();
    fetchFriends();
  }, [tabs]);
  useEffect(() => {
    fetchConversations();
  }, []);
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
      onPress={handleSearchContactPress}
      showPhone={false}
      showLastMessage={false}
    />
  );

  // Render chat item function
  const renderChatItem = ({ item }: { item: any }) => (
    <MessageCard
      chat={{
        id: item.id,
        name: item.name || item.fullName,
        lastMessage: item.lastMessage || "",
        time: item.time || "",
        avatar: item.avatarUrl || item.avatar || images.defaultAvatar,
        online: item.isOnline || item.online,
        typing: item.typing,
        hasVoice: item.hasVoice,
        pinned: item.pinned,
      }}
      onPress={handleChatPress}
      onDelete={() => handleDeleteChat(item.id)}
      onPin={handlePinChat}
      openRow={openRow}
      setOpenRow={setOpenRow}
      isSwipingId={isSwipingId}
      setIsSwipingId={setIsSwipingId}
      swipeRef={swipeRefs}
    />
  );
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
              title="Johan"
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
