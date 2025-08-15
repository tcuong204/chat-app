import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export default function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // Hàm tạo animation nhún
  const bounce = (anim: Animated.Value, delay: number) => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: -6, // lên cao 6px
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    bounce(dot1, 0);
    bounce(dot2, 150);
    bounce(dot3, 300);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: dot1 }] }]}
      />
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: dot2 }] }]}
      />
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: dot3 }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 40,
    backgroundColor: "#f2f2f2",
    padding: 10,
    borderRadius: 50,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: "#666",
    marginHorizontal: 3,
  },
});
