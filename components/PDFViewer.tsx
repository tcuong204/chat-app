import { LOCALIP } from "@/constants/localIp";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const { width, height } = Dimensions.get("window");

// Utilities
const replaceLocalhost = (url: string): string => {
  if (!url) return "";
  return url.replace("http://localhost:3000", LOCALIP);
};
const addNgrokSkipWarning = (url: string): string => {
  if (!url.includes("ngrok") && !url.includes("ngrok-free.app")) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}ngrok-skip-browser-warning=true`;
};
const isPdfFile = (fileName: string | undefined): boolean => {
  if (!fileName) return false;
  return fileName.toLowerCase().endsWith(".pdf");
};

// PDF Preview Modal Component
interface PDFPreviewModalProps {
  visible: boolean;
  fileUri: string;
  fileName: string;
  onClose: () => void;
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  visible,
  fileUri,
  fileName,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  // Download PDF về local khi modal hiển thị
  useEffect(() => {
    const downloadPdf = async () => {
      try {
        setLoading(true);
        setError(false);
        if (!fileUri) throw new Error("No fileUri provided");
        // Đảm bảo tên file không trùng, nếu có fileId thì nên dùng
        const safeFileName = fileName || "document.pdf";
        const downloadPath = `${FileSystem.documentDirectory}${safeFileName}`;
        // Kiểm tra file đã tồn tại chưa
        const fileInfo = await FileSystem.getInfoAsync(downloadPath);
        if (fileInfo.exists) {
          setLocalUri(downloadPath);
          setLoading(false);
          return;
        }
        // Nếu chưa có thì tải về
        const safeFileUri = addNgrokSkipWarning(
          replaceLocalhost(fileUri || "")
        );
        const downloadResumable = FileSystem.createDownloadResumable(
          safeFileUri,
          downloadPath,
          { headers: { "ngrok-skip-browser-warning": "true" } }
        );
        const result = await downloadResumable.downloadAsync();
        if (result?.uri) {
          setLocalUri(result.uri);
        } else {
          throw new Error("Download failed");
        }
      } catch (error) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (visible) {
      downloadPdf();
    }
  }, [visible, fileUri, fileName]);

  const handleError = () => {
    setError(true);
    setLoading(false);
    Alert.alert(
      "Lỗi",
      "Không thể hiển thị file PDF. Bạn có muốn mở bằng ứng dụng khác không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Mở bằng ứng dụng khác",
          onPress: async () => {
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(localUri || fileUri);
            }
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName}
          </Text>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={async () => {
              try {
                if (localUri && (await Sharing.isAvailableAsync())) {
                  await Sharing.shareAsync(localUri);
                  Alert.alert("Thành công", "Đã tải file về: " + localUri);
                } else {
                  throw new Error("Local file not available");
                }
              } catch (error) {
                console.error("❌ Lỗi khi chia sẻ PDF:", error);
                Alert.alert("Lỗi", "Không thể chia sẻ file. Vui lòng thử lại.");
              }
            }}
          >
            <Ionicons name="download-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={async () => {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(localUri || fileUri);
              }
            }}
          >
            <Ionicons name="share-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* PDF Viewer */}
        <View style={styles.pdfContainer}>
          {error || !localUri ? (
            <View style={styles.errorContainer}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <Text style={styles.errorText}>Không thể hiển thị file PDF</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setError(false);
                  setLoading(true);
                  setLocalUri(null); // Trigger download lại
                }}
              >
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              source={{ uri: localUri }}
              style={styles.webview}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={(syntheticEvent) => {
                console.error("WebView error:", syntheticEvent.nativeEvent);
                handleError();
              }}
              onHttpError={(syntheticEvent) => {
                console.error(
                  "WebView HTTP error:",
                  syntheticEvent.nativeEvent
                );
                handleError();
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              allowsInlineMediaPlayback={true}
              allowFileAccess={true}
              scalesPageToFit={true}
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <Text>Đang tải PDF...</Text>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// Custom hook để dùng trong chat app
const usePDFViewer = () => {
  const [visible, setVisible] = useState(false);
  const [fileUri, setFileUri] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const openFile = (uri: string, name?: string) => {
    setFileUri(uri);
    setFileName(name || "Tệp PDF");
    setVisible(true);
  };

  const PDFPreviewComponent = () => (
    <PDFPreviewModal
      visible={visible}
      fileUri={fileUri}
      fileName={fileName}
      onClose={() => setVisible(false)}
    />
  );

  return { openFile, PDFPreviewComponent };
};

// Styles (giữ nguyên như code gốc)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 44 : 24,
    paddingBottom: 16,
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    padding: 4,
  },
  shareButton: {
    padding: 4,
    marginLeft: 8,
  },
  downloadButton: {
    padding: 4,
    marginLeft: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    marginHorizontal: 16,
    textAlign: "center",
  },
  pdfContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});

export default usePDFViewer; // Giữ nguyên export
