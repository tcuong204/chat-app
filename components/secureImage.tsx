import { getAccount } from "@/utils/secureStore";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageStyle,
  StyleProp,
  Text,
  View,
} from "react-native";

interface Attachment {
  downloadUrl: string;
}

interface SecureImageProps {
  attachment: Attachment;
  style?: StyleProp<ImageStyle>;
  className?: string;
  resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
}

const SecureImage: React.FC<SecureImageProps> = ({
  attachment,
  style,
  className,
  ...props
}) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  useEffect(() => {
    const downloadAndDisplayImage = async () => {
      if (!attachment?.downloadUrl) {
        setError("No download URL provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setDownloadProgress(0);

        console.log("🔄 Starting image download:", attachment.downloadUrl);

        // Lấy token mới
        const account = await getAccount();
        const token: string = (account as any).accessToken;

        if (!token) {
          throw new Error("No access token available");
        }

        console.log("✅ Token obtained, length:", token.length);

        // Tạo tên file unique
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);
        const fileName = `secure_image_${timestamp}_${randomId}.jpg`;
        const fileUri = FileSystem.documentDirectory + fileName;

        console.log("📁 Download destination:", fileUri);

        // Test connection trước khi download
        console.log("🔍 Testing connection...");
        const testResponse = await fetch(attachment.downloadUrl, {
          method: "HEAD",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "image/*",
            "User-Agent": "SecureImageApp/1.0",
          },
        });

        console.log("📡 Test response status:", testResponse.status);
        console.log(
          "📡 Test response headers:",
          Object.fromEntries(testResponse.headers.entries())
        );

        if (!testResponse.ok) {
          throw new Error(
            `Server test failed: ${testResponse.status} ${testResponse.statusText}`
          );
        }

        // Download với progress tracking
        console.log("⬇️ Starting download...");

        const downloadResumable = FileSystem.createDownloadResumable(
          attachment.downloadUrl,
          fileUri,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "image/*",
              "Cache-Control": "no-cache",
              "User-Agent": "SecureImageApp/1.0",
            },
          },
          (downloadProgress: FileSystem.DownloadProgressData) => {
            const progress =
              downloadProgress.totalBytesWritten /
              downloadProgress.totalBytesExpectedToWrite;
            setDownloadProgress(Math.round(progress * 100));
            console.log(`📊 Download progress: ${Math.round(progress * 100)}%`);
          }
        );

        const downloadResult = await downloadResumable.downloadAsync();

        console.log("✅ Download completed:", downloadResult);

        if (downloadResult && downloadResult.status === 200) {
          // Verify file exists
          const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
          console.log("📋 File info:", fileInfo);

          if (fileInfo.exists && fileInfo.size > 0) {
            setLocalUri(downloadResult.uri);
            console.log("🎉 Image ready for display:", downloadResult.uri);
          } else {
            throw new Error("Downloaded file is empty or corrupted");
          }
        } else {
          throw new Error(
            `Download failed with status: ${
              downloadResult?.status || "unknown"
            }`
          );
        }
      } catch (err: any) {
        console.error("❌ Download error:", err);
        setError(err.message || "Unknown download error");

        // Cleanup failed download
        try {
          const fileName = `secure_image_${Date.now()}_*.jpg`;
          const fileUri = FileSystem.documentDirectory + fileName;
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (cleanupErr: any) {
          console.warn("Cleanup error:", cleanupErr);
        }
      } finally {
        setLoading(false);
      }
    };

    downloadAndDisplayImage();

    // Cleanup on unmount
    return () => {
      if (localUri) {
        FileSystem.deleteAsync(localUri, { idempotent: true }).catch(
          console.warn
        );
      }
    };
  }, [attachment?.downloadUrl]);

  // Loading state
  if (loading) {
    return (
      <View
        className={
          className ||
          "w-48 h-32 rounded-lg bg-gray-100 justify-center items-center"
        }
        style={style}
      >
        <ActivityIndicator size="small" color="#666" />
        <Text className="text-xs text-gray-600 mt-2">
          {downloadProgress > 0
            ? `Downloading ${downloadProgress}%`
            : "Preparing..."}
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View
        className={
          className ||
          "w-48 h-32 rounded-lg bg-red-50 justify-center items-center p-2"
        }
        style={style}
      >
        <Text className="text-xs text-red-600 text-center">⚠️ Load failed</Text>
        <Text className="text-xs text-red-500 text-center mt-1">{error}</Text>
      </View>
    );
  }

  // Success state - display downloaded image
  return (
    <Image
      source={localUri ? { uri: localUri } : undefined}
      className={className || "w-48 h-32 rounded-lg"}
      resizeMode="cover"
      style={style}
      {...props}
      onError={(e: any) => {
        console.error("🖼️ Image display error:", e.nativeEvent.error);
        setError("Failed to display downloaded image");
      }}
      onLoad={() => {
        console.log("🖼️ Image successfully displayed");
      }}
    />
  );
};

export default SecureImage;
