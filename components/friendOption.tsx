import axiosInstance from "@/api/axiosInstance";
import { showError, showSuccess } from "@/utils/customToast";
import { formatMonthYearVi } from "@/utils/formatDateTime";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, {
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTabBar } from "../utils/tabBarContext";

interface Friend {
  avatar: string | null;
  name: string;
  friendId: string;
  friendedAt: string;
}
interface FriendOption {
  show?: boolean;
  setShow: React.Dispatch<SetStateAction<boolean>>;
  fetchFriends?: () => void;
  friendInfo: {
    avatar: string;
    name: string;
    friendId: string;
    friendedAt?: string;
  } | null;
}
const SCREEN_HEIGHT = Dimensions.get("window").height;

const FriendOption: React.FC<FriendOption> = ({
  show,
  setShow,
  friendInfo,
  fetchFriends,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { hideTabBar, showTabBar } = useTabBar();
  const handleDeleteFriend = async () => {
    // Xử lý hủy kết bạn
    Alert.alert("Hủy kết bạn", "Bạn có chắc chắn muốn xóa bạn bè này?", [
      {
        text: "Hủy",
        style: "cancel",
      },
      {
        text: "Xác nhận",
        style: "destructive",
        onPress: async () => {
          try {
            // Lấy access token từ SecureStore
            const account = await axiosInstance.delete(
              "/friends/" + friendInfo?.friendId
            );
            // Gọi API logout với accessToken
            if (account.status === 200) {
              showSuccess("Đã hủy kết bạn với " + friendInfo?.name);
              setShow(false);
              fetchFriends?.(); // Cập nhật danh sách bạn bè
            }

            // Chuyển về màn hình đăng nhập
          } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
            // Vẫn xóa local data và chuyển trang ngay cả khi API fail
            showError("Không thể hủy kết bạn");
            setShow(false);
          }
        },
      },
    ]);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      if (show) {
        bottomSheetRef.current?.expand();
        hideTabBar(); // Ẩn tab bar khi bottom sheet hiện lên
      } else {
        bottomSheetRef.current?.close();
        showTabBar(); // Hiện lại tab bar khi bottom sheet đóng
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [show, hideTabBar, showTabBar]);
  // Snap points: 50% chiều cao màn hình
  const snapPoints = useMemo(() => ["25%", "50%"], []);
  const renderBackdrop = useCallback(
    (prop: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop appearsOnIndex={1} disappearsOnIndex={0} {...prop} />
    ),
    []
  );
  // Đóng bottom sheet khi prop visible = false
  // Khi người dùng vuốt xuống hoặc bấm backdrop
  const handleSheetChanges = (index: number) => {
    if (index === -1) {
      setShow(false);
      showTabBar(); // Hiện lại tab bar khi bottom sheet đóng
    }
  };

  return friendInfo ? (
    <BottomSheet
      ref={bottomSheetRef}
      onChange={handleSheetChanges}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView>
        <View className=" flex flex-row p-4 items-center">
          <Image
            source={
              typeof friendInfo.avatar === "string"
                ? { uri: friendInfo.avatar }
                : friendInfo.avatar
            }
            style={{ width: 56, height: 56, borderRadius: 28, marginRight: 16 }}
            resizeMode="cover"
          />
          <View className="flex-1">
            <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 6 }}>
              {friendInfo.name}
            </Text>
            <Text style={{ color: "#888", fontSize: 12 }}>
              Là bạn từ {formatMonthYearVi(friendInfo.friendedAt ?? "")}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 16, marginLeft: 16 }}>
          <TouchableOpacity style={styles.actionRow}>
            <View style={styles.iconWrap}>
              <AntDesign name="message1" size={16} color="#a855f7" />
            </View>
            <Text className="text-base font-nunito">
              Nhắn tin cho {friendInfo.name}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow}>
            <View style={styles.iconWrap}>
              <FontAwesome name="ban" size={17} color="#a855f7" />
            </View>
            <Text className="text-base font-nunito">
              Chặn {friendInfo.name}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => handleDeleteFriend()}
          >
            <View style={styles.iconWrap}>
              <AntDesign name="deleteuser" size={16} color="#a855f7" />
            </View>
            <Text className="text-base font-nunito">
              Hủy kết bạn {friendInfo.name}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheet>
  ) : null;
};

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconWrap: {
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    padding: 8,
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
  },
});

export default FriendOption;
