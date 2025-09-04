import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { voiceCallService } from "../utils/voiceCallService";

interface CameraDevice {
  deviceId: string;
  label: string;
  facingMode: "user" | "environment" | "unknown";
}

interface ConnectionQuality {
  level: "excellent" | "good" | "fair" | "poor";
  rtt?: number;
  packetLoss?: number;
  bandwidth?: number;
}

interface WebRTCStats {
  iceConnectionState: string;
  signalingState: string;
  localDescription?: string;
  remoteDescription?: string;
  bytesReceived?: number;
  bytesSent?: number;
  packetsLost?: number;
  rtt?: number;
}

export const CallTestPanel: React.FC = () => {
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({ level: "excellent" });
  const [webrtcStats, setWebrtcStats] = useState<WebRTCStats | null>(null);
  const [microphoneTest, setMicrophoneTest] = useState<boolean | null>(null);
  const [cameraTest, setCameraTest] = useState<boolean | null>(null);
  const [permissions, setPermissions] = useState({ camera: "unknown", microphone: "unknown" });
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    // Set up listeners for enhanced features
    voiceCallService.onConnectionQualityChanged = (quality: ConnectionQuality) => {
      setConnectionQuality(quality);
    };

    voiceCallService.onWebRTCStatsUpdate = (stats: WebRTCStats) => {
      setWebrtcStats(stats);
    };

    // Load initial data
    loadAvailableCameras();
    checkPermissions();

    return () => {
      voiceCallService.onConnectionQualityChanged = null;
      voiceCallService.onWebRTCStatsUpdate = null;
    };
  }, []);

  const loadAvailableCameras = async () => {
    try {
      const cameras = await voiceCallService.getAvailableCameras();
      setAvailableCameras(cameras);
    } catch (error) {
      console.log("Failed to load cameras:", error);
    }
  };

  const checkPermissions = async () => {
    try {
      const perms = await voiceCallService.checkCameraPermissions();
      setPermissions({
        camera: perms.camera,
        microphone: perms.microphone,
      });
    } catch (error) {
      console.log("Failed to check permissions:", error);
    }
  };

  const testMicrophone = async () => {
    try {
      // Use existing microphone test method
      const result = await (voiceCallService as any).testMicrophone();
      setMicrophoneTest(result);
      Alert.alert("Success", "Microphone test completed successfully");
    } catch (error) {
      setMicrophoneTest(false);
      Alert.alert("Microphone Test Failed", (error as Error).message);
    }
  };

  const testCamera = async () => {
    try {
      // Use existing testCamera method
      const result = await (voiceCallService as any).testCamera();
      setCameraTest(result);
      Alert.alert("Success", "Camera test completed successfully");
    } catch (error) {
      setCameraTest(false);
      Alert.alert("Camera Test Failed", (error as Error).message);
    }
  };

  const requestPermissions = async () => {
    try {
      const granted = await voiceCallService.requestMediaPermissions(true);
      if (granted) {
        Alert.alert("Success", "All permissions granted");
        checkPermissions();
        loadAvailableCameras();
      } else {
        Alert.alert("Error", "Permissions not granted");
      }
    } catch (error) {
      Alert.alert("Permission Error", (error as Error).message);
    }
  };

  const getPermissionColor = (status: string) => {
    switch (status) {
      case "granted": return "#4CAF50";
      case "denied": return "#F44336";
      default: return "#FF9800";
    }
  };

  const getQualityColor = () => {
    switch (connectionQuality.level) {
      case "excellent": return "#4CAF50";
      case "good": return "#8BC34A";
      case "fair": return "#FF9800";
      case "poor": return "#F44336";
      default: return "#9E9E9E";
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Voice Call Test Panel</Text>
      <Text style={styles.subtitle}>Enhanced features from web test app</Text>

      {/* Permissions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 Permissions</Text>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Microphone:</Text>
          <Text style={[styles.permissionStatus, { color: getPermissionColor(permissions.microphone) }]}>
            {permissions.microphone}
          </Text>
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Camera:</Text>
          <Text style={[styles.permissionStatus, { color: getPermissionColor(permissions.camera) }]}>
            {permissions.camera}
          </Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={requestPermissions}>
          <MaterialIcons name="security" size={20} color="white" />
          <Text style={styles.buttonText}>Request Permissions</Text>
        </TouchableOpacity>
      </View>

      {/* Media Testing Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧪 Media Testing</Text>
        <TouchableOpacity style={styles.button} onPress={testMicrophone}>
          <MaterialIcons 
            name="mic" 
            size={20} 
            color={microphoneTest === true ? "#4CAF50" : microphoneTest === false ? "#F44336" : "white"} 
          />
          <Text style={styles.buttonText}>Test Microphone</Text>
          {microphoneTest !== null && (
            <MaterialIcons 
              name={microphoneTest ? "check" : "close"} 
              size={20} 
              color={microphoneTest ? "#4CAF50" : "#F44336"} 
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testCamera}>
          <MaterialIcons 
            name="videocam" 
            size={20} 
            color={cameraTest === true ? "#4CAF50" : cameraTest === false ? "#F44336" : "white"} 
          />
          <Text style={styles.buttonText}>Test Camera</Text>
          {cameraTest !== null && (
            <MaterialIcons 
              name={cameraTest ? "check" : "close"} 
              size={20} 
              color={cameraTest ? "#4CAF50" : "#F44336"} 
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Camera Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📷 Available Cameras</Text>
        {availableCameras.length > 0 ? (
          availableCameras.map((camera, index) => (
            <View key={index} style={styles.cameraItem}>
              <MaterialIcons 
                name={camera.facingMode === "user" ? "camera-front" : "camera-rear"} 
                size={20} 
                color="#4CAF50" 
              />
              <Text style={styles.cameraLabel}>{camera.label}</Text>
              <Text style={styles.cameraMode}>({camera.facingMode})</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No cameras detected</Text>
        )}
        <TouchableOpacity style={styles.button} onPress={loadAvailableCameras}>
          <MaterialIcons name="refresh" size={20} color="white" />
          <Text style={styles.buttonText}>Refresh Cameras</Text>
        </TouchableOpacity>
      </View>

      {/* Connection Quality */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Connection Quality</Text>
        <View style={styles.qualityRow}>
          <Text style={styles.qualityLabel}>Status:</Text>
          <Text style={[styles.qualityValue, { color: getQualityColor() }]}>
            {connectionQuality.level.toUpperCase()}
          </Text>
        </View>
        {connectionQuality.rtt && (
          <View style={styles.qualityRow}>
            <Text style={styles.qualityLabel}>RTT:</Text>
            <Text style={styles.qualityValue}>{(connectionQuality.rtt * 1000).toFixed(0)}ms</Text>
          </View>
        )}
        {connectionQuality.packetLoss !== undefined && (
          <View style={styles.qualityRow}>
            <Text style={styles.qualityLabel}>Packet Loss:</Text>
            <Text style={styles.qualityValue}>{connectionQuality.packetLoss}</Text>
          </View>
        )}
      </View>

      {/* Advanced Stats Toggle */}
      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <Text style={styles.sectionTitle}>🔧 Advanced Stats</Text>
          <Switch
            value={showAdvanced}
            onValueChange={setShowAdvanced}
            trackColor={{ false: "#767577", true: "#4CAF50" }}
            thumbColor={showAdvanced ? "#ffffff" : "#f4f3f4"}
          />
        </View>

        {showAdvanced && webrtcStats && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>WebRTC Statistics</Text>
            <Text style={styles.statsText}>ICE State: {webrtcStats.iceConnectionState}</Text>
            <Text style={styles.statsText}>Signal State: {webrtcStats.signalingState}</Text>
            {webrtcStats.rtt && (
              <Text style={styles.statsText}>RTT: {(webrtcStats.rtt * 1000).toFixed(0)}ms</Text>
            )}
            {webrtcStats.packetsLost !== undefined && (
              <Text style={styles.statsText}>Packets Lost: {webrtcStats.packetsLost}</Text>
            )}
            {webrtcStats.bytesReceived && (
              <Text style={styles.statsText}>
                Received: {(webrtcStats.bytesReceived / 1024).toFixed(1)} KB
              </Text>
            )}
            {webrtcStats.bytesSent && (
              <Text style={styles.statsText}>
                Sent: {(webrtcStats.bytesSent / 1024).toFixed(1)} KB
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#B0B0B0",
    marginBottom: 24,
  },
  section: {
    backgroundColor: "#2C2C2C",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
    marginRight: 8,
  },
  permissionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  permissionLabel: {
    color: "#E0E0E0",
    fontSize: 16,
  },
  permissionStatus: {
    fontSize: 16,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cameraItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    padding: 8,
    backgroundColor: "#383838",
    borderRadius: 8,
  },
  cameraLabel: {
    color: "#E0E0E0",
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  cameraMode: {
    color: "#B0B0B0",
    fontSize: 14,
  },
  noDataText: {
    color: "#B0B0B0",
    fontSize: 16,
    textAlign: "center",
    fontStyle: "italic",
    marginVertical: 8,
  },
  qualityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  qualityLabel: {
    color: "#E0E0E0",
    fontSize: 16,
  },
  qualityValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statsContainer: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 12,
  },
  statsTitle: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  statsText: {
    color: "#E0E0E0",
    fontSize: 14,
    fontFamily: "monospace",
    marginVertical: 2,
  },
});
