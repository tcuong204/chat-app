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

  // Get correct platform name
  let platform = "android";
  if (Device.osName?.toLowerCase().includes("ios")) {
    platform = "ios";
  } else if (Device.osName?.toLowerCase().includes("windows")) {
    platform = "windows";
  } else if (Device.osName?.toLowerCase().includes("macos")) {
    platform = "macos";
  }

  const deviceInfo = {
    deviceId:
      "Device:" + Device.osInternalBuildId ||
      "Device:" + Device.modelId ||
      "Device:" + "unknown",
    deviceName: Device.deviceName || Device.modelName || "unknown",
    deviceType: Device.deviceType === 1 ? "mobile" : "mobile",
    platform: platform, // Use validated platform value
    pushToken: pushToken || "expo_push_token_xyz789",
    appVersion: Constants.expoConfig?.version || "1.0.0",
  };

  // Log device info for debugging
  console.log("Device Info Details:", {
    ...deviceInfo,
    osName: Device.osName,
    osVersion: Device.osVersion,
    manufacturer: Device.manufacturer,
    modelId: Device.modelId,
    deviceType: Device.deviceType,
  });
  
  return deviceInfo;
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

export const getProfile = async () => {
  const response = await axiosInstance.get("/auth/profile");
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
    refreshToken: refreshToken,
  });
  return res.data;
};
