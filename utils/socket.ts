import { LOCALIP } from "@/constants/localIp";
import { io, Socket } from "socket.io-client";
import { Message, SendMessageRequest } from "../api/messageApi";
import { getAccount } from "./secureStore";

// Socket events from API documentation
interface BatchMarkReadDto {
  messageIds: string[];
  conversationId: string;
  readAt: number;
}

interface BatchMarkDeliveredDto {
  messageIds: string[];
  conversationId: string;
  deliveredAt: number;
}

interface RequestStatusSyncDto {
  conversationId: string;
  messageIds?: string[];
  since?: number;
}

interface ConfirmMessageDeliveryDto {
  messageId: string;
  conversationId: string;
  deliveredAt: number;
}

interface RetryMessageDeliveryDto {
  messageId: string;
  conversationId: string;
}

interface UpdatePresenceDto {
  status: string;
  statusMessage?: string;
}

interface BulkPresenceRequestDto {
  userIds: string[];
}

interface TypingStatusDto {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: number;
}

export interface SocketEvents {
  // Outgoing events (Client → Server)
  send_message: (messageData: SendMessageRequest) => void;
  mark_read: (messageId: string) => void;
  typing_start: (conversationId: string) => void;
  typing_stop: (conversationId: string) => void;
  join_conversation: (conversationId: string) => void;
  leave_conversation: (conversationId: string) => void;
  get_conversations_last_messages: (data: {
    conversationIds: string[];
  }) => void;
  // New missing events
  join_conversations: (data: { conversationIds: string[] }) => void;
  quick_share_file: (fileData: any) => void;
  batch_share_files: (data: { filesMetadata: any[] }) => void;
  test_connection: (data: { timestamp: number }) => void;
  message_delivered: (messageData: any) => void;
  mark_as_read: (data: {
    conversationId: string;
    messageIds: string[];
    userId: string;
    readAt: number;
  }) => void;
  batch_mark_read: (data: BatchMarkReadDto) => void;
  batch_mark_delivered: (data: BatchMarkDeliveredDto) => void;
  request_status_sync: (data: RequestStatusSyncDto) => void;
  confirm_message_delivery: (data: ConfirmMessageDeliveryDto) => void;
  retry_message_delivery: (data: RetryMessageDeliveryDto) => void;
  update_presence: (data: UpdatePresenceDto) => void;
  get_bulk_presence: (data: BulkPresenceRequestDto) => void;
  // Incoming events (Server → Client) - Updated to match server
  "message.sent": (data: {
    message: Message;
    conversationId: string;
    senderId: string;
  }) => void;
  "message.edited": (data: {
    message: Message;
    conversationId: string;
    editedBy: string;
  }) => void;
  "message.deleted": (data: {
    messageId: string;
    conversationId: string;
    deletedBy: string;
    timestamp: Date;
  }) => void;
  "message.read": (data: {
    messageId: string;
    readBy: string;
    readAt: Date;
    deviceId: string;
  }) => void;
  "message.status.updated": (data: {
    messageId: string;
    status: string;
    updatedBy: string;
    timestamp: Date;
  }) => void;
  "message.delivery.track": (data: {
    messageId: string;
    conversationId: string;
    senderId: string;
  }) => void;
  // New missing incoming events
  message_created: (data: {
    message: Message;
    conversationId: string;
    senderId: string;
  }) => void;
  file_shared: (data: {
    fileId: string;
    fileName: string;
    conversationId: string;
    sharedBy: string;
    timestamp: Date;
  }) => void;
  batch_files_shared: (data: {
    files: Array<{
      fileId: string;
      fileName: string;
      fileSize: number;
      fileType: string;
    }>;
    conversationId: string;
    sharedBy: string;
    timestamp: Date;
  }) => void;

  // Legacy events (keep for backward compatibility)
  message_received: (message: Message) => void;
  message_edited: (message: Message) => void;
  message_deleted: (messageId: string) => void;
  message_status_updated: (data: {
    messageId: string;
    status: string;
    userId: string;
  }) => void;
  typing_started: (data: {
    conversationId: string;
    userId: string;
    userName: string;
  }) => void;
  typing_stopped: (data: { conversationId: string; userId: string }) => void;
  user_online: (userId: string) => void;
  user_offline: (userId: string) => void;
  conversation_updated: (conversationId: string) => void;
  new_message: (message: Message) => void;
  offline_messages_batch: (messages: Message[]) => void;

