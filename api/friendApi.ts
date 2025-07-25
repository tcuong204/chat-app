import axiosInstance from "./axiosInstance";

export interface FriendRequestParams {
  type?: "incoming" | "outcoming" | "all";
  status?: "PENDING" | "ACEPTED" | "DECLINED";
  limit?: string;
  offset?: string;
}
export interface FriendRequest {
  page?: number;
  limit?: number;
  query?: string;
  onlineStatus?: boolean | undefined;
  sortBy?: "recent" | "name" | "mutual";
}
// Gửi lời mời kết bạn
export const sendFriendRequest = async (
  phoneNumber: string,
  message: string = ""
) => {
  const response = await axiosInstance.post("/friends/requests", {
    phoneNumber,
    message,
  });
  return response.data;
};

// Lấy danh sách lời mời kết bạn với filter
export const getFriendRequests = async (params: FriendRequestParams = {}) => {
  const response = await axiosInstance.get("/friends/requests", { params });
  return response.data;
};

// Chấp nhận hoặc từ chối lời mời kết bạn
export const respondToFriendRequest = async (
  requestId: string,
  action: string
) => {
  // action: 'accept' hoặc 'decline'
  const response = await axiosInstance.put(
    `/friends/requests/${requestId}/respond`,
    { action }
  );
  return response.data;
};

// Lấy danh sách bạn bè
export const getFriends = async (params: FriendRequest = {}) => {
  const response = await axiosInstance.get("/friends", { params });
  return response.data;
};

// Tìm kiếm bạn bè
export const searchFriends = async (query: string) => {
  const response = await axiosInstance.get("/friends/search", {
    params: { query },
  });
  return response.data;
};

// Xóa bạn
export const removeFriend = async (friendId: string) => {
  const response = await axiosInstance.delete(`/friends/${friendId}`);
  return response.data;
};

// Chặn người dùng
export const blockUser = async (targetUserId: string) => {
  const response = await axiosInstance.post(`/friends/block/${targetUserId}`);
  return response.data;
};

// Bỏ chặn người dùng
export const unblockUser = async (userId: string) => {
  const response = await axiosInstance.delete(`/friends/block/${userId}`);
  return response.data;
};

// Lấy trạng thái kết bạn với user khác
export const getFriendshipStatus = async (userId: string) => {
  const response = await axiosInstance.get(`/friends/status${userId}`);
  return response.data;
};
