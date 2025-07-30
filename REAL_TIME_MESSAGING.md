# Real-time Messaging Implementation

## 🚀 Overview

Implementation của real-time messaging sử dụng Socket.IO với REST API fallback, tuân theo API documentation đã cung cấp.

## 📁 Files Created/Modified

### 1. API Layer (`api/messageApi.ts`)

```typescript
// Interfaces cho Message và API calls
export interface Message {
  id: string;
  localId?: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: "text" | "image" | "video" | "audio" | "file" | "location" | "contact" | "sticker" | "system";
  // ... other properties
}

// REST API functions
export const sendMessage = async (messageData: SendMessageRequest): Promise<Message>
export const getConversationMessages = async (conversationId: string, page?: number, limit?: number)
export const markMessageAsRead = async (messageId: string): Promise<void>
export const deleteMessage = async (messageId: string): Promise<void>
export const editMessage = async (messageId: string, content: string): Promise<Message>
export const searchMessages = async (conversationId: string, query: string): Promise<GetMessagesResponse>
```

### 2. Socket Manager (`utils/socket.ts`)

```typescript
class SocketManager {
  // Connection management
  async connect(): Promise<void>;
  disconnect(): void;
  isSocketConnected(): boolean;

  // Message operations
  sendMessage(messageData: SendMessageRequest): Promise<Message>;
  markAsRead(messageId: string): void;

  // Typing indicators
  startTyping(conversationId: string): void;
  stopTyping(conversationId: string): void;

  // Conversation management
  joinConversation(conversationId: string): void;
  leaveConversation(conversationId: string): void;

  // Event listeners
  onMessage(callback: (message: Message) => void): void;
  onTyping(callback: (data: any) => void): void;
  onStatusUpdate(callback: (data: any) => void): void;
  onConnectionChange(callback: (connected: boolean) => void): void;
}
```

### 3. Messages Screen (`app/messages/[id].tsx`)

```typescript
const MovieDetails = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [localMessages, setLocalMessages] = useState<{
    [key: string]: Message;
  }>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // Optimistic UI implementation
  const handleSendMessage = async () => {
    // 1. Create optimistic message
    // 2. Add to local messages
    // 3. Try Socket.IO first
    // 4. Fallback to REST API
    // 5. Update UI with server response
  };

  // Socket event handlers
  useEffect(() => {
    socketManager.connect();
    socketManager.joinConversation(conversationId);

    // Listen for events
    socketManager.onMessage(handleNewMessage);
    socketManager.onTyping(handleTyping);
    socketManager.onStatusUpdate(handleStatusUpdate);
  }, []);
};
```

## 🔄 Real-time Flow

### 1. Send Message Flow

```
User types message → Optimistic UI → Socket.IO → Server → Real-time to all users
                                    ↓ (if fails)
                                REST API → Server → Real-time to all users
```

### 2. Receive Message Flow

```
Socket.IO event → Update UI → Mark as read → Scroll to bottom
```

### 3. Typing Indicators

```
User types → Socket.IO typing_start → Other users see "User is typing..."
User stops → Socket.IO typing_stop → Remove typing indicator
```

## 🎯 Key Features

### ✅ Optimistic UI

- Hiển thị message ngay lập tức khi user gửi
- Không cần chờ server response
- Smooth user experience

### ✅ Fallback Strategy

- Socket.IO là primary method
- REST API là fallback khi Socket.IO fails
- Đảm bảo message luôn được gửi

### ✅ Real-time Features

- Instant message delivery
- Typing indicators
- Read receipts
- Online/offline status
- Message status updates

### ✅ Error Handling

- Network error handling
- Retry mechanism
- User feedback với toast messages

### ✅ Performance

- FlatList cho message rendering
- Efficient scrolling
- Memory optimization

## 🔧 Usage Examples

### 1. Send Message

```typescript
// Optimistic UI + Socket.IO + Fallback
const handleSendMessage = async () => {
  const optimisticMessage = createOptimisticMessage(text);
  setLocalMessages((prev) => ({
    ...prev,
    [optimisticMessage.localId!]: optimisticMessage,
  }));

  try {
    // Try Socket.IO first
    const serverMessage = await socketManager.sendMessage({
      conversationId,
      content: text,
      type: "text",
    });

    // Update UI with server response
    removeOptimisticMessage(optimisticMessage.localId!);
    addServerMessage(serverMessage);
  } catch (error) {
    // Fallback to REST API
    const serverMessage = await sendMessage({
      conversationId,
      content: text,
      type: "text",
    });

    removeOptimisticMessage(optimisticMessage.localId!);
    addServerMessage(serverMessage);
  }
};
```

### 2. Listen for Messages

```typescript
// Socket event handler
const handleNewMessage = (newMessage: Message) => {
  if (newMessage.conversationId === currentConversationId) {
    setMessages((prev) => [...prev, newMessage]);
    markMessageAsRead(newMessage.id);
    scrollToBottom();
  }
};

socketManager.onMessage(handleNewMessage);
```

### 3. Typing Indicators

```typescript
// Start typing
const handleTypingStart = () => {
  socketManager.startTyping(conversationId);
};

// Stop typing
const handleTypingStop = () => {
  socketManager.stopTyping(conversationId);
};

// Listen for typing events
const handleTyping = (data) => {
  if (data.conversationId === currentConversationId) {
    if (data.type === "started") {
      setTypingUsers((prev) => [...prev, data.userName]);
    } else {
      setTypingUsers((prev) => prev.filter((user) => user !== data.userName));
    }
  }
};
```

## 🛠️ Configuration

### Socket Server URL

```typescript
// utils/socket.ts
this.socket = io("http://192.168.0.102:3000", {
  auth: { token: account.accessToken },
  transports: ["websocket", "polling"],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

### Authentication

```typescript
// JWT token từ SecureStore
const account = await getAccount();
if (!account || !(account as any)?.accessToken) {
  console.log("❌ No access token found for socket connection");
  return;
}
```

## 📊 Event Mapping

### Outgoing Events (Client → Server)

- `send_message`: Gửi tin nhắn
- `mark_read`: Đánh dấu đã đọc
- `typing_start`: Bắt đầu nhập
- `typing_stop`: Dừng nhập
- `join_conversation`: Tham gia conversation
- `leave_conversation`: Rời conversation

### Incoming Events (Server → Client)

- `message_received`: Tin nhắn mới
- `message_edited`: Tin nhắn được chỉnh sửa
- `message_deleted`: Tin nhắn bị xóa
- `message_status_updated`: Cập nhật trạng thái
- `typing_started`: User bắt đầu nhập
- `typing_stopped`: User dừng nhập
- `user_online`: User online
- `user_offline`: User offline
- `conversation_updated`: Conversation được cập nhật

## 🚀 Benefits

1. **Real-time Experience**: Instant message delivery
2. **Reliability**: Socket.IO + REST API fallback
3. **Performance**: Optimistic UI, efficient rendering
4. **User Feedback**: Typing indicators, read receipts
5. **Error Handling**: Comprehensive error management
6. **Scalability**: Modular architecture

## 🔮 Future Enhancements

- [ ] Message reactions
- [ ] File attachments
- [ ] Voice messages
- [ ] Message search
- [ ] Message forwarding
- [ ] Message editing
- [ ] Message deletion
- [ ] Message encryption
- [ ] Push notifications
- [ ] Offline message queuing
