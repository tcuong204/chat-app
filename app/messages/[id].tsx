import { getConversationDetails } from "@/api/conversationApi";
import {
  getConversationMessages,
  GetMessagesResponse,
  Message,
  sendMessage,
} from "@/api/messageApi";
import { uploadFile } from "@/api/uploadFile";
import { images } from "@/constants/images";
import { showError, showSuccess } from "@/utils/customToast";
import { getAccount } from "@/utils/secureStore";
import { socketManager } from "@/utils/socket";
import AntDesign from "@expo/vector-icons/AntDesign";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
export interface ConversationParticipant {
  userId?: string;
  role: "admin" | "member";
  joinedAt: string;
  lastSeenAt: string;
}
interface NewMessagePayload {
  messageId: string;
  conversationId: string;
  content?: string;
  messageType?: string;
  senderId: string;
  senderName?: string;
  timestamp?: number;
  filesInfo?: any[];
  fileInfo?: any; // fallback cho server cũ
}
const replaceLocalhost = (url: string) => {
  return url.replace("localhost:3000", "192.168.0.102:3000");
};
const AuthenticatedImage = ({
  imageUrl,
  token,
}: {
  imageUrl: string;
  token: string | null;
}) => {
  const processedUrl = replaceLocalhost(imageUrl);

  return (
    <Image
      source={{
        uri: processedUrl,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }}
      style={{ width: 200, height: 200 }}
    />
  );
};
interface LastMessageUpdatePayload {
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
}

export interface ConversationPermissions {
  canSendMessages: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canEditGroup: boolean;
  canDeleteGroup: boolean;
}

export interface ConversationSettings {
  allowMemberInvite: boolean;
  allowMemberLeave: boolean;
  requireAdminApproval: boolean;
  maxParticipants: number;
  isPublic: boolean;
}

export interface ConversationStatus {
  isActive: boolean;
  isArchived: boolean;
  isPinned: boolean;
}