  // Last message events
  conversation_last_message_update: (data: {
    conversationId: string;
    lastMessage: {
      messageId: string;
      content: string;
      messageType: string;
      senderId: string;
      senderName: string;
      timestamp: number;
      filesInfo?: any[];
      fileInfo?: any;
    };
    unreadCount: number;
    timestamp: number;
  }) => void;
  conversations_last_messages_response: (data: {
    updates: Array<{
      conversationId: string;
      lastMessage: {
        messageId: string;
        content: string;
        messageType: string;
        senderId: string;
        senderName: string;
        timestamp: number;
        filesInfo?: any[];
        fileInfo?: any;
      };
      unreadCount: number;
      timestamp: number;
    }>;
    timestamp: number;
  }) => void;
  user_typing: (data: TypingStatusDto) => void;
  typing_users_response: (data: {
    conversationId: string;
    typingUsers: Array<{ userId: string; userName: string }>;
    timestamp: number;
  }) => void;
  batch_delivery_updates: (data: {
    updates: Array<{
      messageId: string;
      userId: string;
      status: string;
      timestamp: number;
    }>;
    timestamp: number;
  }) => void;
  batch_read_receipts: (data: {
    userId: string;
    messageIds: string[];
    timestamp: number;
  }) => void;
  status_sync_response: (data: {
    conversationId: string;
    message: any;
    timestamp: number;
  }) => void;
  message_delivery_confirmed: (data: {
    messageId: string;
    userId: string;
    status: string;
    timestamp: number;
  }) => void;
  message_retry_sent: (data: { messageId: string; timestamp: number }) => void;
  retry_message_error: (data: { messageId: string; error: string }) => void;
  contact_presence_update: (data: {
    userId: string;
    status: string;
    lastSeen: number;
    statusMessage?: string;
    timestamp: number;
  }) => void;
  bulk_presence_response: (data: {
    presences: Array<{
      userId: string;
      status: string;
      lastSeen: number;
      statusMessage?: string;
    }>;
    onlineCount: number;
    timestamp: number;
  }) => void;
}

class SocketManager {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private socketId: string | null = null;

  // Event listeners
  private messageListeners: ((message: Message) => void)[] = [];
  private typingListeners: ((data: any) => void)[] = [];
  private statusListeners: ((data: any) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private fileListeners: ((data: any) => void)[] = [];
  private conversationListeners: ((data: any) => void)[] = [];

  // Connect to Socket.IO server
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        console.log("✅ Socket already connected");
        resolve();
        return;
      }

      try {
        console.log("🔌 Connecting to Socket.IO server...");

        // Get JWT token for authentication
        getAccount()
          .then((account) => {
            const accessToken = (account as any)?.accessToken;

            if (!accessToken) {
              console.error("❌ No access token found");
              reject(new Error("No access token"));
              return;
            }

            // Create socket connection
            this.socket = io(`${LOCALIP}/chat`, {
              //http://192.168.1.11:3000
              auth: {
                token: accessToken,
                deviceId: "mobile_" + Math.random().toString(36).substr(2, 9),
                deviceType: "mobile",
                platform: "react-native",
              },
              transports: ["websocket"],
              timeout: 10000,
              reconnection: true,
              reconnectionAttempts: 5,
              reconnectionDelay: 1000,
            });

            // Connection events
            this.socket.on("connect", () => {
              console.log("✅ Socket connected successfully");
              this.isConnected = true;
              this.socketId = this.socket?.id || null;
              this.notifyConnectionListeners(true);
              resolve();
            });

            this.socket.on("disconnect", (reason) => {
              console.log("❌ Socket disconnected:", reason);
              this.isConnected = false;
              this.socketId = null;
              this.notifyConnectionListeners(false);

              // Auto-reconnect if not manually disconnected
              if (reason !== "io client disconnect") {
                console.log("🔄 Attempting to reconnect...");
                setTimeout(() => {
                  this.connect().catch(console.error);
                }, 2000);
              }
            });

            this.socket.on("connect_error", (error) => {
              console.error("❌ Socket connection error:", error);
              this.isConnected = false;
              reject(error);
            });

            // Setup event listeners AFTER connection events but don't duplicate connection events
            this.setupEventListeners();
          })
          .catch((error) => {
            console.error("❌ Error getting account:", error);
            reject(error);
          });
      } catch (error) {
        console.error("❌ Error creating socket:", error);
        reject(error);
      }
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Only remove non-connection listeners to avoid duplicates
    // Don't remove connection listeners as they're already set up in connect()

