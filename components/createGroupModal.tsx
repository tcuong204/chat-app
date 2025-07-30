import { createGroupConversation } from "@/api/conversationApi";
import { Friend } from "@/app/(tabs)/contact";
import { images } from "@/constants/images";
import { showError, showSuccess } from "@/utils/customToast";
import AntDesign from "@expo/vector-icons/AntDesign";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTabBar } from "../utils/tabBarContext";
import Search from "./search";

interface Contact {
  id: string;
  name: string;
  avatar: string;
  type: "contact" | "group";
  online?: boolean;
  members?: number;
}
interface SelectedContact {
  id: string;
  name: string;
  avatar: string;
}
interface CreateGroupModalProps {
  onClose: () => void;
  contacts?: Friend[];
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  onSearchChange: (query: string) => void;
  onContactPress: (id: string) => void;
  show?: boolean;
  setShow?: React.Dispatch<SetStateAction<boolean>>;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  onClose,
  contacts,
  searchQuery,
  show,
  setSearchQuery,
  setShow,
  onSearchChange,
  onContactPress,
}) => {
  const [selectedContacts, setSelectedContacts] = useState<SelectedContact[]>(
    []
  );
  const [groupName, setGroupName] = useState("");
  const { hideTabBar, showTabBar } = useTabBar();

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

  const snapPoints = useMemo(() => ["90%", "95%"], []);

  const renderBackdrop = useCallback(
    (prop: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop appearsOnIndex={1} disappearsOnIndex={0} {...prop} />
    ),
    []
  );

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        setShow?.(false);
        showTabBar(); // Hiện lại tab bar khi bottom sheet đóng
      }
    },
    [setShow, showTabBar]
  );

  const handleContactSelect = useCallback(
    (contactId: string, avatarUrl: string, name: string) => {
      const isAlreadySelected = selectedContacts.some(
        (contact) => contact.id === contactId
      );

      if (!isAlreadySelected) {
        setSelectedContacts((prev) => [
          ...prev,
          { id: contactId, name, avatar: avatarUrl },
        ]);
      }
    },
    [selectedContacts]
  );

  const handleContactCancel = useCallback((contactId: string) => {
    setSelectedContacts((prev) =>
      prev.filter((contact) => contact.id !== contactId)
    );
  }, []);

  const handleCreateGroup = useCallback(async () => {
    if (groupName.trim() === "") {
      showError("Vui lòng nhập tên nhóm");
      return;
    }

    if (selectedContacts.length === 0) {
      showError("Vui lòng chọn ít nhất 1 thành viên");
      return;
    }

    try {
      const memberIds = selectedContacts.map((contact) => contact.id);
      const response = await createGroupConversation({
        name: groupName,
        description: groupName,
        participantIds: memberIds,
        settings: {
          allowMembersToAdd: true,
          allowAllToSend: true,
          muteNotifications: false,
          disappearingMessages: 0,
        },
      });

      if (response) {
        showSuccess("Tạo nhóm thành công!");
        setGroupName("");
        setSelectedContacts([]);
        setShow?.(false);
        router.reload();
        onClose();
      }
    } catch (error) {
      console.error("Error creating group:", error);
      showError("Không thể tạo nhóm. Vui lòng thử lại.");
    }
  }, [groupName, selectedContacts, setShow, onClose]);

  const renderContactItem = useCallback(
    ({ item }: { item: any }) => (
      <TouchableOpacity
        className="flex flex-row items-center p-4 border-b border-gray-100"
        onPress={() =>
          handleContactSelect(
            item.user.id,
            item.user.avatarUrl || images.defaultAvatar,
            item.user.fullName || item.user.name
          )
        }
      >
        <Image
          source={
            typeof item.user.avatarUrl === "string"
              ? { uri: item.user.avatarUrl }
              : images.defaultAvatar
          }
          style={{ width: 50, height: 50 }}
          className="w-12 h-12 rounded-full mr-3"
        />
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">
            {item.user.fullName || item.user.name}
          </Text>
          <Text className="text-sm text-gray-500">
            {item.user.phoneNumber || "No phone number"}
          </Text>
        </View>
        <TouchableOpacity className="p-2">
          <AntDesign name="plus" size={20} color="#3b82f6" />
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [handleContactSelect]
  );

  const renderSelectedContactItem = useCallback(
    ({ item }: { item: any }) => (
      <TouchableOpacity
        className="flex flex-row items-center p-2 bg-blue-50 rounded-full mr-2 mb-2"
        onPress={() => handleContactCancel(item.id)}
      >
        <Image
          source={
            typeof item.avatar === "string"
              ? { uri: item.avatar }
              : images.defaultAvatar
          }
          className="w-8 h-8 rounded-full mr-2"
        />
        <Text className="text-sm text-blue-600 mr-2">{item.name}</Text>
        <TouchableOpacity>
          <AntDesign name="close" size={16} color="#3b82f6" />
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [handleContactCancel]
  );

  return (
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
              Tạo nhóm mới
            </Text>
            <TouchableOpacity onPress={handleCreateGroup} className={`p-2`}>
              <Text
                className={`p-2 ${
                  selectedContacts.length > 1 ? "text-primary" : "text-gray-500"
                }`}
              >
                Tạo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Group Name Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Tên nhóm
            </Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Nhập tên nhóm..."
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              maxLength={50}
            />
          </View>

          {/* Search Input */}
          <Search
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Tìm kiếm thành viên..."
            onClear={() => onSearchChange("")}
          />
        </View>

        {/* Contact List */}
        <View className="flex-1 bg-white mt-1">
          <View className="px-6 py-4">
            <Text className="text-lg font-semibold text-gray-800 mb-4">
              Chọn thành viên ({selectedContacts.length})
            </Text>
            <FlatList
              data={selectedContacts}
              renderItem={renderSelectedContactItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              horizontal
            />
          </View>

          <FlatList
            data={contacts}
            renderItem={renderContactItem}
            keyExtractor={(item) => item?.user.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </BottomSheet>
  );
};

export default CreateGroupModal;
