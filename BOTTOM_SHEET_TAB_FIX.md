# Giải quyết vấn đề Bottom Sheet hiện lên mà vẫn còn Tabs

## Vấn đề

Khi bottom sheet hiện lên trong tab navigation, tab bar vẫn hiển thị ở dưới bottom sheet, gây ra trải nghiệm người dùng không tốt.

## Nguyên nhân

Bottom sheet được render bên trong tab navigation, nên khi bottom sheet hiện lên, tab bar vẫn hiển thị vì nó nằm ở cấp cao hơn trong component tree.

## Giải pháp đã áp dụng

### 1. Tạo TabBarContext

- Tạo context để quản lý trạng thái hiển thị của tab bar
- Cung cấp các function `hideTabBar()` và `showTabBar()` để điều khiển

### 2. Cập nhật Root Layout

- Wrap toàn bộ app trong `TabBarProvider`
- Đảm bảo context có sẵn ở mọi nơi trong app

### 3. Cập nhật Tab Layout

- Sử dụng `useTabBar()` hook để lấy trạng thái hiển thị
- Ẩn tab bar bằng cách set `display: "none"` khi `isTabBarVisible = false`

### 4. Cập nhật Bottom Sheet Components

- Trong `NewMessageModal` và `FriendOption`:
  - Gọi `hideTabBar()` khi bottom sheet hiện lên
  - Gọi `showTabBar()` khi bottom sheet đóng
  - Đảm bảo tab bar được hiện lại khi user đóng bottom sheet

## Cách sử dụng

### Trong component có bottom sheet:

```typescript
import { useTabBar } from "../utils/tabBarContext";

const MyComponent = () => {
  const { hideTabBar, showTabBar } = useTabBar();

  useEffect(() => {
    if (show) {
      hideTabBar(); // Ẩn tab bar
    } else {
      showTabBar(); // Hiện lại tab bar
    }
  }, [show]);
};
```

### Trong tab layout:

```typescript
import { useTabBar } from "../../utils/tabBarContext";

const TabLayout = () => {
  const { isTabBarVisible } = useTabBar();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          display: isTabBarVisible ? "flex" : "none",
          // ... other styles
        },
      }}
    >
      {/* Tab screens */}
    </Tabs>
  );
};
```

## Kết quả

- Tab bar sẽ tự động ẩn khi bottom sheet hiện lên
- Tab bar sẽ hiện lại khi bottom sheet đóng
- Trải nghiệm người dùng mượt mà và tự nhiên hơn
