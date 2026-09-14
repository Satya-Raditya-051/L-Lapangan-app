import { supabase } from "@/components/supabaseClient";
import Ionicons from "@expo/vector-icons/Ionicons"; // Tambahkan import icon
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

export default function AkunScreen() {
  // 1. Ambil data user/petugas DAN data tugas dari Redux
  const { user, petugas } = useSelector((state: any) => state.auth);
  const { jobsBaru, jobsProgress, jobsSelesai } = useSelector(
    (state: any) => state.tasks,
  );

  const handleLogout = async () => {
    Alert.alert("Konfirmasi Logout", "Apakah Anda yakin ingin logout?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
          } catch (error: any) {
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  const inisial = petugas?.nama_petugas
    ? petugas.nama_petugas.charAt(0).toUpperCase()
    : "U";

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil Akun</Text>
      </View>

      <View style={styles.content}>
        {/* Profil Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{inisial}</Text>
          </View>

          <Text style={styles.nameText}>
            {petugas?.nama_petugas || "Nama Tidak Ditemukan"}
          </Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {(petugas?.role || "Petugas").toUpperCase()}
            </Text>
          </View>
          <Text style={styles.emailText}>
            {user?.email || "Email Tidak Diketahui"}
          </Text>
        </View>

        {/* --- DASHBOARD RINGKASAN TUGAS --- */}
        <View style={styles.dashboardContainer}>
          <Text style={styles.sectionTitle}>Ringkasan Tugas Hari Ini</Text>

          <View style={styles.cardRow}>
            {/* KARTU 1: TUGAS BARU */}
            <View
              style={[
                styles.statCard,
                { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
              ]}
            >
              <View
                style={[styles.iconWrapper, { backgroundColor: "#FEE2E2" }]}
              >
                <Ionicons name="document-text" size={24} color="#EF4444" />
              </View>
              <Text style={styles.statNumber}>{jobsBaru?.length || 0}</Text>
              <Text style={styles.statLabel}>Tugas Baru</Text>
            </View>

            {/* KARTU 2: SEDANG DIKERJAKAN */}
            <View
              style={[
                styles.statCard,
                { backgroundColor: "#EFF6FF", borderColor: "#93C5FD" },
              ]}
            >
              <View
                style={[styles.iconWrapper, { backgroundColor: "#DBEAFE" }]}
              >
                <Ionicons name="construct" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.statNumber}>{jobsProgress?.length || 0}</Text>
              <Text style={styles.statLabel}>Diproses</Text>
            </View>

            {/* KARTU 3: SELESAI */}
            <View
              style={[
                styles.statCard,
                { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
              ]}
            >
              <View
                style={[styles.iconWrapper, { backgroundColor: "#DCFCE7" }]}
              >
                <Ionicons
                  name="checkmark-done-circle"
                  size={24}
                  color="#10B981"
                />
              </View>
              <Text style={styles.statNumber}>{jobsSelesai?.length || 0}</Text>
              <Text style={styles.statLabel}>Selesai</Text>
            </View>
          </View>
        </View>
        {/* --------------------------------- */}

        {/* Tombol Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#06a0e5",
    flex: 1,
  },
  header: {
    backgroundColor: "#06a0e5",
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  content: {
    backgroundColor: "#F3F4F6",
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20, // Sedikit dikurangi agar tidak terlalu jauh dari dashboard
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#06a0e5",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#06a0e5",
  },
  nameText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  roleText: {
    color: "#D97706",
    fontSize: 12,
    fontWeight: "bold",
  },
  emailText: {
    fontSize: 14,
    color: "#6B7280",
  },
  // --- STYLES UNTUK DASHBOARD ---
  dashboardContainer: {
    width: "100%",
    marginBottom: 24, // Jarak dengan tombol logout
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4B5563",
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10, // Jarak antar kotak
  },
  statCard: {
    flex: 1, // Agar lebar ketiga kotak merata
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  iconWrapper: {
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1F2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  // ------------------------------
  logoutBtn: {
    backgroundColor: "#EF4444",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    elevation: 2,
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
