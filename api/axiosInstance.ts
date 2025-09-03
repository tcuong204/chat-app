import { LOCALIP } from "@/constants/localIp";
import { getAccount } from "@/utils/secureStore";
import axios from "axios";
const axiosInstance = axios.create({
  baseURL: `${LOCALIP}/api/v1`, // Thay đổi URL này cho phù hợp
  timeout: 10000, // 10 giây
  headers: {
    "Content-Type": "application/json",
  },
});

// Add debug logging for API calls
axiosInstance.interceptors.request.use((request) => {
  console.log("Starting API Request:", {
    url: request.url,
    method: request.method,
    data: request.data,
    headers: request.headers,
    baseURL: request.baseURL,
  });
  return request;
});

// Add response logging
axiosInstance.interceptors.response.use(
  (response) => {
    console.log("API Response Success:", {
      url: response.config.url,
      status: response.status,
      data: response.data,
      headers: response.headers,
    });
    return response;
  },
  (error) => {
    console.log("API Response Error:", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      headers: error.config?.headers,
    });
    return Promise.reject(error);
  }
);

// Interceptor cho request (ví dụ: thêm token nếu có)
axiosInstance.interceptors.request.use(
  async (config) => {
    // Lấy thông tin tài khoản từ SecureStore
    const account = await getAccount();
    if (account) {
      try {
        if ((account as any).accessToken) {
          config.headers["Authorization"] = `Bearer ${
            (account as any).accessToken
          }`;
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
