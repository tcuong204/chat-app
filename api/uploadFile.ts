import * as FileSystem from "expo-file-system";
import axiosInstance from "./axiosInstance";

interface FileInfo {
  uri: string;
  name?: string;
  type?: string;
  size?: number;
}
export interface File {
  fileId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  downloadCount: number;
  isProcessed: boolean;
  virusScanStatus: "pending";
}
export interface UploadedFile {
  fileId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;
  isNew?: boolean;
  uploadedAt: string;
}

export interface UploadFileResponse {
  success: boolean;
  message: string;
  data: {
    uploadedFiles: UploadedFile[];
  };
}

const getMimeType = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4"; // Correct MIME type for M4A audio
    case "aac":
      return "audio/aac";
    case "wav":
      return "audio/wav";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
};

export const uploadFiles = async (
  files: FileInfo[]
): Promise<UploadFileResponse> => {
  try {
    const formData = new FormData();

    // Append each file to FormData
    files.forEach((file) => {
      const fileName = file.name || file.uri.split("/").pop() || "file";
      // Ensure we have the correct MIME type for audio files
      let mimeType = file.type;
      if (!mimeType || mimeType === "application/octet-stream") {
        mimeType = getMimeType(fileName);
      }

      console.log("Uploading file:", {
        fileName,
        mimeType,
        size: file.size,
      });

      formData.append("files", {
        uri: file.uri,
        name: fileName,
        type: mimeType,
        size: file.size,
      } as any);
    });

    const response = await axiosInstance.post<UploadFileResponse>(
      "/files/upload/batch",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        // Add timeout and onUploadProgress if needed
        timeout: 30000,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 100)
          );
          console.log("Upload progress:", percentCompleted);
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "Upload failed");
    }

    return response.data;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};

// Helper function for single file upload
export const uploadFile = async (
  uri: string,
  options?: {
    name?: string;
    type?: string;
    size?: number;
  }
): Promise<UploadedFile> => {
  const response = await uploadFiles([
    {
      uri,
      ...options,
    },
  ]);

  return response.data.uploadedFiles[0];
};
const getFileUrl = (fileId: string) => {
  const res = axiosInstance.get("/files/" + fileId);
  return (res as any)?.data;
};

export async function fetchProtectedImage(
  url: string,
  token: string
): Promise<string> {
  const localUri = FileSystem.documentDirectory + "temp_image.jpg";

  const res = await FileSystem.downloadAsync(url, localUri, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.uri; // có thể dùng cho <Image source={{ uri: res.uri }} />
}
export async function getPreviewVideo(fileId: string) {
  const res = await axiosInstance.get(`/files/preview/` + fileId);

  return res.data; // có thể dùng cho <Image source={{ uri: res.uri }} />
}
