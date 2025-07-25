import Toast from "react-native-toast-message";

export const showSuccess = (message: string, title: string = "Thành công") => {
  Toast.show({
    type: "success",
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: 2500,
    autoHide: true,
    topOffset: 60,
  });
};

export const showError = (message: string, title: string = "Lỗi") => {
  Toast.show({
    type: "error",
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: 3000,
    autoHide: true,
    topOffset: 60,
  });
};

export const showInfo = (message: string, title: string = "Thông báo") => {
  Toast.show({
    type: "info",
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: 2500,
    autoHide: true,
    topOffset: 60,
  });
};

// Để sử dụng Toast, nhớ thêm <Toast /> vào root component (App.tsx hoặc _layout.tsx)
// import Toast from 'react-native-toast-message';
// ...
// <Toast />
