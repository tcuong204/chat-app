import { getConversationDetails } from "@/api/conversationApi";
import {
  getConversationMessages,
  GetMessagesResponse,
  Message,
  sendMessage,
} from "@/api/messageApi";
import { uploadFile } from "@/api/uploadFile";
import AudioPlayer from "@/components/audioPlayer";
import { images } from "@/constants/images";
import { LOCALIP } from "@/constants/localIp";
import { default as TypingDots } from "@/utils/AnimatedTypingDots";
import AuthenticatedMediaViewer from "@/utils/authenticatedImage";
import { showError, showSuccess } from "@/utils/customToast";
import { openOfficeFile } from "@/utils/openOfficeFile";
import { getAccount } from "@/utils/secureStore";
import { socketManager } from "@/utils/socket";
import { voiceCallService } from "@/utils/voiceCallService";
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
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
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
  type: "direct" | "group";
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);

  const inputAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  type TypingItem = { id: string; kind: "typing" };
  type ChatItem = Message | TypingItem;
  const flatListRef = useRef<FlatList<ChatItem>>(null);
  const [message, setMessage] = useState("");
  const params = useLocalSearchParams();
  const conversationId = params.id as string;
  const getPeerUserId = useCallback(() => {
    if (!conversations || !currentUserId) return null;
    const peer = conversations.participants.find(
      (p) => p.userId && p.userId !== currentUserId
    );
    return peer?.userId || null;
  }, [conversations, currentUserId]);

  const getPeerUserName = useCallback(() => {
    if (!conversations || !currentUserId) return null;
    const peer = conversations.participants.find(
      (p) => p.userId && p.userId !== currentUserId
    );
    // Try to get name from conversation or use a default
    return conversations.name || "Người dùng";
  }, [conversations, currentUserId]);

  const ensureVoiceSocketConnected = useCallback(async () => {
    const account = await getAccount();
    const token = (account as any)?.accessToken;
    const uid = (account as any)?.user?.id;
    if (!token || !uid) throw new Error("Missing auth");
    if (!voiceCallService.isConnected) {
      await voiceCallService.connect(`https://${LOCALIP}`, uid, token);
    }
  }, []);

  const handleStartVoiceCall = useCallback(async () => {
    try {
      const peerUserId = getPeerUserId();
      if (!peerUserId) return;
      setCallConnecting(true);
      await ensureVoiceSocketConnected();

      // Navigate to voice call interface
      router.push({
        pathname: "/voice-call",
        params: {
          targetUserId: peerUserId,
          targetUserName: getPeerUserName() || "Người dùng",
          isIncoming: "false",
        },
      });
    } catch (e) {
      console.log("Start voice call error", e);
    } finally {
      setCallConnecting(false);
    }
  }, [
    getPeerUserId,
    ensureVoiceSocketConnected,
    conversationId,
    getPeerUserName,
  ]);

  const handleStartVideoCall = useCallback(async () => {
    try {
      const peerUserId = getPeerUserId();
      if (!peerUserId) {
        console.error("No peer user found for video call");
        Alert.alert("Error", "Could not find user to call");
        return;
      }

      setCallConnecting(true);
      console.log("Starting video call with peer:", peerUserId);

      // Ensure voice socket is connected first
      await ensureVoiceSocketConnected();

      // Check WebRTC status
      const webrtcStatus = voiceCallService.getWebRTCStatus();
      console.log("WebRTC Status before call:", webrtcStatus);

      // Request permissions first
      const permissions = await voiceCallService.checkCameraPermissions();
      if (
        permissions.camera !== "granted" ||
        permissions.microphone !== "granted"
      ) {
        const granted = await voiceCallService.requestMediaPermissions(true);
        if (!granted) {
          Alert.alert(
            "Error",
            "Camera and microphone permissions are required for video calls"
          );
          return;
        }
      }

      // Navigate to call screen first
      const peerName = getPeerUserName();
      router.push({
        pathname: "/voice-call",
        params: {
          targetUserId: peerUserId,
          targetUserName: peerName || "Người dùng",
          isIncoming: "false",
          callType: "video", // Add flag to indicate video call
        },
      });
    } catch (error) {
      console.error("Video call error:", error);
      Alert.alert("Error", "Could not start video call. Please try again.");
    } finally {
      setCallConnecting(false);
    }
  }, [
    getPeerUserId,
    ensureVoiceSocketConnected,
    conversationId,
    getPeerUserName,
  ]);
  // Optimistic UI: Store local messages before server confirmation
  const [localMessages, setLocalMessages] = useState<{
    [key: string]: Message;
  }>({});
  console.log("messsages", messages);
  const [typingUsers, setTypingUsers] = useState<
    Array<{ userId: string; userName: string }>
  >([]);
  const lastTypingEventRef = useRef<number>(0);
  const [isCurrentUserTyping, setIsCurrentUserTyping] = useState(false);

  const [readReceipts, setReadReceipts] = useState<{
    [messageId: string]: {
      [userId: string]: {
        readAt: number;
        userName?: string;
      };
    };
  }>({});
  const handleReadReceipts = useCallback(
    (data: {
      messageIds: string[];
      userId: string;
      readAt: number;
      conversationId: string;
    }) => {
      if (
        data.conversationId !== conversationId ||
        data.userId === currentUserId
      ) {
        return; // Không xử lý read receipt của chính mình
      }

      console.log("📖 Received read receipts:", data);

      setReadReceipts((prev) => {
        const updated = { ...prev };

        data.messageIds.forEach((messageId) => {
          if (!updated[messageId]) {
            updated[messageId] = {};
          }
          updated[messageId][data.userId] = {
            readAt: data.readAt,
            userName: "User", // Có thể lấy từ conversation participants
          };
        });

        return updated;
      });

      // Cập nhật status của messages
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (
            data.messageIds.includes(msg.id) &&
            msg.senderId === currentUserId
          ) {
            return { ...msg, status: "read" };
          }
          return msg;
        })
      );
    },
    [conversationId, currentUserId]
  );

  // 3. Thêm function xử lý single message read
  const handleSingleMessageRead = useCallback(
    (data: {
      messageId: string;
      readBy: string;
      readAt: Date;
      deviceId: string;
    }) => {
      if (data.readBy === currentUserId) {
        return; // Không xử lý read receipt của chính mình
      }

      console.log("📖 Single message read:", data);

      setReadReceipts((prev) => ({
        ...prev,
        [data.messageId]: {
          ...prev[data.messageId],
          [data.readBy]: {
            readAt: new Date(data.readAt).getTime(),
            userName: "User",
          },
        },
      }));

      // Cập nhật status của message
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === data.messageId && msg.senderId === currentUserId) {
            return { ...msg, status: "read" };
          }
          return msg;
        })
      );
    },
    [currentUserId]
  );

  const getMessagesWithTyping = (): ChatItem[] => {
    const messagesWithTyping: ChatItem[] = [...messages];
    const othersTyping = typingUsers.some((u) => u.userId !== currentUserId);
    if (othersTyping) {
      messagesWithTyping.push({ id: "typing-indicator", kind: "typing" });
    }
    return messagesWithTyping;
  };
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
      // console.log("📨 API Response:", response);

      // API trả về { messages: [...], pagination: {...} }
      const messageList = response.messages || [];
      // console.log("📝 Messages loaded:", messageList.length);

      setMessages(messageList.reverse()); // Reverse to show newest at bottom
    } catch (error) {
      console.error("Error fetching messages:", error);
      showError("Không thể tải tin nhắn");
    } finally {
      setLoading(false);
    }
  };
  const handleNewMessage = useCallback(
    (newMessage: Message) => {
      if (!newMessage || newMessage.conversationId !== conversationId) return;

      console.log("🎯 Processing new message:", newMessage);

      setMessages((prev) => {
        const index = prev.findIndex(
          (msg) =>
            (newMessage.localId && msg.localId === newMessage.localId) ||
            msg.id === newMessage.id
        );

        if (index !== -1) {
          // 🔁 Cập nhật lại optimistic message bằng dữ liệu từ server
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            ...newMessage,
            status: "processed",
          };
          return updated;
        }

        // ➕ Thêm mới nếu không trùng
        return [...prev, newMessage];
      });

      // Xóa khỏi localMessages nếu đã xử lý xong
      setLocalMessages((prev) => {
        const newLocal = { ...prev };
        if (newMessage.localId && newLocal[newMessage.localId]) {
          delete newLocal[newMessage.localId];
        }
        return newLocal;
      });

      // Auto scroll xuống cuối
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
      console.log("[record] requesting mic permission");
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        showError("Cần cấp quyền truy cập micro");
        console.log("[record] permission denied");
        return;
      }

      console.log("[record] setting audio mode");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log("[record] preparing recording");
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      console.log("[record] starting...");
      await recording.startAsync();
      console.log("[record] started");
      setRecording(recording);
    } catch (error) {
      console.error("Error starting recording:", error);
      showError("Không thể bắt đầu ghi âm");
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      console.log("[record] stopping...");
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      console.log("Recording stopped, file URI:", uri);

      if (uri) {
        console.log("[record] uploading file");
        await handleFileUpload(uri, "audio");
        console.log("[record] upload done");
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
      console.log("[upload] response:", response);

      // Prepare message data based on file type
      const messageData = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileId: response.fileId,
        conversationId: conversationId,
        message: message,
        messageType: response.mimeType.startsWith("image/")
          ? "image"
          : response.mimeType.startsWith("audio/")
          ? "audio"
          : response.mimeType.startsWith("video/")
          ? "video"
          : "file", // ✅ fallback cho pdf, docx, zip...
        localId: `quickfile_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        fileMetadata: {
          fileName: response.fileName,
          fileId: response.fileId,
          fileSize: response.fileSize,
          mimeType: response.mimeType.startsWith("image/")
            ? "image"
            : response.mimeType.startsWith("audio/")
            ? "audio"
            : response.mimeType.startsWith("video/")
            ? "video"
            : "file", // ✅ fallback cho pdf, docx, zip...
          downloadUrl: response.downloadUrl,
          thumbnailUrl: response.thumbnailUrl,
          duration: response.duration,
          dimensions: response.dimensions,
        },
      };
      // Send via socket
      if (socketManager.isSocketConnected()) {
        socketManager.quickShareFile(messageData);
        console.log("gui thang cong", messageData);
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
  // Socket event handlers
  useEffect(() => {
    socketManager.connect().then(() => {
      socketManager.joinConversation(conversationId);
      socketManager.onMessage(handleNewMessage);
      // Immediately request last messages and typing users after socket connect
      socketManager.requestLastMessages([conversationId]);
      socketManager.getTypingUsers(conversationId);
    });

    const handleTypingUsers = (data: {
      conversationId: string;
      typingUsers: Array<{ userId: string; userName: string }>;
      timestamp: number;
    }) => {
      console.log("⌨️ Typing users response:", data);
      if (data.conversationId === conversationId) {
        setTypingUsers(data.typingUsers || []);
      }
    };
    const handleUserTyping = (data: {
      conversationId: string;
      userId: string;
      userName: string;
      isTyping: boolean;
      timestamp: number;
    }) => {
      console.log("⌨️ User typing event:", data);
      if (
        data.conversationId === conversationId &&
        data.userId !== currentUserId
      ) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            // Thêm user vào danh sách đang gõ nếu chưa có
            if (!prev.find((user) => user.userId === data.userId)) {
              return [
                ...prev,
                { userId: data.userId, userName: data.userName },
              ];
            }
            return prev;
          } else {
            // Xóa user khỏi danh sách đang gõ
            return prev.filter((user) => user.userId !== data.userId);
          }
        });
      }
    };
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
          content: data.fileInfo.fileName || "xzy",
          type: data.type || "file", // Có thể lấy từ data nếu server gửi
          attachments: [
            {
              fileId: data.fileId,
              fileName: data.fileName,
              fileSize: data.fileSize || 0,
              mimeType: data.mimeType || "",
              downloadUrl: data.fileInfo.downloadUrl || "",
              thumbnailUrl: data.fileInfo.thumbnailUrl || undefined,
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
        console.log("📎 Adding file shared message to chat:", fileMessage);
        handleNewMessage(fileMessage);
      }
    };

    // Listen for new file message from server (main event for file messages)
    const handleNewFileMessage = (data: any) => {
      console.log("📎 New file message received:", data);
      if (data.conversationId === conversationId) {
        // Check if this message already exists to prevent duplicates
        const messageExists = messages.some(
          (msg) => msg.localId === data.localId || msg.id === data.id
        );
        if (messageExists) {
          console.log("📎 File message already exists, skipping:", data.id);
          return;
        }

        // Convert to message format - use data from backend
        const fileMessage: Message = {
          id: data.id, // Use message ID from backend
          conversationId: data.conversationId,
          senderId: data.senderId,
          localId: data.localId,
          sender: {
            id: data.senderId,
            fullName: data.senderName || "User",
            username: data.senderId,
            avatarUrl: null,
            isOnline: true,
            lastSeen: new Date().toISOString(),
          },
          content: data.content,
          type: data.messageType || "file",
          attachments: data.fileInfo
            ? [
                {
                  fileId: data.fileInfo.id,
                  fileName: data.fileInfo.fileName,
                  fileSize: data.fileInfo.fileSize,
                  mimeType: data.fileInfo.mimeType,
                  downloadUrl: data.fileInfo.downloadUrl,
                  thumbnailUrl: data.fileInfo.thumbnailUrl,
                },
              ]
            : [],
          status: "sent",
          createdAt: new Date(data.timestamp).toISOString(),
          updatedAt: new Date(data.timestamp).toISOString(),
        };

        console.log("📎 Adding file message to chat:", fileMessage);
        handleNewMessage(fileMessage);
      }
    };

    // Listen for new batch files message from server
    const handleNewBatchFilesMessage = (data: any) => {
      console.log("📎 New batch files message received:", data);
      if (data.conversationId === conversationId) {
        // Check if this message already exists to prevent duplicates
        const messageExists = messages.some((msg) => msg.id === data.id);
        if (messageExists) {
          console.log(
            "📎 Batch files message already exists, skipping:",
            data.id
          );
          return;
        }

        // Convert to message format with multiple attachments
        const fileMessage: Message = {
          id: data.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          sender: {
            id: data.senderId,
            fullName: data.senderName || "User",
            username: data.senderId,
            avatarUrl: null,
            isOnline: true,
            lastSeen: new Date().toISOString(),
          },
          content: data.content || "Nhiều tệp đính kèm",
          type: data.messageType || "file",
          attachments: data.filesInfo
            ? data.filesInfo.map((fileInfo: any) => ({
                fileId: fileInfo.id,
                fileName: fileInfo.fileName,
                fileSize: fileInfo.fileSize,
                mimeType: fileInfo.mimeType,
                downloadUrl: fileInfo.downloadUrl,
                thumbnailUrl: fileInfo.thumbnailUrl,
              }))
            : [],
          status: "sent",
          createdAt: new Date(data.timestamp).toISOString(),
          updatedAt: new Date(data.timestamp).toISOString(),
        };

        console.log("📎 Adding batch files message to chat:", fileMessage);
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
      console.log("⌨️ Legacy typing event:", data);
      if (data.conversationId === conversationId) {
        if (data.type === "started" && data.userId !== currentUserId) {
          setTypingUsers((prev) => {
            if (!prev.find((user) => user.userId === data.userId)) {
              return [
                ...prev,
                { userId: data.userId, userName: data.userName },
              ];
            }
            return prev;
          });
        } else if (data.type === "stopped") {
          setTypingUsers((prev) =>
            prev.filter((user) => user.userId !== data.userId)
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
    socketManager.getSocket()?.on("typing_users_response", handleTypingUsers);
    socketManager.getSocket()?.on("user_typing", handleUserTyping);
    socketManager.onTyping(handleTyping);
    socketManager.onStatusUpdate(handleStatusUpdate);
    socketManager.getSocket()?.on("batch_read_receipts", handleReadReceipts);
    // Some servers may emit read_receipts_batch
    socketManager.getSocket()?.on("read_receipts_batch", handleReadReceipts);
    socketManager.getSocket()?.on("message.read", handleSingleMessageRead);

    socketManager.onFileEvent((data) => {
      if (data.type === "new_file_message") {
        handleNewFileMessage(data);
      } else if (data.type === "new_batch_files_message") {
        handleNewBatchFilesMessage(data);
      }
    });
    // Fallback listeners for specific events
    socketManager.getSocket()?.on("quick_file_shared", handleFileShared);
    socketManager.getSocket()?.on("batch_files_shared", handleBatchFilesShared);
    socketManager.getSocket()?.on("new_file_message", handleNewFileMessage);
    socketManager
      .getSocket()
      ?.on("new_batch_files_message", handleNewBatchFilesMessage);
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

    // Request moved to connect() above to avoid race conditions

    // Cleanup
    return () => {
      socketManager.offFileEvent(handleFileShared);
      socketManager.getSocket()?.off("batch_read_receipts", handleReadReceipts);
      socketManager.getSocket()?.off("read_receipts_batch", handleReadReceipts);
      socketManager.getSocket()?.off("message.read", handleSingleMessageRead);
      socketManager.getSocket()?.off("quick_file_shared", handleFileShared);
      socketManager
        .getSocket()
        ?.off("batch_files_shared", handleBatchFilesShared);
      socketManager.getSocket()?.off("new_file_message", handleNewFileMessage);
      socketManager
        .getSocket()
        ?.off("new_batch_files_message", handleNewBatchFilesMessage);
      socketManager.leaveConversation(conversationId);
      socketManager.offMessage(handleNewMessage);
      socketManager
        .getSocket()
        ?.off("typing_users_response", handleTypingUsers);
      socketManager.getSocket()?.off("user_typing", handleUserTyping);
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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTypingStart = useCallback(() => {
    const now = Date.now();
    if (!isCurrentUserTyping || now - lastTypingEventRef.current > 1000) {
      setIsCurrentUserTyping(true);
      socketManager.startTyping(conversationId);
      lastTypingEventRef.current = now;
      console.log("⌨️ Started typing at:", now);
    }
  }, [conversationId, isCurrentUserTyping]);

  const handleTypingStop = useCallback(() => {
    if (isCurrentUserTyping) {
      setIsCurrentUserTyping(false);
      socketManager.stopTyping(conversationId);
      lastTypingEventRef.current = 0;
      console.log("⌨️ Stopped typing");
    }
  }, [conversationId, isCurrentUserTyping]);
  useEffect(() => {
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (message.length > 0) {
      // Start typing if not already typing
      handleTypingStart();

      // Set timeout to stop typing after 5 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        handleTypingStop();
      }, 5000);
    } else {
      // Stop typing immediately when input is empty
      handleTypingStop();
    }

    // Cleanup function
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, handleTypingStart, handleTypingStop]);
  useEffect(() => {
    return () => {
      // Stop typing when leaving the screen
      if (isCurrentUserTyping) {
        socketManager.stopTyping(conversationId);
      }
      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
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

  const getMessageReadStatus = useCallback(
    (messageId: string, senderId: string) => {
      if (senderId !== currentUserId) {
        return null; // Chỉ hiển thị read status cho tin nhắn của mình
      }

      const messageReadReceipts = readReceipts[messageId];
      if (
        !messageReadReceipts ||
        Object.keys(messageReadReceipts).length === 0
      ) {
        return null;
      }

      // Lấy thời gian đọc gần nhất
      const latestReadTime = Math.max(
        ...Object.values(messageReadReceipts).map((receipt) => receipt.readAt)
      );

      const readers = Object.values(messageReadReceipts);

      return {
        isRead: true,
        readCount: readers.length,
        latestReadTime,
        readers,
      };
    },
    [readReceipts, currentUserId]
  );

  // 6. Function để kiểm tra có phải tin nhắn cuối cùng không
  const isLastMessageFromSender = useCallback(
    (currentIndex: number, messages: Message[]) => {
      // Kiểm tra xem có tin nhắn nào sau này từ cùng sender không
      for (let i = currentIndex + 1; i < messages.length; i++) {
        if (messages[i].senderId === messages[currentIndex].senderId) {
          return false;
        }
      }
      return true;
    },
    []
  );
  // Render message item
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // Check if message has attachments
    const hasAttachments =
      Array.isArray(item.attachments) && item.attachments.length > 0;
    const attachment =
      (item.attachments && item.attachments[0]) ||
      (item.fileInfo && item.fileInfo[0]); // Lấy attachment đầu tiên nếu có
    const previousMessage = messages[index - 1]; // lấy tin nhắn trước đó
    const isOwnMessage = currentUserId
      ? item.senderId === currentUserId
      : false;
    const isGroupConversation = conversations?.type === "group";
    const readStatus = getMessageReadStatus(item.id, item.senderId);
    const isLastFromSender = isLastMessageFromSender(index, messages);
    const shouldShowReadStatus =
      isOwnMessage && isLastFromSender && readStatus?.isRead;
    const isFirstInSenderSequence =
      !previousMessage || previousMessage.senderId !== item.senderId;
    const shouldShowSenderName =
      isGroupConversation && !isOwnMessage && isFirstInSenderSequence;

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

      if (item.type === "text" || item.messageType === "text") {
        // Chỉ hiển thị text thuần túy khi không có attachment
        return (
          <Text className={`font-nunito ${isOwnMessage ? "text-white" : ""}`}>
            {item.content}
          </Text>
        );
      } else if (hasAttachments) {
        // Render file attachment
        const isImage = attachment?.mimeType?.startsWith("image");
        const isVideo = attachment?.mimeType?.startsWith("video");
        const isAudio = attachment?.mimeType?.startsWith("audio");
        const type = isImage ? "image" : "video";
        return (
          <View className="flex space-y-2">
            {isImage || (isVideo && attachment?.downloadUrl) ? (
              <AuthenticatedMediaViewer
                mediaUrl={attachment && attachment.downloadUrl}
                mediaType={type}
              />
            ) : isAudio && attachment?.downloadUrl ? (
              <AudioPlayer
                audioUrl={attachment.downloadUrl}
                fileName={attachment.fileName}
                isOwnMessage={isOwnMessage}
                duration={attachment.duration}
              />
            ) : (
              <View className="flex flex-row items-center space-x-2 p-2 bg-white/20 rounded-lg">
                <View className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  {<AntDesign name="file1" size={16} color="white" />}
                </View>
                <TouchableOpacity
                  className=""
                  onPress={() =>
                    openOfficeFile(
                      attachment?.downloadUrl,
                      attachment?.fileName
                    )
                  }
                >
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
                </TouchableOpacity>
              </View>
            )}
            {/* Hiển thị text kèm theo nếu có */}
            {item.content && (
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
                className={`font-medium  ${isOwnMessage ? "text-white" : ""}`}
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
              <View className={`${hasAttachments ? "" : "px-4 py-3"} `}>
                {renderMessageContent()}
              </View>
            </LinearGradient>
          ) : !messages[index + 1] ||
            messages[index + 1].senderId !== item.senderId ? (
            <View className="flex flex-row items-end">
              <Image
                source={
                  typeof item.sender?.avatarUrl === "string"
                    ? { uri: item.sender?.avatarUrl }
                    : images.defaultAvatar
                }
                className="w-14 h-14 rounded-full mr-2"
                resizeMode="cover"
                style={{ width: 30, height: 30 }}
              />
              <View>
                {shouldShowSenderName && (
                  <Text className="text-xs text-gray-500 mb-1 ml-1">
                    {item.sender?.fullName ||
                      item.sender?.username ||
                      "Người dùng"}
                  </Text>
                )}
                <View
                  className={`${
                    hasAttachments ? "" : "px-4 py-3"
                  } max-w-xs rounded-2xl bg-gray-100 rounded-bl-md `}
                >
                  {renderMessageContent()}
                </View>
              </View>
            </View>
          ) : (
            <View className="flex flex-row items-end">
              <View className="w-8 h-8" style={{ marginRight: 10 }}></View>
              <View>
                {shouldShowSenderName && (
                  <Text className="text-xs text-gray-500 mb-1 ml-1">
                    {item.sender?.fullName ||
                      item.sender?.username ||
                      "Người dùng"}
                  </Text>
                )}
                <View
                  className={`${
                    hasAttachments ? "" : "px-4 py-3"
                  } max-w-xs rounded-2xl bg-gray-100 rounded-bl-md  `}
                >
                  {renderMessageContent()}
                </View>
              </View>
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
                    <>
                      <Text className="text-xs text-gray-400">Đã gửi</Text>
                      <AntDesign name="check" size={12} color="#10b981" />
                    </>
                  )}
                  {item.status === "delivered" && (
                    <View className="flex flex-row items-center">
                      <Text className="text-xs text-gray-400 mr-1">
                        Đã nhận
                      </Text>
                      <View className="flex flex-row">
                        <AntDesign name="check" size={12} color="#10b981" />
                        <AntDesign
                          name="check"
                          size={12}
                          color="#10b981"
                          style={{ marginLeft: -4 }}
                        />
                      </View>
                    </View>
                  )}
                  {item.status === "read" && !shouldShowReadStatus && (
                    <View className="flex flex-row items-center">
                      <Text className="text-xs text-blue-600">Đã đọc</Text>
                      <View className="flex flex-row ml-1">
                        <AntDesign name="check" size={12} color="#3b82f6" />
                        <AntDesign
                          name="check"
                          size={12}
                          color="#3b82f6"
                          style={{ marginLeft: -4 }}
                        />
                      </View>
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
    <SafeAreaProvider>
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
                  <TouchableOpacity
                    className="p-2 bg-white/20 rounded-full"
                    onPress={handleStartVoiceCall}
                    disabled={callConnecting}
                  >
                    <FontAwesome name="phone" size={24} color="#a855f7" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="p-2 bg-white/20 rounded-full"
                    onPress={handleStartVideoCall}
                    disabled={callConnecting}
                  >
                    <FontAwesome6 name="video" size={24} color="#a855f7" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Messages */}
            <FlatList
              data={getMessagesWithTyping()} // Thay vì messages
              renderItem={({ item, index }) => {
                if ((item as any).kind === "typing") {
                  return (
                    <View className="flex flex-row">
                      <Image
                        source={images.defaultAvatar}
                        className="w-14 h-14 rounded-full mr-2"
                        resizeMode="cover"
                        style={{ width: 30, height: 30 }}
                      />
                      <TypingDots />
                    </View>
                  );
                }
                return renderMessage({ item: item as Message, index });
              }}
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
            <View className="bg-white px-2 py-3 border-t border-gray-200">
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
    </SafeAreaProvider>
  );
};

export default MessageScreen;
