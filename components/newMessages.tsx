import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ContactCard from "./contactCard";
import Search from "./search";

interface Contact {
  id: number;
  name: string;
  avatar: string;
  type: "contact" | "group";
  online?: boolean;
  members?: number;
}

interface NewMessageModalProps {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onContactPress: (id: number) => void;
}

const NewMessageModal: React.FC<NewMessageModalProps> = ({
  visible,
  onClose,
  contacts,
  searchQuery,
  onSearchChange,
  onContactPress,
}) => {
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>(
    {}
  );

  const handleImageError = (contactId: number) => {
    setImageErrors((prev) => ({ ...prev, [contactId]: true }));
  };

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
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white px-6 py-4 rounded-b-3xl shadow-sm">
          <View className="flex mt-5 flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={onClose} className="p-2">
              <AntDesign name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-800">New Message</Text>
            <View className="w-10" />
          </View>

          {/* Search Input */}
          <Search
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search contacts or groups..."
            onClear={() => onSearchChange("")}
          />
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
                  {contacts.slice(0, 4).map((contact) => (
                    <TouchableOpacity
                      key={contact.id}
                      className="items-center"
                      onPress={() => onContactPress(contact.id)}
                    >
                      <View className="relative">
                        {!imageErrors[contact.id] ? (
                          <Image
                            source={{ uri: contact.avatar }}
                            className="w-16 h-16 rounded-full"
                            onError={() => handleImageError(contact.id)}
                          />
                        ) : (
                          <View className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                            <Text className="text-gray-600 font-bold text-xl">
                              {contact.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
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

export default NewMessageModal;