    // File sharing events
    this.socket.off("file_shared");
    this.socket.off("quick_file_shared");
    this.socket.off("quick_share_file_error");
    this.socket.off("batch_files_shared");
    this.socket.off("new_file_message");
    this.socket.off("new_batch_files_message");

    // Message events
    this.socket.off("message.sent");
    this.socket.off("message_created");
    this.socket.off("message.edited");
    this.socket.off("message.deleted");
    this.socket.off("message.read");
    this.socket.off("message.status.updated");
    this.socket.off("message.delivery.track");
    this.socket.off("message_received");
    this.socket.off("new_message");
    this.socket.off("offline_messages_batch");

    this.socket.off("batch_read_receipts");
    this.socket.off("read_receipts_batch");
    this.socket.off("message.read");
    // Typing events
    this.socket.off("typing_started");
    this.socket.off("typing_stopped");
    this.socket.off("typing_start");
    this.socket.off("typing_stop");

    // User presence events
    this.socket.off("user_online");
    this.socket.off("user_offline");

    // Conversation events
    this.socket.off("conversation_updated");
    this.socket.off("conversation_last_message_update");
    this.socket.off("conversations_last_messages_response");
    //New event
    this.socket.off("user_typing");
    this.socket.off("typing_users_response");
    this.socket.off("batch_delivery_updates");
    this.socket.off("batch_read_receipts");
    this.socket.off("status_sync_response");
    this.socket.off("message_delivery_confirmed");
    this.socket.off("message_retry_sent");
    this.socket.off("retry_message_error");
    this.socket.off("contact_presence_update");
    this.socket.off("bulk_presence_response");
    // Reconnection events (keep existing ones, don't duplicate)
    this.socket.off("reconnect");
    this.socket.off("reconnect_attempt");
    this.socket.off("reconnect_error");
    this.socket.off("reconnect_failed");
    // File sharing events
    this.socket.on("file_shared", (data) => {
      console.log("📎 File shared:", data);
      this.notifyFileListeners({
        type: "file_shared",
        ...data,
      });
    });

    this.socket.on("quick_file_shared", (data) => {
      console.log("📎 Quick file shared:", data);
      this.notifyFileListeners({
        type: "quick_file_shared",
        ...data,
      });
    });
    this.socket.on("quick_share_file_error", (data) => {
      console.error("❌ Quick share file error:", data);
      this.notifyFileListeners({
        type: "quick_share_file_error",
        ...data,
      });
    });
    this.socket.on("batch_files_shared", (data) => {
      console.log("📎 Batch files shared:", data);
      this.notifyFileListeners({
        type: "batch_files_shared",
        ...data,
      });
    });
    this.socket.on("new_file_message", (data) => {
      console.log("📎 New file message:", data);

      // Notify both message listeners (for adding to chat) and file listeners
      this.notifyMessageListeners({ senderId: data.senderId, ...data });
      this.notifyFileListeners({
        type: "new_file_message",
        ...data,
      });
    });

    this.socket.on("new_batch_files_message", (data) => {
      console.log("📎 New batch files message:", data);

      // Notify both message listeners (for adding to chat) and file listeners
      this.notifyMessageListeners({ senderId: data.senderId, ...data });
      this.notifyFileListeners({
        type: "new_batch_files_message",
        ...data,
      });
    });
    // Message events - New format
    this.socket.on("message.sent", (data) => {
      console.log("📩 New message sent:", data.message);
      this.notifyMessageListeners(data.message);
    });

    this.socket.on("message_created", (data) => {
      console.log("📩 Message created:", data.message);
      this.notifyMessageListeners(data.message);
    });

    this.socket.on("message.edited", (data) => {
      console.log("✏️ Message edited:", data.message);
      this.notifyMessageListeners(data.message);
    });

    this.socket.on("message.deleted", (data) => {
      console.log("🗑️ Message deleted:", data.messageId);
      this.notifyMessageListeners({
        id: data.messageId,
        deleted: true,
        deletedBy: data.deletedBy,
        deletedAt: data.timestamp,
      } as any);
    });

    this.socket.on("batch_read_receipts", (data) => {
      console.log("📖 Batch read receipts received:", data);
      this.notifyStatusListeners({
        type: "batch_read_receipts",
        ...data,
      });
    });

