import { ColorScheme, useTheme } from "@/hooks/useTheme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Picker } from "@react-native-picker/picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// Pastikan path ini mengarah ke inisialisasi Supabase kamu yang benar
import { supabase } from "@/components/supabaseClient";
import { addPendingUpdate } from "@/store/syncSlice";
import ViewShot from "react-native-view-shot";
import { useDispatch } from "react-redux";

// Tambahkan Interface Props untuk menerima jobId dan fungsi refresh
interface FormProps {
  jobId: string;
  onSuccessSubmit: () => void; // Untuk me-refresh timeline setelah sukses
  currentLocation: { latitude: number; longitude: number } | null; // Untuk menerima lokasi GPS
}

export default function FormBagianTengah({
  jobId,
  onSuccessSubmit,
  currentLocation,
}: FormProps) {
  const [jobStats, setJobStats] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dispatch = useDispatch(); // Untuk mengakses dispatch Redux

  const { colors, isDarkMode } = useTheme();
  const styles = createFormStyles(colors);
  const viewShotRef = useRef<ViewShot>(null);

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert(
        " Izin galeri ditolak",
        "izinkan aplikasi memiliki akses galeri",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setFotoUri(result.assets[0].uri);
    }
  };

  //open cam
  const takePhoto = async () => {
    //minta izin aplikasi
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert(
        "Izin kamera ditolak",
        "izinkan aplikasi memiliki akses kamera",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss(); // Tutup keyboard saat submit

    // 1. Validasi Teks
    if (!jobStats || !deskripsi) {
      Alert.alert("Error", "Harap isi status dan deskripsi pekerjaan!");
      return;
    }

    // 2. Validasi Foto (Pengecualian khusus "Menuju Lokasi")
    if (jobStats !== "Menuju Lokasi" && !fotoUri) {
      Alert.alert("Error", "Foto bukti wajib dilampirkan untuk status ini!");
      return;
    }

    // 3. Validasi GPS (Memastikan currentLocation dari GpsSection sudah ada)
    if (!currentLocation) {
      Alert.alert(
        "Tunggu Sebentar",
        "Sedang mencari titik koordinat GPS Anda...",
      );
      return;
    }
    setIsLoading(true);

    try {
      let imageUrl = null; // Default diset null

      // 4. Proses Upload Foto (HANYA dieksekusi jika petugas memilih foto)
      if (fotoUri) {
        let finalFotoUri = fotoUri;

        //Watermarking
        if (viewShotRef.current && viewShotRef.current.capture) {
          finalFotoUri = await viewShotRef.current.capture();
        }
        const fileName = `foto_${Date.now()}.jpg`;
        // Ambil token sesi saat ini agar diizinkan upload oleh Supabase
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // Pastikan variabel URL ini sama dengan yang ada di file .env milikmu
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

        // Upload langsung lewat jalur Native (Bebas RAM Spike / Anti Crash!)
        const uploadResult = await FileSystem.uploadAsync(
          `${supabaseUrl}/storage/v1/object/job_photos/${fileName}`,
          finalFotoUri,
          {
            httpMethod: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string,
              "Content-Type": "image/jpeg",
            },
          },
        );

        if (uploadResult.status !== 200) {
          throw new Error("Gagal mengunggah foto ke server.");
        }

        // Ambil URL publiknya seperti biasa
        const { data: publicUrlData } = supabase.storage
          .from("job_photos")
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
      }

      // Insert ke tabel progres_pekerjaan (Termasuk kordinat GPS)
      const { error: insertError } = await supabase
        .from("progres_pekerjaan")
        .insert([
          {
            pekerjaan_id: jobId,
            status_progress: jobStats,
            catatan_petugas: deskripsi,
            foto_bukti_url: imageUrl, // Berisi URL gambar atau null
            latitude: currentLocation.latitude, //  Menyimpan data GPS
            longitude: currentLocation.longitude, // Menyimpan data GPS
          },
        ]);

      if (insertError) throw insertError;

      // 6. Update status_terkini di tabel master (pekerjaan)
      const { error: updateMasterError } = await supabase
        .from("pekerjaan")
        .update({ status_terkini: jobStats })
        .eq("id", jobId);

      if (updateMasterError) throw updateMasterError;

      Alert.alert("Sukses", "Progress lapangan berhasil diperbarui!");

      // Reset form
      setTimeout(() => {
        setJobStats("");
        setDeskripsi("");
        setFotoUri(null); // Menghapus gambar dengan aman

        if (onSuccessSubmit) onSuccessSubmit(); // Refresh data
      }, 500);

      // Refresh data
      if (onSuccessSubmit) {
        onSuccessSubmit();
      }
    } catch (error: any) {
      console.error("Gagal submit:", error.message);
      Alert.alert("Gagal", error.message || "Terjadi kesalahan sistem.");

      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("Network request failed") ||
        error.message.includes("Network") ||
        error.message.includes("koneksi")
      ) {
        // Tambahkan form ke antrean offline
        dispatch(
          addPendingUpdate({
            jobId,
            jobStats,
            deskripsi,
            fotoUri: fotoUri || null,
            currentLocation,
            latitude: currentLocation?.latitude,
            longitude: currentLocation?.longitude,
            timestamp: new Date().toISOString(),
          }),
        );

        // Beri tahu pengguna bahwa data akan dikirim saat koneksi kembali
        Alert.alert(
          "Koneksi Terputus",
          "Data Anda telah disimpan sementara dan akan dikirim saat koneksi internet kembali.",
        );

        // Reset form agar pengguna bisa melanjutkan pekerjaan
        setTimeout(() => {
          setJobStats("");
          setDeskripsi("");
          setFotoUri(null); // Menghapus gambar dengan aman
          if (onSuccessSubmit) onSuccessSubmit(); // Refresh data
        }, 500);
      } else {
        Alert.alert("Gagal", error.message || "Terjadi kesalahan sistem.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.label}>job stats</Text>
      <View style={styles.inputBox}>
        <Picker
          selectedValue={jobStats}
          onValueChange={(itemValue) => setJobStats(itemValue)}
          style={styles.pickerStyle}
          dropdownIconColor={colors.text}
          enabled={!isLoading}
        >
          <Picker.Item
            label="Pilih status..."
            value=""
            color={isDarkMode ? colors.textMuted : colors.text}
          />
          <Picker.Item
            label="Menuju Lokasi"
            value="Menuju Lokasi"
            color={isDarkMode ? colors.textMuted : colors.text}
          />
          <Picker.Item
            label="Pengecekan"
            value="Pengecekan"
            color={isDarkMode ? colors.textMuted : colors.text}
          />
          <Picker.Item
            label="Perbaikan Pipa"
            value="Perbaikan Pipa"
            color={isDarkMode ? colors.textMuted : colors.text}
          />
          <Picker.Item
            label="Selesai & Pembersihan"
            value="Selesai & Pembersihan"
            color={isDarkMode ? colors.textMuted : colors.text}
          />
        </Picker>
      </View>

      <Text style={styles.label}>deskripsi</Text>
      <TextInput
        style={[styles.inputBox, styles.textArea]}
        multiline={true}
        numberOfLines={4}
        value={deskripsi}
        onChangeText={setDeskripsi}
        placeholder="Masukkan catatan perbaikan..."
        placeholderTextColor={colors.textMuted}
        editable={!isLoading}
      />

      <Text style={styles.label}>foto bukti</Text>

      {fotoUri ? (
        // Preview foto, bisa di-tap untuk menghapus/mengganti foto
        <View style={{ position: "relative" }}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: "jpg", quality: 0.8 }}
            style={[styles.inputBox, styles.fotoArea]}
          >
            <Image source={{ uri: fotoUri }} style={styles.previewImage} />

            <View style={styles.watermarkContainer}>
              <Text style={styles.watermarkText}>
                {new Date().toLocaleDateString()}
              </Text>
              <Text style={styles.watermarkText}>
                {currentLocation
                  ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                  : "Lokasi GPS tidak tersedia"}
              </Text>
            </View>
          </ViewShot>

          <TouchableOpacity
            style={styles.hapusFotoOverlay}
            onPress={() => setFotoUri(null)}
            disabled={isLoading}
          >
            <Text style={styles.hapusFotoText}>
              Tap gambar untuk ganti foto
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Menampilkan dua pilihan jika foto belum ada
        <View style={styles.fotoButtonsWrapper}>
          <TouchableOpacity
            style={styles.fotoBtn}
            onPress={takePhoto}
            disabled={isLoading}
          >
            <Ionicons
              name="camera-outline"
              size={30}
              color={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontWeight: "600" }}>
              Ambil Dari Kamera
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fotoBtn}
            onPress={pickImage}
            disabled={isLoading}
          >
            <Ionicons name="image-outline" size={30} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontWeight: "600" }}>
              Ambil Dari Galeri
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons
                name="paper-plane-outline"
                size={20}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.submitText}>kirim</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const createFormStyles = (colors: ColorScheme) => {
  return StyleSheet.create({
    formContainer: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    label: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
      marginTop: 12,
      fontWeight: "700",
    },
    inputBox: {
      backgroundColor:
        colors.surface === "#ffffff" ? "#f8fafc" : colors.backgrounds.input,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    pickerStyle: {
      color: colors.text,
      height: 50,
    },
    textArea: {
      height: 100,
      paddingHorizontal: 20,
      paddingVertical: 16,
      color: colors.text,
      textAlignVertical: "top",
      fontSize: 17,
      fontWeight: "500",
    },
    fotoArea: {
      width: "100%",
      aspectRatio: 3 / 4, // Mengikuti rasio standar kamera HP (potret)
      backgroundColor: "#000000", // Memberi background hitam layaknya galeri
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 16,
      overflow: "hidden",
    },
    previewImage: {
      width: "100%",
      height: "100%",
      resizeMode: "contain",
    },
    submitContainer: {
      alignItems: "center",
      marginTop: 24,
    },
    submitButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 40,
      borderRadius: 999,
      minWidth: 120,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      elevation: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    submitText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "600",
    },
    fotoButtonsWrapper: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    fotoBtn: {
      flex: 1,
      height: 150,
      backgroundColor: colors.backgrounds.input,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: "#CBD5E1",
      borderStyle: "dashed", // Memberi efek garis putus-putus khas area upload
      justifyContent: "center",
      alignItems: "center",
    },
    hapusFotoOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      paddingVertical: 8,
      alignItems: "center",
    },
    hapusFotoText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "bold",
    },
    watermarkContainer: {
      position: "absolute",
      bottom: 8,
      right: 8,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      alignItems: "flex-end",
    },
    watermarkText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "bold",
    },
  });
};
