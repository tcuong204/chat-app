import { search } from "@/api/search";
import { useDebounce } from "@/utils/useDebounce";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  ContactCard,
  Header,
  MessageCard,
  NewMessageModal,
  TabNavigation,
} from "../../components";

export default function Index() {
  const openSwipeRef = useRef<Swipeable | null>(null);
  const [isSwipingId, setIsSwipingId] = useState<number | null>(null);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [animation] = useState({
    translateY: new Animated.Value(0),
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  console.log("abc", searchResults);

  const chatData = [
    {
      id: 1,
      name: "Larry Machigo",
      lastMessage: "Ok, Let me check",
      time: "09:38 AM",
      avatar: "https://i.pravatar.cc/150?img=1",
      online: true,
      pinned: true,
    },
    {
      id: 2,
      name: "Natalie Nora",
      lastMessage: "Natalie is typing...",
      time: "09:04 AM",
      avatar: "https://i.pravatar.cc/150?img=2",
      online: true,
      typing: true,
    },
    {
      id: 3,
      name: "Jennifer Jones",
      lastMessage: "Voice message",
      time: "Yesterday",
      avatar: "https://i.pravatar.cc/150?img=3",
      online: false,
      hasVoice: true,
    },
    {
      id: 4,
      name: "Larry Machigo",
      lastMessage: "See you tomorrow, take...",
      time: "26 MAY",
      avatar: "https://i.pravatar.cc/150?img=1",
      online: false,
    },
    {
      id: 5,
      name: "Sofia",
      lastMessage: "Oh... thank you so...",
      time: "12 Jun",
      avatar: "https://i.pravatar.cc/150?img=4",
      online: false,
    },
    {
      id: 6,
      name: "Haider Lye",
      lastMessage: "👍 Sticker",
      time: "",
      avatar: "https://i.pravatar.cc/150?img=5",
      online: false,
    },
    {
      id: 7,
      name: "Mr. elon",
      lastMessage: "Cool :))",
      time: "",
      avatar: "https://i.pravatar.cc/150?img=6",
      online: false,
    },
  ];

  // Mock data for contacts and groups
  const contactsData = [
    {
      id: 1,
      name: "Larry Machigo",
      avatar: "https://i.pravatar.cc/150?img=1",
      type: "contact" as const,
      online: true,
    },
    {
      id: 2,
      name: "Natalie Nora",
      avatar: "https://i.pravatar.cc/150?img=2",
      type: "contact" as const,
      online: true,
    },
    {
      id: 3,
      name: "Jennifer Jones",
      avatar: "https://i.pravatar.cc/150?img=3",
      type: "contact" as const,
      online: false,
    },
    {
      id: 4,
      name: "Sofia",
      avatar: "https://i.pravatar.cc/150?img=4",
      type: "contact" as const,
      online: false,
    },
    {
      id: 5,
      name: "Haider Lye",
      avatar: "https://i.pravatar.cc/150?img=5",
      type: "contact" as const,
      online: false,
    },
    {
      id: 6,
      name: "Mr. elon",
      avatar: "https://i.pravatar.cc/150?img=6",
      type: "contact" as const,
      online: false,
    },
    {
      id: 7,
      name: "Family Group",
      avatar: "https://i.pravatar.cc/150?img=7",
      type: "group" as const,
      members: 8,
    },
    {
      id: 8,
      name: "Work Team",
      avatar: "https://i.pravatar.cc/150?img=8",
      type: "group" as const,
      members: 12,
    },
  ];

  const handleContactPress = useCallback((contactId: number) => {
    setShowNewMessageModal(false);
    setSearchQuery("");
    router.push(`/messages/${contactId}`);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowNewMessageModal(false);
    setSearchQuery("");
  }, []);

  const handleSearchPress = useCallback(() => {
    setIsSearchMode(true);
    Animated.parallel([
      // 1. Ẩn Header
      // 2. Dịch chuyển và scale Input
      Animated.timing(animation.translateY, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);
  }, []);

  const handleSearchClose = useCallback(() => {
    setIsSearchMode(false);
    setSearchQuery("");
    Animated.parallel([
      // 1. Ẩn Header
      // 2. Dịch chuyển và scale Input
      Animated.timing(animation.translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);
  }, []);

  const handleSearchContactPress = useCallback((contactId: number) => {
    setIsSearchMode(false);
    setSearchQuery("");
    router.push(`/messages/${contactId}`);
  }, []);

  const handleChatPress = useCallback((chatId: number) => {
    router.push(`/messages/${chatId}`);
  }, []);

  const handleDeleteChat = useCallback((chatId: number) => {
    // Handle delete chat logic
    console.log("Delete chat:", chatId);
  }, []);

  const handlePinChat = useCallback((chatId: number) => {
    // Handle pin chat logic
    console.log("Pin chat:", chatId);
  }, []);

  const tabs = [
    { id: "all", label: "All Chats", active: true },
    { id: "groups", label: "Groups", active: false },
    { id: "contacts", label: "Contacts", active: false },
  ];

  const handleTabPress = useCallback((tabId: string) => {
    // Handle tab press logic
    console.log("Tab pressed:", tabId);
  }, []);

  const debouncedQuery = useDebounce(searchQuery, 500); // 500ms debounce

  // Filter contacts based on search query (chỉ dùng khi không có query)
  const filteredContacts = contactsData.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (debouncedQuery.trim() === "") {
      setSearchResults([]);
      return;
    }
    // Gọi API search mới
    search(debouncedQuery).then((res) => {
      console.log(res);

      setSearchResults(res.users || []);
    });
  }, [debouncedQuery]);

  const renderContactItem = ({ item }: { item: any }) => (
    <ContactCard
      contact={item}
      onPress={handleSearchContactPress}
      showPhone={false}
      showLastMessage={false}
    />
  );
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateY: animation.translateY }],
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
              console.log(searchResults);
            }}
            translateY={animation.translateY}
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                  renderItem={renderContactItem}
                  keyExtractor={(item) => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          ) : (
            // Chat List
            <ScrollView className="flex-1 bg-white">
              {/* Tab Navigation */}
              <TabNavigation tabs={tabs} onTabPress={handleTabPress} />

              {/* Chat Messages */}
              {chatData.map((chat) => (
                <MessageCard
                  key={chat.id}
                  chat={chat}
                  onPress={handleChatPress}
                  onDelete={handleDeleteChat}
                  onPin={handlePinChat}
                  openRow={openRow}
                  setOpenRow={setOpenRow}
                  isSwipingId={isSwipingId}
                  setIsSwipingId={setIsSwipingId}
                  openSwipeRef={openSwipeRef}
                />
              ))}
            </ScrollView>
          )}

          {/* New Message Modal */}
          <NewMessageModal
            visible={showNewMessageModal}
            onClose={handleCloseModal}
            contacts={contactsData}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onContactPress={handleContactPress}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
