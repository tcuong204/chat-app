import axiosInstance from "./axiosInstance";
export interface ConversationParams {
  type?: "direct" | "group" | "all";
  limit?: number;
  unReadOnly?: true | false | "";
  search?: string;
  pinned?: true | false | "";
  sortBy?: "updated" | "name" | "created";
  offset?: number;
}
export interface GroupParams {}
export interface Settings {
  allowMembersToAdd: boolean;
  allowAllToSend: boolean;
  muteNotifications: boolean;
  disappearingMessages: number;
}
export interface GroupParams {
  name: string;
  description: string;
  participantIds: string[];
  settings: Settings;
}
// Create direct conversation
export const createDirectConversation = async (participantId: string) => {
  const response = await axiosInstance.post("/conversations/create-direct", {
    participantId,
  });
  return response.data;
};

// Get conversation details
export const getConversationDetails = async (conversationId: string) => {
  const response = await axiosInstance.get(`/conversations/${conversationId}`);
  return response.data;
};

// Update conversation metadata
export const updateConversation = async (
  conversationId: string,
  data: { name?: string; avatar?: string }
) => {
  const response = await axiosInstance.put(
    `/conversations/${conversationId}`,
    data
  );
  return response.data;
};

// Delete conversation (groups only)
export const deleteConversation = async (conversationId: string) => {
  const response = await axiosInstance.delete(
    `/conversations/${conversationId}`
  );
  return response.data;
};

// Create group conversation
export const createGroupConversation = async (data: GroupParams) => {
  const response = await axiosInstance.post("/conversations/group", data);
  return response.data;
};

// Get user conversations
export const getUserConversations = async (params?: ConversationParams) => {
  const response = await axiosInstance.get("/conversations", {
    params: {
      type: params?.type || "all",
      //   unReadOnly: params?.unReadOnly || false,
      search: params?.search || "",
      //   pinned: params?.pinned || "",
      //   sortBy: params?.sortBy || "updated",
      offset: params?.offset || 0,
      limit: params?.limit || 20,
    },
  });
  return response.data;
};

// Add participants to group conversation
export const addParticipants = async (
  conversationId: string,
  userIds: string[]
) => {
  const response = await axiosInstance.post(
    `/conversations/${conversationId}/participants`,
    {
      userIds,
    }
  );
  return response.data;
};

// Update participant role
export const updateParticipantRole = async (
  conversationId: string,
  userId: string,
  role: string
) => {
  const response = await axiosInstance.put(
    `/conversations/${conversationId}/participants/${userId}`,
    { role }
  );
  return response.data;
};

// Remove participant
export const removeParticipant = async (
  conversationId: string,
  userId: string
) => {
  const response = await axiosInstance.delete(
    `/conversations/${conversationId}/participants/${userId}`
  );
  return response.data;
};

// Leave conversation
export const leaveConversation = async (conversationId: string) => {
  const response = await axiosInstance.post(
    `/conversations/${conversationId}/leave`
  );
  return response.data;
};
