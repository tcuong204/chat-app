import * as SecureStore from "expo-secure-store";

const ACCOUNT_KEY = "user_account";

export async function saveAccount(account: object) {
  await SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(account));
}

export async function getAccount(): Promise<object | null> {
  const result = await SecureStore.getItemAsync(ACCOUNT_KEY);
  return result ? JSON.parse(result) : null;
}

export async function deleteAccount() {
  await SecureStore.deleteItemAsync(ACCOUNT_KEY);
}
