import { Link } from "expo-router";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";

const Welcome = () => {
  return (
    <SafeAreaView className="flex-1 bg-white justify-center items-center px-8">
      <View className="items-center">
        <Text className="text-4xl font-bold mb-4 text-purple-600 font-manrope">
          Chào mừng!
        </Text>
        <Text className="text-lg text-gray-700 mb-8 text-center font-nunito">
          Cảm ơn bạn đã sử dụng ứng dụng của chúng tôi. Hãy đăng nhập để bắt đầu
          trải nghiệm!
        </Text>
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity className="bg-[#a855f7] px-8 py-3 rounded-md">
            <Text className="text-white text-lg font-semibold">Bắt đầu</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
};

export default Welcome;
