import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const replaceLocalhost = (url: string | undefined) => {
  return url?.replace("localhost:3000", "192.168.0.102:3000");
};

export const openOfficeFile = async (
  downloadUrl: string | undefined,
  fileName: string | undefined,
  token: string | null
) => {
  try {
    const processedUrl = replaceLocalhost(downloadUrl);
    const fileUri = FileSystem.documentDirectory + (fileName || "");

    const downloadResumable = FileSystem.createDownloadResumable(
      processedUrl!,
      fileUri,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
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
