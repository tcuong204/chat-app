import { images } from "@/constants/images";
import { Link } from "expo-router";
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
import { getDeviceInfo, register as registerApi } from "../../api/authApi";

const RegisterSchema = Yup.object().shape({
  fullName: Yup.string().required("Vui lòng nhập họ và tên"),
  phoneNumber: Yup.string()
    .required("Vui lòng nhập số điện thoại")
    .matches(/^\d{9,11}$/, "Số điện thoại không hợp lệ"),
  password: Yup.string()
    .min(6, "Mật khẩu tối thiểu 6 ký tự")
    .required("Vui lòng nhập mật khẩu"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Mật khẩu xác nhận không khớp")
    .required("Vui lòng xác nhận mật khẩu"),
});

const RegisterScreen = () => {
  const { width } = Dimensions.get("window");
  const height = 150; // Tùy chỉnh theo thiết kế
  const translateY = useRef(new Animated.Value(-50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
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
        <Text className="text-3xl font-bold mb-2 font-manrope">Welcome!</Text>
        <Text className="text-gray-600 mb-6 font-nunito">
          Tạo tài khoản để sử dụng ứng dụng
        </Text>

        <Formik
          initialValues={{
            fullName: "",
            phoneNumber: "",
            password: "",
            confirmPassword: "",
          }}
          validationSchema={RegisterSchema}
          onSubmit={async (values, { setSubmitting, setStatus }) => {
            setStatus("");
            let phoneNumber = values.phoneNumber.trim();
            if (phoneNumber.startsWith("0")) {
              phoneNumber = "+84" + phoneNumber.slice(1);
            } else if (!phoneNumber.startsWith("+84")) {
              phoneNumber = "+84" + phoneNumber;
            }
            try {
              const deviceInfo = await getDeviceInfo();
              console.log("Device Info:", deviceInfo);
              const res = await registerApi(
                phoneNumber,
                values.password,
                values.fullName,
                values.confirmPassword,
                deviceInfo
              );
              console.log("Register API response:", res);
              // TODO: Chuyển sang màn hình đăng nhập hoặc tự động đăng nhập
            } catch (err: any) {
              const error = err as any;
              console.log("Register API error:", error?.response || error);
              setStatus(error?.response?.data?.message || "Đăng ký thất bại");
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
              <Text className="mb-2 font-nunito">Họ và tên</Text>
              <TextInput
                placeholder="Họ và tên"
                placeholderTextColor="#888"
                className="bg-[#F0E5FE] px-4 py-3 rounded-md mb-4"
                value={values.fullName}
                onChangeText={handleChange("fullName")}
                onBlur={handleBlur("fullName")}
              />
              {touched.fullName && errors.fullName && (
                <Text style={{ color: "red", marginBottom: 8 }}>
                  {errors.fullName}
                </Text>
              )}

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
                className="bg-[#F0E5FE] px-4 py-3 rounded-md mb-4"
                value={values.password}
                onChangeText={handleChange("password")}
                onBlur={handleBlur("password")}
              />
              {touched.password && errors.password && (
                <Text style={{ color: "red", marginBottom: 8 }}>
                  {errors.password}
                </Text>
              )}

              <Text className="mb-2 font-nunito">Xác nhận mật khẩu</Text>
              <TextInput
                placeholder="******"
                placeholderTextColor="#888"
                secureTextEntry
                className="bg-[#F0E5FE] px-4 py-3 rounded-md mb-6"
                value={values.confirmPassword}
                onChangeText={handleChange("confirmPassword")}
                onBlur={handleBlur("confirmPassword")}
              />
              {touched.confirmPassword && errors.confirmPassword && (
                <Text style={{ color: "red", marginBottom: 8 }}>
                  {errors.confirmPassword}
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
                    Đăng ký
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
        <Text className="text-center">
          Đã có tài khoản?{" "}
          <Link href="/(auth)/login">
            <Text className="text-pink-400 font-semibold">Đăng nhập</Text>
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

export default RegisterScreen;

const styles = StyleSheet.create({});
