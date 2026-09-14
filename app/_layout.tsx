import { ThemeProvider } from "@/hooks/useTheme";
import * as NavigationBar from "expo-navigation-bar";
import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
} from "react-native";

import { supabase } from "@/components/supabaseClient";
import SyncManager from "@/components/SyncManager";
import { clearUser, setLoading, setUser } from "@/store/authSlice";
import { persistor, store } from "@/store/store";
import jailMonkey from "jail-monkey";
import { Provider, useDispatch, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

// Root navigation untuk mengatur navigasi berdasarkan status login
function RootNavigation() {
  const { user, isLoading } = useSelector((state: any) => state.auth);
  const segments = useSegments();
  const dispatch = useDispatch();

  //cek sesi dari database saat app baru dibuka
  //dan tiap kali status auth berubah (login/logout)
  useEffect(() => {
    //fungsi cek profil petugas & status aktif
    const checkPetugasProfile = async (SessionUser: any) => {
      try {
        console.log("A. Cek profil petugas untuk user:", SessionUser.id);
        if (Platform.OS === "android" && !__DEV__) {
          const isDevModeOn = await jailMonkey.isDevelopmentSettingsMode();
          if (isDevModeOn) {
            Alert.alert(
              "Akses Ditolak",
              "Aplikasi ini tidak dapat dijalankan karena mode pengembangan (Developer Mode) diaktifkan pada perangkat Anda. Silakan matikan mode pengembangan untuk melanjutkan.",
              [
                { text: "tutup", style: "cancel" },
                {
                  text: "buka pengaturan",
                  onPress: () => Linking.openSettings(),
                },
              ],
            );
            throw new Error("Mode pengembangan diaktifkan. Akses ditolak.");
          }
        }

        const { data: petugasData, error } = await supabase
          .from("petugas")
          .select("*")
          .eq("id", SessionUser.id)
          .single();

        if (error) {
          if (
            error.message.includes("failed to fetch") ||
            error.message.includes("Network request failed")
          ) {
            console.log("E. Koneksi internet bermasalah:", error.message);
            dispatch(setLoading(false));
            return;
          }
          throw error;
        }

        console.log(
          "B. Hasil dari database petugas:",
          petugasData,
          "| Error database:",
          error,
        );
        if (error || !petugasData) {
          throw new Error(
            "Profil tidak ditemukan atau terjadi kesalahan saat mengambil data profil.",
          );
        }
        if (petugasData.is_active === false) {
          throw new Error("Akun Anda telah dinonaktifkan oleh Admin.");
        }
        console.log("C. Semua aman! Mempersilakan masuk...");

        // jika data ada dan aktif, simpan ke redux
        dispatch(setUser({ user: SessionUser, petugas: petugasData }));
      } catch (error: any) {
        console.log("D. Akses Ditolak:", error.message);
        Alert.alert("Akses Ditolak", error.message);
        await supabase.auth.signOut();
        dispatch(clearUser());
      }
    };

    // Set loading aktif di awal pengecekan
    dispatch(setLoading(true));

    // 2. KEMBALIKAN getSession() SEBAGAI PENGECEK UTAMA SAAT APP DIBUKA
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await checkPetugasProfile(session.user);
      } else {
        // Penting: Jika tidak ada sesi, matikan loading agar tidak nyangkut!
        dispatch(clearUser());
      }
    });

    // listener untuk perubahan status login
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("onAuthStateChange event:", event);

      if (event === "INITIAL_SESSION") return; // Abaikan event INITIAL_SESSION karena sudah ditangani di atas
      if (session) {
        // Ambil data profile petugas dari database terlebih dahulu sebelum mengizinkan masuk
        await checkPetugasProfile(session.user);
      } else {
        // Jika tidak ada session / setelah logout
        dispatch(clearUser());
      }
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Hanya lakukan pengecekan JIKA aplikasi kembali aktif (foreground) DAN user sedang posisi login
      if (nextAppState === "active" && user) {
        if (Platform.OS === "android" && !__DEV__) {
          try {
            const isDevModeOn = await jailMonkey.isDevelopmentSettingsMode();

            if (isDevModeOn) {
              console.log(
                "⚠️ Bypass Developer Mode Terdeteksi saat aplikasi kembali aktif!",
              );

              Alert.alert(
                "Keamanan Sistem 🚫",
                "Opsi Pengembang (Developer Mode) diaktifkan secara paksa. Sesi Anda dihentikan demi keamanan.",
                [
                  {
                    text: "Buka Pengaturan",
                    onPress: () => {
                      Linking.sendIntent(
                        "android.settings.APPLICATION_DEVELOPMENT_SETTINGS",
                      ).catch(() => {});
                    },
                  },
                ],
              );

              // Log out dari Supabase
              await supabase.auth.signOut();
              // Hapus sesi dari Redux (otomatis akan melempar user ke halaman login)
              dispatch(clearUser());
            }
          } catch (error) {
            console.error("Gagal mengecek status Developer Mode:", error);
          }
        }
      }
    };

    // Daftarkan listener AppState
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Bersihkan listener jika komponen dihancurkan
    return () => {
      subscription.remove();
    };
  }, [user, dispatch]); // Dependency ditambahkan agar selalu mendapat data user & dispatch terbaru

  //redirect
  useEffect(() => {
    console.log(
      "🔄 CEK ROUTING -> isLoading:",
      isLoading,
      "| user ada?:",
      !!user,
      "| Segments:",
      segments,
    );
    if (isLoading) return; //jika masih loading, jangan redirect
    //if (!rootNavigationState?.key) return; //jika state navigasi belum siap, jangan redirect

    // Cek apakah user berada di dalam group auth (misal: login, register, dll)
    const inAuthGroup = segments[0] === "(auth)";

    const routingTimeout = setTimeout(() => {
      if (!user && !inAuthGroup) {
        console.log("➡️ Belum login, melempar ke Login...");
        router.replace("/(auth)/login");
      } else if (user && inAuthGroup) {
        console.log("➡️ Sudah login tapi di halaman auth, melempar ke Tabs...");
        router.replace("/(tabs)");
      } else if (user && segments.length === 0) {
        console.log("➡️ App baru dibuka, melempar ke Tabs...");
        router.replace("/(tabs)");
      }
    }, 10); // Jeda 10 milidetik
    return () => clearTimeout(routingTimeout); // Bersihkan timeout saat effect dibersihkan
  }, [user, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="progress-detail/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setButtonStyleAsync("dark"); // Ubah warna tombol navigation bar
    }
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <StatusBar
            backgroundColor="#06a0e5" // ubah warna latar belakang status bar
            style="light" // ubah tipe warna teks status bar
            translucent={false} // Pastikan tidak menimpa konten di bawahnya
          />
          <RootNavigation />
          <SyncManager />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}
