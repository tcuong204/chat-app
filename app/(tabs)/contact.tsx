import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, FlatList, ScrollView, Text, View } from "react-native";
import { ContactCard, Header, Search } from "../../components";

const ContactScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const animatedValues = useRef([
    new Animated.Value(180), // Tab đầu active
    new Animated.Value(0), // Các tab khác
  ]).current;
  // Mock data for contacts
  const contactsData = [
    {
      id: 1,
      name: "Larry Machigo",
      phone: "+84 123 456 789",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face",
      online: true,
      favorite: true,
    },
    {
      id: 2,
      name: "Natalie Nora",
      phone: "+84 987 654 321",
      avatar:
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face",
      online: true,
      favorite: false,
    },
    {
      id: 3,
      name: "Jennifer Jones",
      phone: "+84 555 123 456",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face",
      online: false,
      favorite: true,
    },
    {
      id: 4,
      name: "Sofia",
      phone: "+84 777 888 999",
      avatar:
        "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=60&h=60&fit=crop&crop=face",
      online: false,
      favorite: false,
    },
    {
      id: 5,
      name: "Haider Lye",
      phone: "+84 111 222 333",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face",
      online: false,
      favorite: false,
    },
    {
      id: 6,
      name: "Mr. elon",
      phone: "+84 444 555 666",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face",
      online: false,
      favorite: true,
    },
  ];

  // Filter contacts based on search query
  const filteredContacts = contactsData.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery)
  );

  const handleContactPress = (contactId: number) => {
    router.push(`/messages/${contactId}`);
  };

  const renderContactItem = ({ item }: { item: any }) => (
    <ContactCard
      contact={item}
      onPress={handleContactPress}
      showActions={true}
      showPhone={true}
    />
  );

  const renderAlphabetSection = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const groupedContacts = alphabet
      .map((letter) => {
        const contacts = filteredContacts.filter(
          (contact) => contact.name.charAt(0).toUpperCase() === letter
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
            {group.contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onPress={handleContactPress}
                showActions={true}
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
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <Header
        subtitle=""
        title="Danh bạ"
        showAddButton={true}
        onAddPress={() => console.log("Add contact")}
      />

      {/* Search Input */}
      <View className="bg-white px-6 py-4">
        <Search
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search contacts..."
          onClear={() => setSearchQuery("")}
        />
      </View>

      {/* Content */}
      <ScrollView className="flex-1">
        {searchQuery.length === 0 ? (
          // Show alphabet sections when no search
          renderAlphabetSection()
        ) : (
          // Show filtered results
          <View className="bg-white mt-4">
            <FlatList
              data={filteredContacts}
              renderItem={renderContactItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ContactScreen;
