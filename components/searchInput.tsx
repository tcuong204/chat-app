import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useState } from "react";
import { Animated, TextInput, TouchableOpacity, View } from "react-native";

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  pointEvents?: "box-none" | "none" | "box-only" | "auto" | undefined;
  className?: string;
  inputRef?: React.RefObject<TextInput | null>;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = "Tìm kiếm tin nhắn, nhóm",
  onFocus,
  onBlur,
  pointEvents,
  className = "",
  inputRef,
}) => {
  const [isFocused, setIsFocused] = useState(true);
  const [scaleValue] = useState(new Animated.Value(1));
  const [translateYValue] = useState(new Animated.Value(0));

  const handleFocus = () => {
    setIsFocused(true);
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateYValue, {
        toValue: 0, // Dịch lên trên 5px khi focus
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateYValue, {
        toValue: 0, // Trở về vị trí ban đầu khi blur
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    onBlur?.();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleValue }, { translateY: translateYValue }],
      }}
      className={className}
      pointerEvents={pointEvents}
    >
      <View
        className={`p-3 bg-gray-50 rounded-full flex flex-row items-center border border-gray-200 py-1 ${
          isFocused ? "border-blue-500" : "border-gray-200"
        }`}
        pointerEvents={pointEvents}
      >
        <AntDesign
          name="search1"
          size={20}
          color={isFocused ? "#1877f2" : "#65676b"}
          className="px-4"
        />
        <TextInput
          className="flex-1 ml-3 text-gray-800 font-medium"
          placeholder={placeholder}
          placeholderTextColor="#65676b"
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          pointerEvents={pointEvents}
          onBlur={handleBlur}
          ref={inputRef}
          editable={pointEvents === "auto"}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText("")}>
            <AntDesign name="close" size={18} color="#65676b" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

export default SearchInput;