export interface DirectConversation {
  id: string;
  type: "direct";
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  createdBy: string;
  isActive: boolean;
  participants: ConversationParticipant[];
  permissions: ConversationPermissions & { isAdmin: boolean };
  settings: ConversationSettings;
  status: ConversationStatus;
}
const MessageScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [conversations, setConversations] = useState<DirectConversation | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const inputAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const [message, setMessage] = useState("");
  const params = useLocalSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const conversationId = params.id as string;

  // Optimistic UI: Store local messages before server confirmation
  const [localMessages, setLocalMessages] = useState<{
    [key: string]: Message;
  }>({});

  const handleFocus = () => {
    setInputFocused(true);
    Animated.timing(inputAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const handleBlur = () => {
    setInputFocused(false);
    Animated.timing(inputAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const inputTranslate = inputAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  // Load conversation details
  const getConversations = async () => {
    try {
      const response = await getConversationDetails(conversationId);
      setConversations(response || null);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  // Load messages
  const loadMessages = async () => {
    try {
      setLoading(true);
      const response: GetMessagesResponse = await getConversationMessages(
        conversationId,
        1,
        50
      );
      console.log("📨 API Response:", response);

      // API trả về { messages: [...], pagination: {...} }
      const messageList = response.messages || [];
      console.log("📝 Messages loaded:", messageList.length);

      setMessages(messageList.reverse()); // Reverse to show newest at bottom
      console.log(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      showError("Không thể tải tin nhắn");
    } finally {
      setLoading(false);
    }
  };
  const handleNewMessage = useCallback(
    (newMessage: Message) => {
      if (!newMessage) {
        console.error("❌ No message data received");
        return;
      }
      if (newMessage.conversationId !== conversationId) {
        console.log(
          `⚠️ Message ignored, wrong conversation: ${newMessage.conversationId} vs ${conversationId}`
        );
        return;
      }
      console.log("🎯 Processing new message:", newMessage);

      setMessages((prev) => {
        // Check duplicate by ID or localId
        const exists = prev.some(
          (msg) =>
            msg.id === newMessage.id ||
            (newMessage.localId && msg.localId === newMessage.localId)
        );
        if (exists) {
          console.log("⚠️ Message already exists");
          return prev;
        }

        console.log("➕ Adding message to list");
        return [...prev, newMessage];
      });

      // Remove from localMessages if this is a message we just sent
      setLocalMessages((prev) => {
        const newLocal = { ...prev };
        // Find and remove local message
        Object.keys(newLocal).forEach((localId) => {
          const localMsg = newLocal[localId];
          if (
            localMsg.content === newMessage.content &&
            localMsg.conversationId === newMessage.conversationId &&
            (localMsg.localId === newMessage.localId ||
              localMsg.id === newMessage.id)
          ) {
            console.log("🔄 Removing local message:", localId);
            delete newLocal[localId];
          }
        });
        return newLocal;
      });

      // Auto scroll
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [conversationId]
  );
  const handleAttachFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
        console.log("hvhhhhhf");

        await handleFileUpload(
          result.assets[0].uri,
          "file",
          result.assets[0].name
        );
      }
    } catch (error) {
      console.error("Error picking file:", error);
      showError("Không thể chọn tệp");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        showError("Cần cấp quyền truy cập camera");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        await handleFileUpload(result.assets[0].uri, "image");
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      showError("Không thể chụp ảnh");
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showError("Cần cấp quyền truy cập thư viện ảnh");
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        await handleFileUpload(result.assets[0].uri, "image");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      showError("Không thể chọn ảnh");
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        showError("Cần cấp quyền truy cập micro");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();
      setRecording(recording);
    } catch (error) {
      console.error("Error starting recording:", error);
      showError("Không thể bắt đầu ghi âm");
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        await handleFileUpload(uri, "audio");
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      showError("Không thể dừng ghi âm");
    }
  };

  const handleFileUpload = async (
    uri: string,
    type: "image" | "audio" | "file",
    fileName?: string
  ) => {
    try {
      setUploading(true);

      const response = await uploadFile(uri);
      console.log("file", response);

      // Prepare message data based on file type
      const messageData = {
        fileId: response.fileId,
        conversationId: conversationId,
        message: message,
        fileMetadata: {
          fileName: response.fileName,
          fileId: response.fileId,
          fileSize: response.fileSize,
          mimeType:
            response.mimeType == "document" ? "file" : response.mimeType,
          downloadUrl: response.downloadUrl,
          thumbnailUrl: response.thumbnailUrl,
          duration: response.duration,
          dimensions: response.dimensions,
        },
      };

      // Create optimistic message
      const optimisticMessage: Message = {
        id: `local_${Date.now()}`,
        localId: `local_${Date.now()}`,
        conversationId,
        senderId: currentUserId || "current_user",
        sender: {
          id: currentUserId || "current_user",
          fullName: "Bạn",
          username: currentUserId || "current_user",
          avatarUrl: null,
          isOnline: true,
          lastSeen: new Date().toISOString(),
        },
        content: (response.fileName as string) || "Tệp đính kèm",
        type: type,
        attachments: [
          // Đảm bảo có mảng attachments
          {
            fileId: response.fileId,
            fileName: response.fileName, // Sử dụng tên file thực tế
            fileSize: response.fileSize,
            mimeType: response.mimeType,
            downloadUrl: response.downloadUrl,
          },
        ],
        status: "sent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Send via socket
      if (socketManager.isSocketConnected()) {
        socketManager.quickShareFile(messageData);
        console.log("gui thang cong", messageData);
        // Update optimistic message status to sent
        // setLocalMessages((prev) => ({
        //   ...prev,
        //   [optimisticMessage.localId!]: {
        //     ...prev[optimisticMessage.localId!],
        //     status: "sent",
        //   },
        // }));
        // handleNewMessage(optimisticMessage);
      } else {
        // Fallback to REST API
        await sendMessage(messageData);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      showError("Không thể tải lên tệp");
    } finally {
      setUploading(false);
    }
  };
  // Send message with socket-first approach and API fallback
  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    const messageText = message.trim();
    console.log("🚀 Starting to send message:", messageText);
    setMessage("");

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      senderId: currentUserId || "current_user", // Will be replaced by server
      sender: {
        id: currentUserId || "current_user",
        fullName: "Bạn",
        username: currentUserId || "current_user",
        avatarUrl: null,
        isOnline: true,
        lastSeen: new Date().toISOString(),
      },
      content: messageText,
      type: "text",
      status: "sent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    console.log("📝 Created optimistic message:", optimisticMessage);

    // Add to local messages for optimistic UI
    setLocalMessages((prev) => ({
      ...prev,
      [optimisticMessage.localId!]: optimisticMessage,
    }));

    // Add optimistic message to UI immediately
    handleNewMessage(optimisticMessage);

    try {
      setSending(true);
      console.log("⏳ Setting sending state to true");

      let messageSent = false;

      // Try Socket.IO first (real-time)
      if (socketManager.isSocketConnected()) {
        console.log("✅ Socket is connected, sending via Socket.IO...");
        try {
          socketManager.sendMessage({
            conversationId,
            content: messageText,
            type: "text",
            timestamp: Date.now(),
            localId: optimisticMessage.localId,
          });

          // Update optimistic message status to sent
          setLocalMessages((prev) => ({
            ...prev,
            [optimisticMessage.localId!]: {
              ...prev[optimisticMessage.localId!],
              status: "sent",
            },
          }));

          messageSent = true;
          console.log("✅ Message sent via Socket.IO");
        } catch (socketError) {
          console.error("❌ Socket.IO failed:", socketError);
        }
      } else {
        console.log("❌ Socket not connected, trying to connect...");
        try {
          await socketManager.connect();
          await new Promise((resolve) => setTimeout(resolve, 1000));

          if (socketManager.isSocketConnected()) {
            console.log("✅ Socket connected, sending via Socket.IO...");
            socketManager.sendMessage({
              conversationId,
              content: messageText,
              type: "text",
              timestamp: Date.now(),
              localId: optimisticMessage.localId,
            });

            setLocalMessages((prev) => ({
              ...prev,
              [optimisticMessage.localId!]: {
                ...prev[optimisticMessage.localId!],
                status: "sent",
              },
            }));

            messageSent = true;
            console.log("✅ Message sent via Socket.IO after reconnection");
          }
        } catch (connectError) {
          console.error("❌ Socket connection failed:", connectError);
        }
      }

      // Fallback to REST API if socket failed
      if (!messageSent) {
        console.log("🔄 Socket failed, falling back to REST API...");
        try {
          const serverMessage = await sendMessage({
            conversationId,
            content: messageText,
            type: "text",
          });

          // Update optimistic message with server response
          setLocalMessages((prev) => ({
            ...prev,
            [optimisticMessage.localId!]: {
              ...prev[optimisticMessage.localId!],
              id: serverMessage.id,
              status: "sent",
            },
          }));

          messageSent = true;
          console.log("✅ Message sent via REST API");
          showSuccess("Tin nhắn đã gửi thành công (API)!");
        } catch (apiError) {
          console.error("❌ REST API failed:", apiError);
          throw apiError;
        }
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      showError("Không thể gửi tin nhắn. Vui lòng thử lại.");

      // Update optimistic message status to sent (keep it as sent even if failed)
      setLocalMessages((prev) => ({
        ...prev,
        [optimisticMessage.localId!]: {
          ...prev[optimisticMessage.localId!],
          status: "sent",
        },
      }));
    } finally {
      console.log("🏁 Setting sending state to false");
      setSending(false);
    }
  };

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    socketManager.startTyping(conversationId);
  }, [conversationId]);

  const handleTypingStop = useCallback(() => {
    socketManager.stopTyping(conversationId);
  }, [conversationId]);
  // Socket event handlers
  useEffect(() => {
    socketManager.connect().then(() => {
      socketManager.joinConversation(conversationId);
    });

    // Listen for new file shared events
    const handleFileShared = (data: any) => {
      console.log("📎 File shared event received:", data);
      if (data.conversationId === conversationId) {
        // Convert to message format
        const fileMessage: Message = {
          id: data.fileId || data.messageId, // Sử dụng messageId nếu có
          conversationId: data.conversationId,
          senderId: data.sharedBy || currentUserId,
          sender: {
            id: data.sharedBy || currentUserId,
            fullName: "User",
            username: data.sharedBy || currentUserId,
            avatarUrl: null,
            isOnline: true,
            lastSeen: new Date().toISOString(),
          },
          content: data.fileName || "Tệp đính kèm",
          type: data.type || "file", // Có thể lấy từ data nếu server gửi
          attachments: [
            {
              fileId: data.fileId,
              fileName: data.fileName,
              fileSize: data.fileSize || 0,
              mimeType: data.mimeType || "",
              downloadUrl: data.downloadUrl || "",
              thumbnailUrl: data.thumbnailUrl || undefined,
            },
          ],
          status: "sent",
          createdAt: new Date(data.timestamp || Date.now()).toISOString(),
          updatedAt: new Date(data.timestamp || Date.now()).toISOString(),
        };
        setLocalMessages((prev) => ({
          ...prev,
          [fileMessage.localId!]: {
            ...prev[fileMessage.localId!],
            status: "sent",
          },
        }));
        handleNewMessage(fileMessage);
      }
    };

    const handleBatchFilesShared = (data: any) => {
      console.log("📎 Batch files shared event received:", data);
      if (data.conversationId === conversationId) {
        data.files.forEach((file: any) => {
          const fileMessage: Message = {
            id: file.fileId,
            conversationId: data.conversationId,
            senderId: data.sharedBy,
            sender: {
              id: data.sharedBy,
              fullName: "User",
              username: data.sharedBy,
              avatarUrl: null,
              isOnline: true,
              lastSeen: new Date().toISOString(),
            },
            content: file.fileName,
            type: "file",
            attachments: [
              {
                fileId: file.fileId,
                fileName: file.fileName,
                fileSize: file.fileSize,
                mimeType: file.fileType,
                downloadUrl: "",
              },
            ],
            status: "sent",
            createdAt: new Date(data.timestamp).toISOString(),
            updatedAt: new Date(data.timestamp).toISOString(),
          };

          handleNewMessage(fileMessage);
        });
      }
    };
    // Listen for typing indicators
    const handleTyping = (data: any) => {
      if (data.conversationId === conversationId) {
        if (data.type === "started") {
          setTypingUsers((prev) => [...prev, data.userName]);
        } else if (data.type === "stopped") {
          setTypingUsers((prev) =>
            prev.filter((user) => user !== data.userName)
          );
        }
      }
    };

    // Listen for message status updates
    const handleStatusUpdate = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId ? { ...msg, status: data.status } : msg
          )
        );
      }
    };

    // Listen for new messages from socket
    const handleSocketNewMessage = (data: any) => {
      console.log("📨 New message received from socket:", data);
      if (data.conversationId === conversationId) {
        // Convert socket message to Message format
        const socketMessage: Message = {
          id: data.id,
          localId: data.localId,
          conversationId: data.conversationId,
          senderId: data.senderId,
          sender: {
            id: data.senderId,
            fullName: data.senderName || "Unknown",
            username: data.senderId,
            avatarUrl: null,
            isOnline: true,
            lastSeen: new Date().toISOString(),
          },
          content: data.content,
          type: data.messageType || "text",
          // Thêm attachments nếu có từ socket data
          attachments:
            data.filesInfo || data.fileInfo
              ? [
                  {
                    fileId:
                      data.filesInfo?.[0]?.fileId || data.fileInfo?.fileId,
                    fileName:
                      data.filesInfo?.[0]?.fileName || data.fileInfo?.fileName,
                    fileSize:
                      data.filesInfo?.[0]?.fileSize || data.fileInfo?.fileSize,
                    mimeType:
                      data.filesInfo?.[0]?.mimeType || data.fileInfo?.mimeType,
                    downloadUrl:
                      data.filesInfo?.[0]?.downloadUrl ||
                      data.fileInfo?.downloadUrl,
                    thumbnailUrl:
                      data.filesInfo?.[0]?.thumbnailUrl ||
                      data.fileInfo?.thumbnailUrl,
                  },
                ]
              : undefined,
          status: "sent",
          createdAt: new Date(data.timestamp || Date.now()).toISOString(),
          updatedAt: new Date(data.timestamp || Date.now()).toISOString(),
        };

        handleNewMessage(socketMessage);
      }
    };

    // Listen for last message updates from socket
    const handleLastMessageUpdate = (data: LastMessageUpdatePayload) => {
      console.log("📨 Last message update received:", data);
      if (data.conversationId === conversationId) {
        setLastMessage(data.lastMessage);
        setUnreadCount(data.unreadCount);
        console.log("✅ Updated last message from socket:", data.lastMessage);
      }
    };

    // Listen for last messages response from server
    const handleLastMessagesResponse = (data: {
      updates: LastMessageUpdatePayload[];
    }) => {
      console.log("📨 Last messages response received:", data);
      const conversationUpdate = data.updates.find(
        (update) => update.conversationId === conversationId
      );
      if (conversationUpdate) {
        setLastMessage(conversationUpdate.lastMessage);
        setUnreadCount(conversationUpdate.unreadCount);
        console.log(
          "✅ Updated last message from server response:",
          conversationUpdate.lastMessage
        );
      }
    };

    // Add event listeners
    socketManager.onMessage(handleNewMessage);
    socketManager.onTyping(handleTyping);
    socketManager.onStatusUpdate(handleStatusUpdate);
    // socketManager.onFileEvent(handleFileShared);
    socketManager.getSocket()?.on("quick_file_shared", handleFileShared);
    socketManager.getSocket()?.on("batch_files_shared", handleBatchFilesShared);
    // Listen for new messages from socket
    socketManager.getSocket()?.on("new_message", handleSocketNewMessage);

    // Listen for last message updates
    socketManager
      .getSocket()
      ?.on("conversation_last_message_update", handleLastMessageUpdate);
    socketManager
      .getSocket()
      ?.on("conversations_last_messages_response", handleLastMessagesResponse);

    // Load initial data
    getConversations();
    loadMessages();

    // Get current user ID
    const getCurrentUser = async () => {
      try {
        const account = await getAccount();
        if (account && (account as any).user?.id) {
          setCurrentUserId((account as any).user.id);
          console.log("Current user ID:", (account as any).user.id);
        }
      } catch (error) {
        console.error("Error getting current user:", error);
      }
    };
    getCurrentUser();

    // Request last message from server
    if (socketManager.isSocketConnected()) {
      socketManager.requestLastMessages([conversationId]);
    }

    // Cleanup
    return () => {
      socketManager.offFileEvent(handleFileShared);
      socketManager.getSocket()?.off("quick_file_shared", handleFileShared);
      socketManager
        .getSocket()
        ?.off("batch_files_shared", handleBatchFilesShared);
      socketManager.getSocket()?.off("new_file_message");
      socketManager.leaveConversation(conversationId);
      socketManager.offMessage(handleNewMessage);
      socketManager.offTyping(handleTyping);
      socketManager.offStatusUpdate(handleStatusUpdate);
      socketManager.getSocket()?.off("new_message", handleSocketNewMessage);
      socketManager
        .getSocket()
        ?.off("conversation_last_message_update", handleLastMessageUpdate);
      socketManager
        .getSocket()
        ?.off(
          "conversations_last_messages_response",
          handleLastMessagesResponse
        );
    };
  }, [conversationId]);

  // Handle message input changes for typing indicators
  useEffect(() => {
    let typingTimer: ReturnType<typeof setTimeout>;

    if (message.length > 0) {
      handleTypingStart();
      typingTimer = setTimeout(() => {
        handleTypingStop();
      }, 2000);
    } else {
      handleTypingStop();
    }

    return () => {
      if (typingTimer) {
        clearTimeout(typingTimer);
      }
    };
  }, [message, handleTypingStart, handleTypingStop]);
  useEffect(() => {
    const getToken = async () => {
      try {
        const storedToken = await getAccount();
        console.log("🔑 Getting token from storage:", storedToken);
        if (storedToken && (storedToken as any).accessToken) {
          const accessToken = (storedToken as any).accessToken;
          console.log(
            "✅ Access token found:",
            accessToken.substring(0, 20) + "..."
          );
          setToken(accessToken);
        } else {
          console.error("❌ No access token found in storage");
        }
      } catch (error) {
        console.error("❌ Error getting token:", error);
      }
    };
    getToken();
  }, []);
  // Mark messages as read when conversation is viewed
  useEffect(() => {
    if (messages.length > 0 && socketManager.isSocketConnected()) {
      const unreadMessages = messages.filter(
        (msg) => msg.senderId !== currentUserId && msg.status !== "read"
      );

      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map((msg) => msg.id);
        socketManager.markMessagesAsRead(
          conversationId,
          messageIds,
          currentUserId || "current_user"
        );

        // Update local message status
        setMessages((prev) =>
          prev.map((msg) =>
            messageIds.includes(msg.id) ? { ...msg, status: "read" } : msg
          )
        );

        // Reset unread count
        setUnreadCount(0);
      }
    }
  }, [messages, conversationId, currentUserId]);

  // Clear unread count when entering conversation
  useEffect(() => {
    if (unreadCount > 0 && socketManager.isSocketConnected()) {
      // Clear unread count when user enters the conversation
      setUnreadCount(0);
    }
  }, [conversationId]);

  // Render message item
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // Check if message has attachments
    const hasAttachments =
      Array.isArray(item.attachments) && item.attachments.length > 0
        ? true
        : item.fileInfo && item.fileInfo.length > 0
        ? true
        : false;
    const attachment =
      (item.attachments && item.attachments[0]) ||
      (item.fileInfo && item.fileInfo[0]); // Lấy attachment đầu tiên nếu có
    const previousMessage = messages[index - 1]; // lấy tin nhắn trước đó
    const isOwnMessage = currentUserId
      ? item.senderId === currentUserId
      : false;

    // Xử lý thời gian
    const shouldShowTimestamp = (() => {
      if (!previousMessage) return true;
      const current = new Date(item.createdAt).getTime();
      const previous = new Date(previousMessage.createdAt).getTime();
      const diffInMs = current - previous;
      return diffInMs > 60 * 60 * 1000; // > 1 giờ
    })();

    const formatTimestamp = () => {
      const createdAt = new Date(item.createdAt);
      const now = new Date();
      const diffInMs = now.getTime() - createdAt.getTime();

      if (diffInMs > 24 * 60 * 60 * 1000) {
        // Nếu > 1 ngày → hiển thị ngày tháng
        return createdAt.toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        // Nếu trong 24h → chỉ hiển thị giờ phút
        return createdAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    };
    const renderMessageContent = () => {
      // Ưu tiên hiển thị file attachment nếu có
      console.log("111", hasAttachments);

      if (item.type === "text" || item.messageType === "text") {
        // Chỉ hiển thị text thuần túy khi không có attachment
        return (
          <Text className={`font-nunito ${isOwnMessage ? "text-white" : ""}`}>
            {item.content}
          </Text>
        );
      } else if (hasAttachments) {
        // Render file attachment
        const isImage = attachment?.mimeType?.startsWith("image/");
        const isAudio = attachment?.mimeType?.startsWith("audio/");
        console.log("222", isImage);

        return (
          <View className="flex space-y-2">
            {isImage && attachment?.downloadUrl ? (
              <AuthenticatedImage
                imageUrl={attachment.downloadUrl}
                token={token}
              />
            ) : (
              <View className="flex flex-row items-center space-x-2 p-2 bg-white/20 rounded-lg">
                <View className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  {isAudio ? (
                    <FontAwesome name="music" size={16} color="white" />
                  ) : (
                    <AntDesign name="file1" size={16} color="white" />
                  )}
                </View>
                <View className="">
                  <Text
                    className={`font-medium text-sm p-2 ${
                      isOwnMessage ? "text-white" : "text-gray-800"
                    }`}
                  >
                    {attachment?.fileName || "Tệp đính kèm"}
                  </Text>
                  <Text
                    className={`text-xs opacity-70 ${
                      isOwnMessage ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {attachment?.fileSize
                      ? `${(attachment.fileSize / 1024 / 1024).toFixed(2)} MB`
                      : "File"}
                  </Text>
                </View>
              </View>
            )}
            {/* Hiển thị text kèm theo nếu có */}
            {item.content && item.content !== attachment?.fileName && (
              <Text
                className={`font-nunito text-sm ${
                  isOwnMessage ? "text-white" : ""
                }`}
              >
                {item.content}
              </Text>
            )}
          </View>
        );
      } else {
        // Fallback for non-text messages without attachments
        return (
          <View className="flex flex-row items-center space-x-2">
            <View className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <AntDesign name="file1" size={16} color="white" />
            </View>
            <View>
              <Text
                className={`font-medium ${isOwnMessage ? "text-white" : ""}`}
              >
                {item.content}
              </Text>
              <Text
                className={`text-xs opacity-70 ${
                  isOwnMessage ? "text-white" : ""
                }`}
              >
                {item.type === "image"
                  ? "Hình ảnh"
                  : item.type === "audio"
                  ? "Tệp âm thanh"
                  : "Tệp đính kèm"}
              </Text>
            </View>
          </View>
        );
      }
    };

    return (
      <>
        {shouldShowTimestamp && (
          <View className="items-center my-2">
            <Text className="text-xs text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
              {formatTimestamp()}
            </Text>
          </View>
        )}

        <View
          className={`mb-1 ${isOwnMessage ? "items-end" : "items-start"} flex`}
        >
          {isOwnMessage ? (
            <LinearGradient
              colors={["#f9c0e4", "#6e00ff"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ borderRadius: 16, maxWidth: "90%" }}
              className="max-w-xs"
            >
              <View className="px-4 py-3">{renderMessageContent()}</View>
            </LinearGradient>
          ) : (
            <View className="max-w-xs px-4 py-3 rounded-2xl bg-gray-100 rounded-bl-md">
              {renderMessageContent()}
            </View>
          )}
          {(!messages[index + 1] ||
            messages[index + 1].senderId !== item.senderId) && (
            <View className="flex flex-row items-center mt-1 space-x-2">
              <Text className="text-xs text-gray-500">
                {new Date(item.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {isOwnMessage && (
                <View className="flex flex-row items-center">
                  {item.status === "sent" && (
                    <Text className="text-xs text-gray-400">Đang gửi...</Text>
                  )}
                  {item.status === "sent" && (
                    <AntDesign name="check" size={12} color="#10b981" />
                  )}
                  {item.status === "delivered" && (
                    <View className="flex flex-row">
                      <AntDesign name="check" size={12} color="#10b981" />
                      <AntDesign
                        name="check"
                        size={12}
                        color="#10b981"
                        style={{ marginLeft: -4 }}
                      />
                    </View>
                  )}
                  {item.status === "read" && (
                    <View className="flex flex-row">
                      <AntDesign name="check" size={12} color="#3b82f6" />
                      <AntDesign
                        name="check"
                        size={12}
                        color="#3b82f6"
                        style={{ marginLeft: -4 }}
                      />
                    </View>
                  )}
                  {/* {item.status === "failed" && (
              <AntDesign name="exclamationcircle" size={12} color="#ef4444" />
            )} */}
                </View>
              )}
            </View>
          )}
        </View>
      </>
    );
  };
  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-gray-50">
          <Stack.Screen options={{ headerShown: false }} />

          {/* Header */}
          <View className="bg-transparent px-6 py-4">
            <View className="flex flex-row justify-between items-center">
              <View className="flex flex-row items-center">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="mr-4"
                >
                  <AntDesign
                    name="arrowleft"
                    size={24}
                    color="#a855f7"
                    className="p-4"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex flex-row"
                  onPress={() =>
                    conversations &&
                    router.push({
                      pathname: "/messages/management/[id]",
                      params: { id: String(conversations.id) },
                    })
                  }
                >
                  <Image
                    source={
                      typeof conversations?.avatarUrl === "string"
                        ? { uri: conversations.avatarUrl }
                        : images.defaultAvatar
                    }
                    className="w-10 h-10 rounded-full mr-3"
                  />
                  <View>
                    <View className="flex-row items-center">
                      <Text className="font-bold font-manrope">
                        {conversations?.name}
                      </Text>
                      {unreadCount > 0 && (
                        <Text className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {unreadCount}
                        </Text>
                      )}
                    </View>
                    <Text className="text-sm font-nunito">
                      {socketManager.isSocketConnected()
                        ? "🟢 Online (Real-time)"
                        : "🔴 Offline (API only)"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View className="flex flex-row space-x-2">
                {/* Debug button */}
                <TouchableOpacity className="p-2 bg-white/20 rounded-full">
                  <FontAwesome name="phone" size={24} color="#a855f7" />
                </TouchableOpacity>
                <TouchableOpacity className="p-2 bg-white/20 rounded-full">
                  <FontAwesome6 name="video" size={24} color="#a855f7" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            className="flex-1 p-4 bg-white"
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            ref={flatListRef}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onScrollBeginDrag={() => {
              // Mark messages as read when user starts scrolling
              if (messages.length > 0 && socketManager.isSocketConnected()) {
                const unreadMessages = messages.filter(
                  (msg) =>
                    msg.senderId !== currentUserId && msg.status !== "read"
                );

                if (unreadMessages.length > 0) {
                  const messageIds = unreadMessages.map((msg) => msg.id);
                  socketManager.markMessagesAsRead(
                    conversationId,
                    messageIds,
                    currentUserId || "current_user"
                  );

                  // Update local message status
                  setMessages((prev) =>
                    prev.map((msg) =>
                      messageIds.includes(msg.id)
                        ? { ...msg, status: "read" }
                        : msg
                    )
                  );

                  // Reset unread count
                  setUnreadCount(0);
                }
              }
            }}
            showsVerticalScrollIndicator={false}
          />

          {/* Input */}
          <View className="bg-white px-2 pt-3 border-t border-gray-200">
            <View className="flex flex-row items-center space-x-3">
              <View className="flex-row items-center px-4 bg-white">
                {!inputFocused ? (
                  <View className="flex flex-row justify-between items-center">
                    <TouchableOpacity
                      className="mr-3"
                      onPress={handleAttachFile}
                    >
                      <AntDesign name="paperclip" size={24} color="#a855f7" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="mx-3"
                      onPress={handleTakePhoto}
                    >
                      <AntDesign name="camera" size={24} color="#a855f7" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="mx-3"
                      onPress={handlePickImage}
                    >
                      <AntDesign name="picture" size={24} color="#a855f7" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="mx-3"
                      onPress={recording ? stopRecording : startRecording}
                    >
                      <FontAwesome
                        name="microphone"
                        size={24}
                        color={recording ? "#ff0000" : "#a855f7"}
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="mr-4 flex items-center"
                    onPress={() => {
                      if (inputRef.current) inputRef.current.blur();
                    }}
                  >
                    <AntDesign name="left" size={24} color="#a855f7" />
                  </TouchableOpacity>
                )}

                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ translateX: inputTranslate }],
                  }}
                >
                  <View className="bg-gray-100 rounded-full flex-1 flex-row items-center">
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Aa"
                      className="flex-1 text-gray-800 font-medium w-full px-4"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      style={{ flex: 1 }}
                      ref={inputRef}
                      multiline
                      maxLength={1000}
                    />
                    {message.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setMessage("")}
                        className="p-2"
                      >
                        <AntDesign name="close" size={18} color="#888" />
                      </TouchableOpacity>
                    )}
                  </View>
                </Animated.View>

                <TouchableOpacity
                  onPress={handleSendMessage}
                  disabled={!message.trim() || sending}
                  className={`ml-3 p-2 rounded-full ${
                    message.trim() && !sending ? "bg-primary" : "bg-gray-300"
                  }`}
                >
                  <Feather
                    name="send"
                    size={20}
                    color={message.trim() && !sending ? "white" : "#888"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default MessageScreen;
