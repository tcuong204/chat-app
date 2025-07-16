import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface Tab {
  id: string;
  label: string;
  active?: boolean;
}

interface TabNavigationProps {
  tabs: Tab[];
  onTabPress: (tabId: string) => void;
  className?: string;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  onTabPress,
  className = "",
}) => {
  return (
    <View className={`flex justify-center ${className}`}>
      <View className="flex flex-row justify-center space-x-1 rounded-full w-auto">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            className={`px-6 py-2 rounded-full ${
              tab.active ? "bg-[#a855f7]" : ""
            }`}
            onPress={() => onTabPress(tab.id)}
          >
            <Text
              className={`font-roboto ${
                tab.active ? "text-white" : "text-gray-600 font-nunito"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default TabNavigation;
