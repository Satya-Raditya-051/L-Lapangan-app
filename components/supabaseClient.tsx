// supabaseClient.ts
// Polyfill ini WAJIB ditaruh paling atas untuk React Native
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import "react-native-url-polyfill/auto";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    console.log("mengambil key dari secure store:", key);
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    console.log("menyimpan key ke secure store:", key);
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    console.log("menghapus key dari secure store:", key);
    SecureStore.deleteItemAsync(key);
  },
};

// Mengambil URL dan Key dari environment variables (.env)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// Inisialisasi client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter, // Wajib ada agar sesi tidak hilang/nyangkut!
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
