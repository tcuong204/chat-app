import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import axiosInstance from "./axiosInstance";

export async function getDeviceInfo() {
  let pushToken = "";
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus === "granted") {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      pushToken = tokenData.data;
    }
  } catch (e) {
    // handle error
  }

  return {
    deviceId:
      "Device:" + Device.osInternalBuildId ||
      "Device:" + Device.modelId ||
      "Device:" + "unknown",
    deviceName: Device.deviceName || Device.modelName || "unknown",
    deviceType: Device.deviceType === 1 ? "mobile" : "mobile",
    platform: Device.osName?.toLowerCase() || "unknown",
    pushToken: "expo_push_token_xyz789",
    appVersion: Constants.expoConfig?.version || "unknown",
  };
}

// Đăng nhập
export const login = async (
  phoneNumber: string,
  password: string,
  deviceInfo?: any
) => {
  const response = await axiosInstance.post("/auth/login", {
    phoneNumber,
    password,
    deviceInfo,
  });
  return response.data;
};

// Đăng ký
export const register = async (
  phoneNumber: string,
  password: string,
  fullName: string,
  confirmPassword: string,
  deviceInfo?: any
) => {
  const response = await axiosInstance.post("/auth/register", {
    phoneNumber,
    password,
    fullName,
    confirmPassword,
    deviceInfo,
  });
  return response.data;
};

// Đăng xuất
export const logout = async () => {
  const response = await axiosInstance.post("/auth/logout", {});
  return response.data;
};
// lấy token mới
export const refreshToken = async (refreshToken: string) => {
  const res = await axiosInstance.post("/auth/refresh-token", {
    refreshToken,
  });
  return res.data;
};
