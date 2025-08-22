import FriendOption from "@/components/friendOption";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, FlatList, ScrollView, Text, View } from "react-native";
import {
  GestureHandlerRootView,
  RefreshControl,
} from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { getFriendRequests, getFriends } from "../../api/friendApi";
import { ContactCard, Header, Search } from "../../components";

// Interface cho user trong friend
interface FriendUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  isOnline: boolean;
  lastSeen: string;
  avatarUrl: string | null;
}

// Interface cho từng friend
export interface Friend {
  addMethod: string;
  friendedAt: string;
  isOnline: boolean;
  lastInteraction: string | null;
  lastSeen: string;
  mutualFriendsCount: number;
  user: FriendUser;
}

const ContactScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [contactsData, setContactsData] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<{
    avatar: string;
    name: string;
    friendId: string;
    friendedAt?: string;
  } | null>(null);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const animatedValues = useRef([
    new Animated.Value(180), // Tab đầu active
    new Animated.Value(0), // Các tab khác
  ]).current;
  const [refreshing, setRefreshing] = useState(false);
  const [newRequest, setNewRequest] = useState(0);
  const fetchRequests = async () => {
    try {
      const res = await getFriendRequests({
        type: "incoming",
        status: "PENDING",
      });
      setNewRequest(res?.total || 0);
    } catch (e) {
      setNewRequest(0);
    }
  };
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Giả lập gọi API
    fetchFriends();
    fetchRequests();
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);
  const handleShowFriendOption = (friendInfo: {
    avatar: string;
    name: string;
    friendId: string;
    friendedAt?: string;
  }) => {
    setSelectedFriend(friendInfo);
    setShowOptionModal(true);
  };

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const res = await getFriends();
      // Nếu API trả về mảng trực tiếp
      // setContactsData(res);
      // Nếu API trả về object có field users hoặc friends
      setContactsData(res.friends || res.users || res || []);
      setNewRequest(res?.total);
    } catch (e) {
      setContactsData([]);
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchFriends();

    fetchRequests();
  }, []);

  // Filter contacts based on search query
  const filteredContacts = contactsData.filter(
    (friend) =>
      friend.user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.user.phoneNumber?.includes(searchQuery)
  );

  const handleContactPress = (contactId: number | string) => {
    router.push(`/profile/${contactId}`);
  };

  const renderContactItem = ({ item }: { item: Friend }) => (
    <ContactCard
      contact={{
        id: item.user.id,
        name: item.user.fullName,
        avatar:
          item.user.avatarUrl || require("../../assets/images/default.png"),
        online: item.user.isOnline,
        favorite: false,
        phoneNumber: item.user.phoneNumber,
        isFriend: true,
        friendedAt: item.friendedAt, // nếu có, truyền thêm
      }}
      onPress={(id) => handleContactPress(id)}
      showActions={true}
      showPhone={true}
      fetchFriends={fetchFriends}
      onShowFriendOption={handleShowFriendOption}
    />
  );

  const renderAlphabetSection = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const groupedContacts = alphabet
      .map((letter) => {
        const contacts = filteredContacts.filter(
          (friend) =>
            (friend.user.fullName || "").charAt(0).toUpperCase() === letter
        );
        return { letter, contacts };
      })
      .filter((group) => group.contacts.length > 0);

    return (
      <View className="bg-white">
        {groupedContacts.map((group) => (
          <View key={group.letter}>
            <View className="bg-gray-50 px-6 py-2">
              <Text className="text-gray-600 font-semibold text-sm">
                {group.letter}
              </Text>
            </View>
            {group.contacts.map((friend) => (
              <ContactCard
                key={friend.user.id}
                contact={{
                  id: friend.user.id,
                  name: friend.user.fullName,
                  avatar:
                    friend.user.avatarUrl ||
                    require("../../assets/images/default.png"),
                  online: friend.user.isOnline,
                  favorite: false,
                  phoneNumber: friend.user.phoneNumber,
                  isFriend: true,
                  friendedAt: friend.friendedAt, // nếu có, truyền thêm
                }}
                onShowFriendOption={handleShowFriendOption}
                onPress={(id) => handleContactPress(id)}
                showActions={true}
                fetchFriends={fetchFriends}
                showPhone={true}
              />
            ))}
          </View>
        ))}
      </View>
    );
  };
  useEffect(() => {
    const handleTabPress = () => {
      Animated.timing(animatedValues[1], {
        toValue: 180,
        duration: 300,
        useNativeDriver: true, // Quan trọng cho performance
      }).start();
    };
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-gray-50">
          {/* Header */}
          <Header
            subtitle=""
            title="Danh bạ"
            // showAddButton={true}
            onAddPress={() => console.log("Add contact")}
            totalFriendRequest={newRequest}
            showFriendRequest={true}
          />

          {/* Search Input */}
          <View className="bg-white px-6 py-4">
            <Search
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm bạn bè..."
              onClear={() => setSearchQuery("")}
            />
          </View>

          {/* Content */}
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {loading ? (
              <View className="flex-1 items-center justify-center mt-10">
                <Text>Đang tải danh bạ...</Text>
              </View>
            ) : searchQuery.length === 0 ? (
              // Show alphabet sections when no search
              renderAlphabetSection()
            ) : (
              // Show filtered results
              <View className="bg-white mt-4">
                <FlatList
                  data={filteredContacts}
                  renderItem={renderContactItem}
                  keyExtractor={(item) => String(item.user.id)}
                  scrollEnabled={false}
                />
              </View>
            )}
          </ScrollView>
          <FriendOption
            show={showOptionModal}
            setShow={setShowOptionModal}
            friendInfo={selectedFriend}
            fetchFriends={fetchFriends}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default ContactScreen;