    // Alternate server event name support
    this.socket.on("read_receipts_batch", (data) => {
      console.log("📖 Read receipts batch (alt) received:", data);
      this.notifyStatusListeners({
        type: "batch_read_receipts",
        ...data,
      });
    });

    this.socket.on("message.read", (data) => {
      console.log("📖 Single message read:", data);
      this.notifyStatusListeners({
        type: "message_read",
        messageId: data.messageId,
        readBy: data.readBy,
        readAt: data.readAt,
        deviceId: data.deviceId,
      });
    });
    this.socket.on("message.status.updated", (data) => {
      console.log("📊 Message status updated:", data);
      this.notifyStatusListeners({
        messageId: data.messageId,
        status: data.status,
        userId: data.updatedBy,
        timestamp: data.timestamp,
      });
    });

    this.socket.on("message.delivery.track", (data) => {
      console.log("📨 Message delivery tracked:", data.messageId);
      this.notifyStatusListeners({
        messageId: data.messageId,
        status: "delivered",
        userId: data.senderId,
        conversationId: data.conversationId,
      });
    });

    // Legacy message events
    this.socket.on("message_received", (message) => {
      console.log("📩 Legacy message received:", message);
      this.notifyMessageListeners(message);
    });

    this.socket.on("new_message", (message) => {
      console.log("📩 New message received:", message);
      this.notifyMessageListeners(message);
    });

    this.socket.on("offline_messages_batch", (messages) => {
      console.log("📦 Offline messages batch:", messages);
      messages.forEach((message: Message) => {
        this.notifyMessageListeners(message);
      });
    });

    // Typing events
    this.socket.on("user_typing", (data) => {
      this.notifyTypingListeners({
        conversationId: data.conversationId,
        userId: data.userId,
        userName: data.userName,
        type: data.isTyping ? "started" : "stopped",
        isTyping: data.isTyping,
        timestamp: data.timestamp,
      });
    });

    this.socket.on("typing_users_response", (data) => {
      console.log("⌨️ Typing users response:", data);
      this.notifyTypingListeners({
        type: "typing_users_response",
        conversationId: data.conversationId,
        typingUsers: data.typingUsers,
        timestamp: data.timestamp,
      });
    });
    this.socket.on("typing_started", (data) => {
      console.log("⌨️ User started typing:", data);
      this.notifyTypingListeners({ ...data, type: "started" });
    });

    this.socket.on("typing_stopped", (data) => {
      console.log("⌨️ User stopped typing:", data);
      this.notifyTypingListeners({ ...data, type: "stopped" });
    });

    this.socket.on("typing_start", (data) => {
      console.log("⌨️ Typing start:", data);
      this.notifyTypingListeners({ ...data, type: "started" });
    });

    this.socket.on("typing_stop", (data) => {
      console.log("⌨️ Typing stop:", data);
      this.notifyTypingListeners({ ...data, type: "stopped" });
    });

    // User presence events
    this.socket.on("user_online", (userId: string) => {
      console.log("🟢 User online:", userId);
      this.notifyStatusListeners({ type: "user_online", userId });
    });

    this.socket.on("user_offline", (userId: string) => {
      console.log("🔴 User offline:", userId);
      this.notifyStatusListeners({ type: "user_offline", userId });
    });

    // Conversation events
    this.socket.on("conversation_updated", (conversationId: string) => {
      console.log("🔄 Conversation updated:", conversationId);
      this.notifyConversationListeners({
        type: "conversation_updated",
        conversationId,
      });
    });

    this.socket.on("conversation_last_message_update", (data) => {
      console.log("📨 Conversation last message update:", data);
      this.notifyConversationListeners({
        type: "last_message_update",
        ...data,
      });
    });

    this.socket.on("conversations_last_messages_response", (data) => {
      console.log("📨 Conversations last messages response:", data);
      this.notifyConversationListeners({
        type: "last_messages_response",
        ...data,
      });
    });

    // In case backend emits singular update per conversation as a general event
    this.socket.on("conversation_last_message_update", (data) => {
      console.log("📨 Conversation last message update (single):", data);
      this.notifyConversationListeners({
        type: "last_message_update",
        ...data,
      });
    });

