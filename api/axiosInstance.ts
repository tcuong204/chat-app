import axios from "axios";
import * as SecureStore from "expo-secure-store";

const axiosInstance = axios.create({
  baseURL: "http://192.168.0.102:3000/api/v1", // Thay đổi URL này cho phù hợp
  timeout: 10000, // 10 giây
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor cho request (ví dụ: thêm token nếu có)
axiosInstance.interceptors.request.use(
  async (config) => {
    // Lấy thông tin tài khoản từ SecureStore
    const accountData = await SecureStore.getItemAsync("user_account");
    if (accountData) {
      try {
        const account = JSON.parse(accountData);
        if (account.token) {
          config.headers["Authorization"] = `Bearer ${account.token}`;
        }
      } catch (error) {
        console.error("Lỗi khi parse account data:", error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor cho response (xử lý lỗi chung)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Có thể xử lý lỗi chung ở đây
    return Promise.reject(error);
  }
);

export default axiosInstance;
