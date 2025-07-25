import axiosInstance from "./axiosInstance";

export async function search(params: string) {
  const response = await axiosInstance.get(
    `/friends/search?query=${params}&limit=10`
  );
  return response.data;
}
