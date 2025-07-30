export interface ChatData {
  messages: Message[];
  pagination: Pagination;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: Sender;
  type: "text" | "image" | "file" | string;
  content: string | null;
  attachments: Attachment[];
  mentions: Mention[];
  status: "sent" | "delivered" | "read" | string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface Sender {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeen: string; // ISO date
}

export interface Attachment {
  // Nếu có thông tin chi tiết, bạn có thể khai báo thêm
  // ví dụ: id, url, type, fileName, size
}

export interface Mention {
  // Nếu có logic mention người dùng thì thêm id, username,...
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}
