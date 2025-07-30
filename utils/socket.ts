import { io, Socket } from "socket.io-client";
import { Message, SendMessageRequest } from "../api/messageApi";
import { getAccount } from "./secureStore";

// Socket events from API documentation
export interface SocketEvents {
  // Outgoing events (Client → Server)
  send_message: (messageData: SendMessageRequest) => void;
  mark_read: (messageId: string) => void;
  typing_start: (conversationId: string) => void;
  typing_stop: (conversationId: string) => void;
  join_conversation: (conversationId: string) => void;
  leave_conversation: (conversationId: string) => void;

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
            this.socket = io("http://192.168.0.102:3000", {
              auth: {
                token: accessToken,
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
              resolve();
            });

            this.socket.on("disconnect", (reason) => {
              console.log("❌ Socket disconnected:", reason);
              this.isConnected = false;
              this.socketId = null;

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

            // Setup event listeners AFTER connection events
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

    // Remove existing listeners to avoid duplicates
    this.socket.off("connect");
    this.socket.off("disconnect");
    this.socket.off("connect_error");
    this.socket.off("message_received");
    this.socket.off("message_edited");
    this.socket.off("message_deleted");
    this.socket.off("message_status_updated");
    this.socket.off("typing_started");
    this.socket.off("typing_stopped");
    this.socket.off("user_online");
    this.socket.off("user_offline");
    this.socket.off("conversation_updated");
    this.socket.off("reconnect");
    this.socket.off("reconnect_attempt");
    this.socket.off("reconnect_error");
    this.socket.off("reconnect_failed");

    // Connection events
    this.socket.on("connect", () => {
      console.log("✅ Connected to socket server");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionListeners(true);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected from socket server:", reason);
      this.isConnected = false;
      this.notifyConnectionListeners(false);
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log("❌ Max reconnection attempts reached");
      }
    });

    // Message events - Updated to match server events
    this.socket.on(
      "message.sent",
      (data: {
        message: Message;
        conversationId: string;
        senderId: string;
      }) => {
        console.log("📩 New message received:", data.message);
        this.notifyMessageListeners(data.message);
      }
    );

    this.socket.on(
      "message.edited",
      (data: {
        message: Message;
        conversationId: string;
        editedBy: string;
      }) => {
        console.log("✏️ Message edited:", data.message);
        this.notifyMessageListeners(data.message);
      }
    );

    this.socket.on(
      "message.deleted",
      (data: {
        messageId: string;
        conversationId: string;
        deletedBy: string;
        timestamp: Date;
      }) => {
        console.log("🗑️ Message deleted:", data.messageId);
        // Handle message deletion in UI
        this.notifyMessageListeners({
          id: data.messageId,
          deleted: true,
        } as any);
      }
    );

    this.socket.on(
      "message.read",
      (data: {
        messageId: string;
        readBy: string;
        readAt: Date;
        deviceId: string;
      }) => {
        console.log("📖 Message read:", data.messageId, "by:", data.readBy);
        this.notifyStatusListeners({
          messageId: data.messageId,
          status: "read",
          userId: data.readBy,
        });
      }
    );

    this.socket.on(
      "message.status.updated",
      (data: {
        messageId: string;
        status: string;
        updatedBy: string;
        timestamp: Date;
      }) => {
        console.log("📊 Message status updated:", data);
        this.notifyStatusListeners({
          messageId: data.messageId,
          status: data.status,
          userId: data.updatedBy,
        });
      }
    );

    this.socket.on(
      "message.delivery.track",
      (data: {
        messageId: string;
        conversationId: string;
        senderId: string;
      }) => {
        console.log("📨 Message delivery tracked:", data.messageId);
        this.notifyStatusListeners({
          messageId: data.messageId,
          status: "delivered",
          userId: data.senderId,
        });
      }
    );

    // Typing events - Keep existing ones in case server has them
    this.socket.on("typing_started", (data) => {
      console.log("⌨️ User started typing:", data);
      this.notifyTypingListeners(data);
    });

    this.socket.on("typing_stopped", (data) => {
      console.log("⌨️ User stopped typing:", data);
      this.notifyTypingListeners(data);
    });

    // Additional typing events that server might emit
    this.socket.on(
      "typing.start",
      (data: { conversationId: string; userId: string; userName: string }) => {
        console.log("⌨️ User started typing:", data);
        this.notifyTypingListeners({
          conversationId: data.conversationId,
          type: "started",
          userName: data.userName,
        });
      }
    );

    this.socket.on(
      "typing.stop",
      (data: { conversationId: string; userId: string }) => {
        console.log("⌨️ User stopped typing:", data);
        this.notifyTypingListeners({
          conversationId: data.conversationId,
          type: "stopped",
          userName: data.userId,
        });
      }
    );

    // User presence events
    this.socket.on("user_online", (userId: string) => {
      console.log("🟢 User online:", userId);
    });

    this.socket.on("user_offline", (userId: string) => {
      console.log("🔴 User offline:", userId);
    });

    // Additional user presence events
    this.socket.on(
      "user.online",
      (data: { userId: string; timestamp: Date }) => {
        console.log("🟢 User online:", data.userId);
      }
    );

    this.socket.on(
      "user.offline",
      (data: { userId: string; timestamp: Date }) => {
        console.log("🔴 User offline:", data.userId);
      }
    );

    // Conversation events
    this.socket.on("conversation_updated", (conversationId: string) => {
      console.log("🔄 Conversation updated:", conversationId);
    });

    this.socket.on(
      "conversation.updated",
      (data: {
        conversationId: string;
        updatedBy: string;
        timestamp: Date;
      }) => {
        console.log("🔄 Conversation updated:", data.conversationId);
      }
    );

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
  sendMessage(messageData: SendMessageRequest): Promise<Message> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        console.log("❌ Socket not connected for sending message");
        reject(new Error("Socket not connected"));
        return;
      }
      // Add localId if not provided
      if (!messageData.localId) {
        messageData.localId = `local_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }

      console.log("📤 Sending message via socket:", messageData);
      console.log("🔌 Socket state:", {
        connected: this.isConnected,
        socketExists: !!this.socket,
        socketId: this.socket?.id,
      });

      // Emit with the correct event name that server expects
      this.socket.emit("send_message", messageData, (response: any) => {
        console.log("res", response);

        if (response.error) {
          console.error("❌ Socket send error:", response.error);
          reject(new Error(response.error));
        } else {
          console.log("✅ Message sent successfully via socket");
          resolve(response.message);
        }
      });

      // Also listen for the message.sent event as fallback
      const messageHandler = (data: {
        message: Message;
        conversationId: string;
        senderId: string;
      }) => {
        if (data.message.localId === messageData.localId) {
          console.log("📨 Message received via event:", data.message);
          this.socket?.off("message.sent", messageHandler);
          resolve(data.message);
        }
      };

      this.socket.on("message.sent", messageHandler);
    });
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

  // Typing indicators
  startTyping(conversationId: string) {
    if (!this.socket || !this.isConnected) return;
    console.log("⌨️ Starting typing in conversation:", conversationId);
    // Try both event names in case server uses different naming
    this.socket.emit("typing_start", conversationId);
    this.socket.emit("typing.start", { conversationId });
  }

  stopTyping(conversationId: string) {
    if (!this.socket || !this.isConnected) return;
    console.log("⌨️ Stopping typing in conversation:", conversationId);
    // Try both event names in case server uses different naming
    this.socket.emit("typing_stop", conversationId);
    this.socket.emit("typing.stop", { conversationId });
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

  // Utility methods
  // Get socket connection status
  isSocketConnected(): boolean {
    return this.isConnected && !!this.socket;
  }

  // Get detailed connection info
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

  // Get socket instance (for advanced usage)
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

      // Emit a test event
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

  // Test all events
}

// Export singleton instance
export const socketManager = new SocketManager();

// Legacy export for backward compatibility
export const socket = socketManager.getSocket();
