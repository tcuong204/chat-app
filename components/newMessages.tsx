import { Friend } from "@/app/(tabs)/contact";
import { images } from "@/constants/images";
import AntDesign from "@expo/vector-icons/AntDesign";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTabBar } from "../utils/tabBarContext";
import ContactCard from "./contactCard";
import CreateGroupModal from "./createGroupModal";
import Search from "./search";

interface Contact {
  id: string;
  name: string;
  avatar: string;
  type: "contact" | "group";
  online?: boolean;
  members?: number;
}

interface NewMessageModalProps {
  onClose: () => void;
  contacts: Contact[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onContactPress: (id: string) => void;
  show?: boolean;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setShow?: React.Dispatch<SetStateAction<boolean>>;
  friends: Friend[];
}

const NewMessageModal: React.FC<NewMessageModalProps> = ({
  onClose,
  contacts,
  searchQuery,
  show,
  setSearchQuery,
  setShow,
  onSearchChange,
  onContactPress,
  friends,
}) => {
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { hideTabBar, showTabBar } = useTabBar();

  const handleImageError = useCallback((contactId: number) => {
    setImageErrors((prev) => ({ ...prev, [contactId]: true }));
  }, []);

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact &&
          contact.name &&
          contact.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [contacts, searchQuery]
  );

  const renderContactItem = useCallback(
    ({ item }: { item: any }) => (
      <ContactCard
        contact={{
          id: item.id,
          name: item?.fullName,
          avatar: item.avatarUrl || images.defaultAvatar,
          online: item.isOnline,
          isFriend: item.isFriend,
          phoneNumber: item.phoneNumber,
          // add more fields if needed
        }}
        onPress={onContactPress}
        showPhone={false}
        showLastMessage={false}
      />
    ),
    [onContactPress]
  );

  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (show) {
        bottomSheetRef.current?.expand();
        hideTabBar(); // Ẩn tab bar khi bottom sheet hiện lên
      } else {
        bottomSheetRef.current?.close();
        showTabBar(); // Hiện lại tab bar khi bottom sheet đóng
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [show, hideTabBar, showTabBar]);

  // Snap points: 50% chiều cao màn hình
  const snapPoints = useMemo(() => ["90%", "95%"], []);

  const renderBackdrop = useCallback(
    (prop: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop appearsOnIndex={1} disappearsOnIndex={0} {...prop} />
    ),
    []
  );

  // Đóng bottom sheet khi prop visible = false
  // Khi người dùng vuốt xuống hoặc bấm backdrop
  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        setShow?.(false);
        showTabBar(); // Hiện lại tab bar khi bottom sheet đóng
      }
    },
    [setShow, showTabBar]
  );

  const handleCreateGroupPress = useCallback(() => {
    setShowCreateGroup(true);
  }, []);

  const handleCloseCreateGroup = useCallback(() => {
    setShowCreateGroup(false);
  }, []);

  const handleContactPress = useCallback(
    (contactId: string) => {
      onContactPress(contactId);
    },
    [onContactPress]
  );

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleComponent={() => null}
      >
        <View className="flex-1 bg-gray-50">
          {/* Header */}
          <View className="bg-white px-6 py-4 rounded-b-3xl shadow-sm">
            <View className="flex mt-5 flex-row items-center justify-between mb-4">
              <TouchableOpacity onPress={onClose} className="p-2">
                <AntDesign name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-gray-800">
                Tin nhắn mới
              </Text>
              <View className="w-10" />
            </View>

            {/* Search Input */}
            <Search
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="Tìm kiếm"
              onClear={() => onSearchChange("")}
            />
            <TouchableOpacity
              className="flex flex-row justify-between items-center"
              onPress={handleCreateGroupPress}
            >
              <View className="items-center flex flex-row py-4 ">
                <AntDesign name="addusergroup" size={30} color="black" />
                <Text className="font-bold  text-gray-800 text-xl px-4">
                  Tạo nhóm mới
                </Text>
              </View>
              <AntDesign name="right" size={24} color="black" />
            </TouchableOpacity>
          </View>

          {/* Contact List */}
          <View className="flex-1 bg-white mt-4">
            {searchQuery.length === 0 ? (
              <View className="px-6 py-4">
                <Text className="text-lg font-semibold text-gray-800 mb-4">
                  Recent Contacts
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row space-x-2">
                    {filteredContacts
                      .slice(0, 4)
                      .filter((contact) => contact && contact.name)
                      .map((contact) => (
                        <TouchableOpacity
                          key={contact.id}
                          className="items-center"
                          onPress={() => handleContactPress(contact.id)}
                        >
                          <View className="relative">
                            <Image
                              source={
                                typeof contact.avatar === "string"
                                  ? { uri: contact.avatar }
                                  : contact.avatar
                              }
                              className="w-16 h-16 rounded-full"
                            />
                            {contact.type === "contact" && contact.online && (
                              <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></View>
                            )}
                          </View>
                          <Text
                            className="text-gray-700 text-sm mt-2 text-center"
                            numberOfLines={1}
                          >
                            {contact.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </ScrollView>
              </View>
            ) : (
              <FlatList
                data={contacts}
                renderItem={renderContactItem}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </BottomSheet>

      {/* Create Group Modal */}
      <CreateGroupModal
        setSearchQuery={setSearchQuery}
        show={showCreateGroup}
        setShow={setShowCreateGroup}
        onClose={handleCloseCreateGroup}
        contacts={friends}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onContactPress={onContactPress}
      />
    </>
  );
};

export default NewMessageModal;
