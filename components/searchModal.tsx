import AntDesign from "@expo/vector-icons/AntDesign";
import React from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ContactCard from "./contactCard";
import SearchInput from "./searchInput";

interface Contact {
  id: string;
  name: string;
  avatar: string;
  type: "contact" | "group";
  online?: boolean;
  members?: number;
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onContactPress: (id: string) => void;
  recentSearches?: string[];
  onRecentSearchPress?: (query: string) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  onClose,
  contacts,
  searchQuery,
  onSearchChange,
  onContactPress,
  recentSearches = [],
  onRecentSearchPress,
}) => {
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderContactItem = ({ item }: { item: Contact }) => (
    <ContactCard
      contact={item}
      onPress={onContactPress}
      showPhone={false}
      showLastMessage={false}
    />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header - Messenger style */}
        <View className="bg-white px-4 py-3 border-b border-gray-200">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={onClose} className="p-2">
              <AntDesign name="arrowleft" size={24} color="#1877f2" />
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-gray-800">
              Tìm kiếm
            </Text>
            <View className="w-10" />
          </View>
        </View>

        {/* Search Input - Messenger style */}
        <View className="px-4 py-3 bg-gray-50">
          <SearchInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Tìm kiếm tin nhắn, nhóm"
          />
        </View>

        {/* Search Results */}
        <View className="flex-1 bg-white">
          {searchQuery.length === 0 ? (
            <View className="px-4 py-4">
              <Text className="text-lg font-semibold text-gray-800 mb-4">
                Tìm kiếm gần đây
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row space-x-2">
                  {recentSearches.map((search, index) => (
                    <TouchableOpacity
                      key={index}
                      className="px-4 py-2 bg-gray-100 rounded-full"
                      onPress={() => onRecentSearchPress?.(search)}
                    >
                      <Text className="text-gray-700 font-medium">
                        {search}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              renderItem={renderContactItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

export default SearchModal;