    // Reconnection events
    this.socket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionListeners(true);
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("❌ Reconnection error:", error);
    });

    this.socket.on("reconnect_failed", () => {
      console.log("❌ Reconnection failed");
    });
  }

  // Send message via Socket.IO
  sendMessage(messageData: SendMessageRequest): void {
    if (!this.socket || !this.isConnected) {
      console.error("Socket not connected");
      return;
    }
    if (!messageData.localId) {
      messageData.localId = Math.random().toString(36).substr(2, 9);
    }
    console.log("📤 Sending message:", messageData);
    this.socket.emit("send_message", messageData);
  }

  // Mark message as read
  markAsRead(messageId: string) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for mark as read");
      return;
    }
    console.log("📖 Marking message as read:", messageId);
    this.socket.emit("mark_read", messageId);
  }

  // Mark multiple messages as read
  markMessagesAsRead(
    conversationId: string,
    messageIds: string[],
    userId: string
  ) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for mark as read");
      return;
    }

    console.log("📖 Marking messages as read:", messageIds);

    // Sử dụng batch_mark_read thay vì mark_as_read
    this.socket.emit("batch_mark_read", {
      conversationId,
      messageIds,
      readAt: Date.now(),
    });
  }
  // Typing indicators
  startTyping(conversationId: string) {
    if (!this.socket || !this.isConnected) return;
    console.log("⌨️ Starting typing in conversation:", conversationId);
    this.socket.emit("typing_start", { conversationId });
  }

  stopTyping(conversationId: string) {
    if (!this.socket || !this.isConnected) return;
    console.log("⌨️ Stopping typing in conversation:", conversationId);
    this.socket.emit("typing_stop", { conversationId });
  }

  // Join/Leave conversation
  joinConversation(conversationId: string) {
    if (!this.socket || !this.isConnected) return;
    console.log("👥 Joining conversation:", conversationId);
    this.socket.emit("join_conversation", conversationId);
  }

  leaveConversation(conversationId: string) {
    if (!this.socket || !this.isConnected) return;
    console.log("👋 Leaving conversation:", conversationId);
    this.socket.emit("leave_conversation", conversationId);
  }

  // Join multiple conversations
  joinConversations(conversationIds: string[]) {
    if (!this.socket || !this.isConnected) return;
    console.log("👥 Joining conversations:", conversationIds);
    this.socket.emit("join_conversations", { conversationIds });
  }

  // File sharing methods
  quickShareFile(fileData: any) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for file sharing");
      return;
    }
    console.log("📎 Quick sharing file:", fileData);
    this.socket.emit("quick_share_file", fileData);
  }

  batchShareFiles(filesMetadata: any[]) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for batch file sharing");
      return;
    }
    console.log("📎 Batch sharing files:", filesMetadata);
    this.socket.emit("batch_share_files", { filesMetadata });
  }

  // Message delivery acknowledgment
  sendMessageDelivery(messageData: any) {
    if (!this.socket || !this.isConnected) return;
    console.log("📨 Sending message delivery acknowledgment:", messageData);
    this.socket.emit("message_delivered", messageData);
  }

  batchMarkRead(data: {
    messageIds: string[];
    conversationId: string;
    readAt: number;
  }) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for batch mark read");
      return;
    }
    console.log("📖 Batch marking messages as read:", data.messageIds);
    this.socket.emit("batch_mark_read", data);
  }

  batchMarkDelivered(data: BatchMarkDeliveredDto) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for batch mark delivered");
      return;
    }
    console.log("📨 Batch marking messages as delivered:", data.messageIds);
    this.socket.emit("batch_mark_delivered", data);
  }

  requestStatusSync(data: RequestStatusSyncDto) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for status sync");
      return;
    }
    console.log(
      "🔄 Requesting status sync for conversation:",
      data.conversationId
    );
    this.socket.emit("request_status_sync", data);
  }

  confirmMessageDelivery(data: ConfirmMessageDeliveryDto) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for confirming message delivery");
      return;
    }
    console.log("📨 Confirming message delivery:", data.messageId);
    this.socket.emit("confirm_message_delivery", data);
  }

  retryMessageDelivery(data: RetryMessageDeliveryDto) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for retrying message delivery");
      return;
    }
    console.log("🔄 Retrying message delivery:", data.messageId);
    this.socket.emit("retry_message_delivery", data);
  }

  updatePresence(data: UpdatePresenceDto) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for updating presence");
      return;
    }
    console.log("🟢 Updating presence:", data.status);
    this.socket.emit("update_presence", data);
  }

  getBulkPresence(data: BulkPresenceRequestDto) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for getting bulk presence");
      return;
    }
    console.log("🟢 Requesting bulk presence for users:", data.userIds);
    this.socket.emit("get_bulk_presence", data);
  }

  getTypingUsers(conversationId: string) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for getting typing users");
      return;
    }
    console.log("⌨️ Requesting typing users for conversation:", conversationId);
    this.socket.emit("get_typing_users", { conversationId });
  }
  // Request last messages for conversations
  requestLastMessages(conversationIds: string[]) {
    if (!this.socket || !this.isConnected) {
      console.log("❌ Socket not connected for requesting last messages");
      return;
    }
    console.log(
      "📨 Requesting last messages for conversations:",
      conversationIds
    );
    console.log("📨 Emitting get_conversations_last_messages event");
    this.socket.emit("get_conversations_last_messages", { conversationIds });

    // Add debug listener to confirm server response
    this.socket.once("conversations_last_messages_response", (response) => {
      console.log(
        "📨 [DEBUG] Received conversations_last_messages_response:",
        response
      );
    });
  }

  // Event listeners management
  onMessage(callback: (message: Message) => void) {
    this.messageListeners.push(callback);
  }

  onTyping(callback: (data: any) => void) {
    this.typingListeners.push(callback);
  }

  onStatusUpdate(callback: (data: any) => void) {
    this.statusListeners.push(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
  }

  onFileEvent(callback: (data: any) => void) {
    this.fileListeners.push(callback);
  }

  onConversationEvent(callback: (data: any) => void) {
    this.conversationListeners.push(callback);
  }

  // Remove event listeners
  offMessage(callback: (message: Message) => void) {
    this.messageListeners = this.messageListeners.filter(
      (cb) => cb !== callback
    );
  }

  offTyping(callback: (data: any) => void) {
    this.typingListeners = this.typingListeners.filter((cb) => cb !== callback);
  }

  offStatusUpdate(callback: (data: any) => void) {
    this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
  }

  offConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter(
      (cb) => cb !== callback
    );
  }

  offFileEvent(callback: (data: any) => void) {
    this.fileListeners = this.fileListeners.filter((cb) => cb !== callback);
  }

  offConversationEvent(callback: (data: any) => void) {
    this.conversationListeners = this.conversationListeners.filter(
      (cb) => cb !== callback
    );
  }

  // Clear all listeners
  clearAllListeners() {
    this.messageListeners = [];
    this.typingListeners = [];
    this.statusListeners = [];
    this.connectionListeners = [];
    this.fileListeners = [];
    this.conversationListeners = [];
  }

  // Notify listeners
  private notifyMessageListeners(message: Message) {
    this.messageListeners.forEach((callback) => callback(message));
  }

  private notifyTypingListeners(data: any) {
    this.typingListeners.forEach((callback) => callback(data));
  }

  private notifyStatusListeners(data: any) {
    this.statusListeners.forEach((callback) => callback(data));
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach((callback) => callback(connected));
  }

  private notifyFileListeners(data: any) {
    this.fileListeners.forEach((callback) => callback(data));
  }

  private notifyConversationListeners(data: any) {
    console.log("📢 Notifying conversation listeners:", data);
    console.log("📢 Number of listeners:", this.conversationListeners.length);
    this.conversationListeners.forEach((callback) => callback(data));
  }

  // Utility methods
  isSocketConnected(): boolean {
    return this.isConnected && !!this.socket;
  }

  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      socketId: this.socketId,
      socketExists: !!this.socket,
      reconnectionAttempts: this.reconnectAttempts,
    };
  }

  disconnect() {
    if (this.socket) {
      console.log("🔌 Disconnecting socket");
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Test socket connection
  testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        console.log("❌ Socket not connected for testing");
        resolve(false);
        return;
      }

      console.log("🧪 Testing socket connection...");
      this.socket.emit(
        "test_connection",
        { timestamp: Date.now() },
        (response: any) => {
          console.log("✅ Test response received:", response);
          resolve(true);
        }
      );

      // Timeout after 5 seconds
      setTimeout(() => {
        console.log("⏰ Test timeout");
        resolve(false);
      }, 5000);
    });
  }

  // Force reconnect
  async forceReconnect(): Promise<void> {
    console.log("🔄 Force reconnecting...");
    if (this.socket) {
      this.socket.disconnect();
    }
    await this.connect();
  }

  // Remove the problematic setupNewMessageListener method
  // Instead, use the standard event listeners above
}

// Export singleton instance
export const socketManager = new SocketManager();

// Legacy export for backward compatibility
export const socket = socketManager.getSocket();
