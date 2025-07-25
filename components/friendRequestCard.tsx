import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface FriendRequestCardProps {
  avatar: string;
  name: string;
  time: string;
  onAccept: () => void;
  onDelete: () => void;
}

const FriendRequestCard: React.FC<FriendRequestCardProps> = ({
  avatar,
  name,
  time,
  onAccept,
  onDelete,
}) => {
  return (
    <View style={styles.container}>
      <Image source={{ uri: avatar }} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
      <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
        <Text style={styles.acceptText}>Xác nhận</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
        <Text style={styles.deleteText}>Xóa</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginVertical: 6,
    marginHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 2,
  },
  time: {
    color: "#888",
    fontSize: 12,
  },
  acceptBtn: {
    backgroundColor: "#6e00ff",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  acceptText: {
    color: "#fff",
    fontWeight: "bold",
  },
  deleteBtn: {
    backgroundColor: "#eee",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteText: {
    color: "#6e00ff",
    fontWeight: "bold",
  },
});

export default FriendRequestCard;
