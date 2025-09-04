import { LOCALIP } from "@/constants/localIp";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
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
const replaceLocalhost = (url: string | undefined) => {
  if (!url) return url;
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
  const [webViewUrl, setWebViewUrl] = useState(fileUri); // Bắt đầu với ngrok URL
  const webViewRef = React.useRef<WebView>(null);

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
              await Sharing.shareAsync(fileUri);
            }
            onClose();
          },
        },
      ]
    );
  };

  // Thêm parameter skip cho ngrok
  const safeFileUri = addNgrokSkipWarning(fileUri);

  // Google Viewer URL
  const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
    safeFileUri
  )}`;

  // Kiểm tra warning page
  const isNgrokWarningPage = (url: string) => {
    return url.includes("ngrok") && url.includes("only-valid-for-one-request");
  };

  // Xử lý download không mong muốn
  const handleShouldStartLoadWithRequest = (event: any) => {
    const { url, headers } = event;
    // Nếu server trả về Content-Disposition: attachment, chặn download
    if (headers && headers["Content-Disposition"]?.includes("attachment")) {
      console.log("Blocked auto-download for URL:", url);
      // Force load inline
      setWebViewUrl(googleViewerUrl);
      return false; // Chặn request download
    }
    return true; // Cho phép load bình thường
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
                const downloadPath =
                  FileSystem.documentDirectory + (fileName || "document.pdf");
                const downloadResumable = FileSystem.createDownloadResumable(
                  safeFileUri,
                  downloadPath,
                  { headers: { "ngrok-skip-browser-warning": "true" } } // Thêm header
                );
                const result = await downloadResumable.downloadAsync();
                if (result?.uri) {
                  Alert.alert("Thành công", "Đã tải file về: " + result.uri);
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(result.uri);
                  }
                }
              } catch (error) {
                console.error("❌ Lỗi khi tải PDF:", error);
                Alert.alert("Lỗi", "Không thể tải file. Vui lòng thử lại.");
              }
            }}
          >
            <Ionicons name="download-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={async () => {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
              }
            }}
          >
            <Ionicons name="share-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* PDF Viewer */}
        <View style={styles.pdfContainer}>
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <Text style={styles.errorText}>Không thể hiển thị file PDF</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setError(false);
                  setLoading(true);
                  setWebViewUrl(safeFileUri); // Reset về ngrok URL
                }}
              >
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              ref={webViewRef}
              source={{
                uri: webViewUrl,
                headers: {
                  "ngrok-skip-browser-warning": "true",
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  Accept: "application/pdf,*/*",
                  "Content-Type": "application/pdf",
                },
              }}
              userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={handleError}
              onHttpError={handleError}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              allowsInlineMediaPlayback={true}
              allowFileAccess={true}
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <Text>Đang tải PDF...</Text>
                </View>
              )}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onNavigationStateChange={(navState) => {
                console.log("Current URL:", navState.url);
                if (isNgrokWarningPage(navState.url)) {
                  console.log("Detected ngrok warning, waiting for bypass...");
                } else if (
                  navState.url.includes("ngrok") &&
                  !navState.url.includes("docs.google.com")
                ) {
                  // Đã bypass warning, chuyển sang Google Viewer
                  console.log("Switching to Google Viewer:", googleViewerUrl);
                  setWebViewUrl(googleViewerUrl);
                }
              }}
              injectedJavaScript={`
                (function() {
                  function tryClickVisit() {
                    const visitButton = document.querySelector('button[type="submit"], [data-testid="visit-site-button"], a[href*="ngrok-skip-browser-warning"]');
                    if (visitButton) {
                      visitButton.click();
                      return true;
                    }
                    return false;
                  }

                  // Kiểm tra ngay lập tức
                  tryClickVisit();

                  // Retry mỗi 300ms trong 5 giây
                  let retries = 15;
                  const interval = setInterval(() => {
                    if (tryClickVisit() || retries <= 0) {
                      clearInterval(interval);
                    }
                    retries--;
                  }, 300);

                  // Observer cho DOM changes
                  const observer = new MutationObserver(tryClickVisit);
                  observer.observe(document.body, { childList: true, subtree: true });
                })();
                true;
              `}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// Main Hook
export const usePDFViewer = () => {
  const [pdfPreview, setPdfPreview] = useState<{
    visible: boolean;
    fileUri: string;
    fileName: string;
  }>({
    visible: false,
    fileUri: "",
    fileName: "",
  });

  const openPdfWithSystemViewer = async (fileUri: string) => {
    try {
      const canOpen = await Linking.canOpenURL(fileUri);
      if (canOpen) {
        await Linking.openURL(fileUri);
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          alert("Thiết bị không hỗ trợ mở/chia sẻ file.");
        }
      }
    } catch (error) {
      console.error("Lỗi khi mở PDF:", error);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    }
  };

  const openFile = async (
    fileUrl: string | undefined,
    fileName: string | undefined,
    showPreview: boolean = true
  ) => {
    try {
      const processedUrl = replaceLocalhost(fileUrl);

      if (isPdfFile(fileName)) {
        if (showPreview) {
          // 👉 Không download, chỉ mở trực tiếp link preview
          setPdfPreview({
            visible: true,
            fileUri: processedUrl!, // online preview link
            fileName: fileName || "",
          });
        } else {
          await openPdfWithSystemViewer(processedUrl!);
        }
        return;
      }

      // Với file khác (không phải PDF), mới tải về
      const downloadPath = FileSystem.documentDirectory + (fileName || "file");
      const downloadResumable = FileSystem.createDownloadResumable(
        processedUrl!,
        downloadPath
      );
      const result = await downloadResumable.downloadAsync();

      if (result?.uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(result.uri);
      }
    } catch (error) {
      console.error("❌ Lỗi khi mở file:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra khi mở file.");
    }
  };

  const closePdfPreview = () => {
    setPdfPreview({
      visible: false,
      fileUri: "",
      fileName: "",
    });
  };

  const PDFPreviewComponent = () => (
    <PDFPreviewModal
      visible={pdfPreview.visible}
      fileUri={pdfPreview.fileUri}
      fileName={pdfPreview.fileName}
      onClose={closePdfPreview}
    />
  );

  return {
    openFile,
    PDFPreviewComponent,
    closePdfPreview,
    isPreviewVisible: pdfPreview.visible,
  };
};

// Styles
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

export default usePDFViewer;
