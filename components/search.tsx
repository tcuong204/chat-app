import AntDesign from "@expo/vector-icons/AntDesign";
import React from "react";
import { TextInput, TouchableOpacity, View } from "react-native";

interface SearchProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
}

const Search: React.FC<SearchProps> = ({
  value,
  onChangeText,
  placeholder = "Search...",
  onClear,
  className = "",
}) => {
  return (
    <View className={`relative ${className}`}>
      <TextInput
        className="bg-gray-100 px-12 py-3 rounded-full text-gray-800"
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
      />
      <AntDesign
        name="search1"
        size={20}
        color="#9ca3af"
        style={{ position: "absolute", left: 16, top: 12 }}
      />
      {value.length > 0 && onClear && (
        <TouchableOpacity
          onPress={onClear}
          style={{ position: "absolute", right: 16, top: 12 }}
        >
          <AntDesign name="close" size={20} color="#9ca3af" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default Search;
