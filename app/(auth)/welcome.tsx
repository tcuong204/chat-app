import { Link } from "expo-router";
import {
  Image,
  ImageBackground,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const Welcome = () => {
  return (
    <ImageBackground
      source={require("../../assets/images/background.jpg")}
      style={{ height: "100%", width: "100%" }}
    >
      <SafeAreaView className="flex-1 justify-center items-center px-8">
        <View className="items-center">
          <Image alt="Logo" source={require("../../assets/images/logo.png")} />
          <Text className="text-4xl font-bold mb-4 text-white font-roboto">
            Chào mừng!
          </Text>
          <Text className="text-lg text-white mb-8 text-center font-nunito mx-6">
            Cảm ơn bạn đã sử dụng ứng dụng của chúng tôi. Hãy đăng nhập để bắt
            đầu trải nghiệm!
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="bg-white px-14 py-3 rounded-full mb-4">
              <Text className="text-[#6e00ff] text-lg font-semibold font-nunito">
                Đăng nhập
              </Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity className="bg-white px-16 py-3 rounded-full mb-4">
              <Text className="text-[#6e00ff] text-lg font-semibold font-nunito">
                Đăng ký
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default Welcome;
