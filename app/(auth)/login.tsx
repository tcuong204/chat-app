import { images } from "@/constants/images";
import { Link, router } from "expo-router";
import { Formik } from "formik";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Yup from "yup";
import { getDeviceInfo, login as loginApi } from "../../api/authApi";
import { saveAccount } from "../../utils/secureStore";

const LoginSchema = Yup.object().shape({
  phoneNumber: Yup.string()
    .required("Vui lòng nhập số điện thoại")
    .matches(/^\d{9,11}$/, "Số điện thoại không hợp lệ"),
  password: Yup.string()
    .min(6, "Mật khẩu tối thiểu 6 ký tự")
    .matches(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ in hoa")
    .required("Vui lòng nhập mật khẩu"),
});

const LoginScreen = () => {
  const { width } = Dimensions.get("window");
  const height = 150; // Tùy chỉnh theo thiết kế
  const translateY = useRef(new Animated.Value(-50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white relative">
      {/* Wave Header */}
      <View className="absolute top-0 left-0 right-0 z-0">
        <Animated.View
          style={{
            transform: [{ translateY }],
            opacity,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 0,
          }}
        >
          <Svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            <Path
              fill="#a855f7"
              d={`M0,${height * 0.5} C${width * 0.25},${height * 1.2} ${
                width * 0.75
              },0 ${width},${height * 0.5} L${width},0 L0,0 Z`}
            />
          </Svg>
        </Animated.View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="z-10 px-8 pt-36"
      >
        <Text className="text-3xl font-bold mb-2 font-manrope">Hi!</Text>
        <Text className="text-gray-600 mb-6 font-nunito">
          Đăng nhập tài khoản để sử dụng ứng dụng
        </Text>

        <Formik
          initialValues={{ phoneNumber: "", password: "" }}
          validationSchema={LoginSchema}
          onSubmit={async (values, { setSubmitting, setStatus }) => {
            setStatus("");
            try {
              // Chuyển đổi số điện thoại sang định dạng +84
              let formattedPhoneNumber = values.phoneNumber;
              if (formattedPhoneNumber.startsWith("0")) {
                formattedPhoneNumber =
                  "+84" + formattedPhoneNumber.substring(1);
              } else if (!formattedPhoneNumber.startsWith("+84")) {
                formattedPhoneNumber = "+84" + formattedPhoneNumber;
              }

              const deviceInfo = await getDeviceInfo();
              const response = await loginApi(
                formattedPhoneNumber,
                values.password,
                deviceInfo
              );
              // Lưu thông tin tài khoản vào SecureStore
              await saveAccount({
                accessToken: response.tokens.accessToken,
                refreshToken: response.tokens.refreshToken,
                user: response.user,
                phoneNumber: formattedPhoneNumber,
              });

              // Chuyển trang đến màn hình chính
              router.replace("/(tabs)");
            } catch (err: any) {
              console.log("Login Error Details:", {
                message: err.message,
                response: err?.response?.data,
                status: err?.response?.status,
                config: {
                  url: err?.config?.url,
                  method: err?.config?.method,
                  baseURL: err?.config?.baseURL,
                  data: err?.config?.data,
                },
                deviceInfo: JSON.parse(err?.config?.data || "{}").deviceInfo,
              });

              if (err.message.includes("Network Error")) {
                setStatus(
                  "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và URL server."
                );
              } else {
                setStatus(err?.response?.data?.message || "Đăng nhập thất bại");
              }
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({
            handleChange,
            handleBlur,
            handleSubmit,
            values,
            errors,
            touched,
            isSubmitting,
            status,
          }) => (
            <>
              <Text className="mb-2 font-nunito">Số điện thoại</Text>
              <TextInput
                placeholder="Số điện thoại"
                placeholderTextColor="#888"
                className="bg-[#F0E5FE] px-4 py-3 rounded-md mb-4"
                value={values.phoneNumber}
                onChangeText={handleChange("phoneNumber")}
                onBlur={handleBlur("phoneNumber")}
                keyboardType="phone-pad"
              />
              {touched.phoneNumber && errors.phoneNumber && (
                <Text style={{ color: "red", marginBottom: 8 }}>
                  {errors.phoneNumber}
                </Text>
              )}

              <Text className="mb-2 font-nunito">Mật khẩu</Text>
              <TextInput
                placeholder="******"
                placeholderTextColor="#888"
                secureTextEntry
                className="bg-[#F0E5FE] px-4 py-3 rounded-md mb-6"
                value={values.password}
                onChangeText={handleChange("password")}
                onBlur={handleBlur("password")}
              />
              {touched.password && errors.password && (
                <Text style={{ color: "red", marginBottom: 8 }}>
                  {errors.password}
                </Text>
              )}

              {status ? (
                <Text style={{ color: "red", marginBottom: 8 }}>{status}</Text>
              ) : null}

              <TouchableOpacity
                className="bg-[#a855f7] py-3 rounded-md mb-4"
                onPress={handleSubmit as any}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-center font-semibold text-base text-white ">
                    Đăng nhập
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </Formik>

        <View className="flex-row items-center my-4">
          <View className="flex-1 h-px bg-gray-300" />
          <Text className="mx-4 text-gray-500 text-sm">hoặc</Text>
          <View className="flex-1 h-px bg-gray-300" />
        </View>
        {/* Social Login Buttons */}
        <View className="flex flex-row justify-center">
          <View className="mb-4 flex flex-row items-center justify-between w-2/3">
            <TouchableOpacity
              className="flex flex-row items-center justify-center bg-white border border-gray-200 rounded-md py-2 "
              onPress={() => {
                /* TODO: Google login */
              }}
            >
              <Image
                source={images.google}
                style={{ width: 32, height: 32, marginHorizontal: 8 }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              className="flex flex-row items-center justify-center bg-white border border-gray-200 rounded-md py-2 "
              onPress={() => {
                /* TODO: Facebook login */
              }}
            >
              <Image
                source={images.facebook}
                style={{ width: 32, height: 32, marginHorizontal: 8 }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              className="flex flex-row items-center justify-center bg-white border border-gray-200 rounded-md py-2"
              onPress={() => {
                /* TODO: GitHub login */
              }}
            >
              <Image
                source={images.github}
                style={{ width: 32, height: 32, marginHorizontal: 8 }}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text className="text-center font-nunito">
          Chưa có tài khoản?{" "}
          <Link href="/(auth)/register">
            <Text className="text-pink-400 font-semibold">Đăng ký</Text>
          </Link>
        </Text>

        <View className="flex items-center mt-10">
          <Image
            source={{
              uri: "https://cdn.dribbble.com/assets/dribbble-ball-192-ec064e9ed4c04700a4ab65c0c2bffeb4e9cfb3e30cd6ed898a07e3b2c0f2c3c2.png",
            }}
            className="w-20 h-20"
            resizeMode="contain"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({});
