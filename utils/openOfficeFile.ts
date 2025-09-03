import { LOCALIP } from "@/constants/localIp";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export const replaceLocalhost = (url: string | undefined) => {
  if (!url) return url;
  return (
    url
      // .replace("http://", "https://")
      .replace("download", "preview") // đổi http thành https
      .replace("http://localhost:3000", LOCALIP)
  ); // thay localhost:3000 thành LOCALIP
};

export const openOfficeFile = async (
  downloadUrl: string | undefined,
  fileName: string | undefined
) => {
  try {
    const processedUrl = replaceLocalhost(downloadUrl);
    const fileUri = FileSystem.documentDirectory + (fileName || "");

    const downloadResumable = FileSystem.createDownloadResumable(
      processedUrl!,
      fileUri
    );

    const result = await downloadResumable.downloadAsync();

    if (result?.uri) {
      console.log("✅ File downloaded to:", result.uri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri);
      } else {
        alert("Thiết bị không hỗ trợ mở/chia sẻ file.");
      }
    } else {
      console.error("❌ Tải file thất bại: Không có kết quả.");
    }
  } catch (error) {
    console.error("❌ Lỗi khi mở file:", error);
  }
};
