import { supabase } from "@/components/supabaseClient"; // Sesuaikan path
import { useTheme } from "@/hooks/useTheme";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// 1. IMPORT KOMPONEN GPS DAN FORM YANG SUDAH DIBUAT
import FormBagianTengah from "@/components/Forms"; // Sesuaikan path
import GpsSection from "@/components/GpsSection"; // Sesuaikan path
import Ionicons from "@expo/vector-icons/Ionicons"; // Pastikan sudah install @expo/vector-icons

export default function ProgressDetailScreen() {
  const { id } = useLocalSearchParams();
  const jobId = id;
  const { colors } = useTheme();

  const [jobDetail, setJobDetail] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [expandedPhotos, setExpandedPhotos] = useState<Record<string, boolean>>(
    {},
  );

  // Fungsi ini dipanggil saat pertama kali load, dan saat form sukses di-submit
  const fetchJobDetailAndTimeline = useCallback(async () => {
    try {
      setLoading(true);

      const { data: jobData, error: jobError } = await supabase
        .from("pekerjaan")
        .select("*")
        .eq("id", jobId)
        .single();

      if (jobError) throw jobError;
      setJobDetail(jobData);

      const { data: timelineData, error: timelineError } = await supabase
        .from("progres_pekerjaan")
        .select("*")
        .eq("pekerjaan_id", jobId)
        .order("created_at", { ascending: true });

      if (timelineError) throw timelineError;
      setTimeline(timelineData || []);
    } catch (error: any) {
      console.error("Error fetching detail:", error.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const togglePhoto = (itemId: string) => {
    setExpandedPhotos((prev) => ({
      ...prev,
      [itemId]: !prev[itemId], // Balikkan nilai boolean-nya
    }));
  };

  useEffect(() => {
    fetchJobDetailAndTimeline();
  }, [fetchJobDetailAndTimeline]);

  if (loading && !jobDetail) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.text }}>
          Memuat detail tugas...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.primary }}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons
            name="chevron-back-circle-outline"
            size={40}
            color={colors.surface}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.surface }]}>
          Progress Pekerjaan
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: colors.bg },
        ]}
        keyboardShouldPersistTaps="handled" // Agar tap tidak hilang saat keyboard muncul
        bounces={false} // Nonaktifkan efek bounce di iOS
      >
        {/* SECTION 1: Info Pekerjaan */}
        <View style={styles.infoSection}>
          <Text style={[styles.title, { color: colors.text }]}>
            {jobDetail?.judul_pekerjaan}
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
            📍 {jobDetail?.lokasi}
          </Text>
          <Text style={{ color: colors.text }}>{jobDetail?.deskripsi}</Text>
        </View>

        {/* SECTION 2: GPS Peta */}
        {/* Langsung panggil komponen GPS-nya di sini */}
        <View style={{ width: "100%", marginBottom: 16 }}>
          <GpsSection
            onLocationFetched={setCurrentLocation}
            targetLocation={
              jobDetail?.target_latitude && jobDetail?.target_longitude
                ? {
                    latitude: parseFloat(jobDetail.target_latitude),
                    longitude: parseFloat(jobDetail.target_longitude),
                  }
                : null
            }
          />
        </View>
        <View style={styles.divider} />

        {/* SECTION 3: Timeline Progress */}
        <View style={styles.timelineSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Riwayat Progress
          </Text>

          {timeline.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>
              Belum ada progress yang dicatat.
            </Text>
          ) : (
            timeline.map((item, index) => (
              <View key={item.id} style={styles.timelineItem}>
                {/* Bulatan pada timeline */}
                <View style={styles.timelineDot} />

                <Text
                  style={{
                    fontWeight: "bold",
                    color: colors.text,
                    fontSize: 16,
                  }}
                >
                  {item.status_progress}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  {new Date(item.created_at).toLocaleString("id-ID")}
                </Text>
                {item.catatan_petugas && (
                  <Text style={{ color: colors.text }}>
                    &quot;{item.catatan_petugas}&quot;
                  </Text>
                )}

                {/* Tampilkan foto bukti jika ada */}
                {item.foto_bukti_url && (
                  <TouchableOpacity
                    style={{ marginTop: 12, position: "relative" }}
                    activeOpacity={0.8}
                    onPress={() => togglePhoto(item.id)} // Eksekusi fungsi toggle
                  >
                    <Image
                      source={{ uri: item.foto_bukti_url }}
                      style={
                        expandedPhotos[item.id]
                          ? {
                              // STYLE SAAT EXPANDED (BESAR)
                              width: "100%",
                              aspectRatio: 3 / 4,
                              borderRadius: 12,
                              backgroundColor: "#000000",
                            }
                          : {
                              // STYLE SAAT THUMBNAIL (KECIL)
                              width: "100%",
                              height: 120,
                              borderRadius: 12,
                              backgroundColor: colors.border,
                            }
                      }
                      // Contain untuk full size, Cover untuk potongan thumbnail rapi
                      resizeMode={expandedPhotos[item.id] ? "contain" : "cover"}
                    />

                    {/* Lencana Petunjuk Muncul Hanya Saat Mode Thumbnail */}
                    {!expandedPhotos[item.id] && (
                      <View style={styles.expandOverlay}>
                        <Text style={styles.expandText}>
                          Tap untuk lihat penuh
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.divider} />

        {/* SECTION 4: Form Input Progress Baru */}
        <View style={styles.formSection}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginBottom: 16 },
            ]}
          >
            Update Progress
          </Text>

          {/* Panggil komponen Form dan lempar props jobId serta fungsi refresh */}
          <FormBagianTengah
            jobId={String(jobId)}
            onSuccessSubmit={fetchJobDetailAndTimeline}
            currentLocation={currentLocation} // Kirim lokasi GPS ke form
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    padding: 20,
    paddingBottom: 100, // Jarak aman untuk scroll di atas navbar bawah
  },
  infoSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginVertical: 20,
  },
  timelineSection: {
    marginBottom: 10,
  },
  timelineItem: {
    borderLeftWidth: 2,
    borderLeftColor: "#e2e8f0", // Warna biru untuk garis timeline
    paddingLeft: 20,
    paddingBottom: 24,
    position: "relative",
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3B82F6",
    position: "absolute",
    left: -8, // Menyesuaikan agar tepat di tengah garis
    top: 4,
  },
  formSection: {
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    position: "relative", // Penting agar title bisa absolute di tengah
    elevation: 2, // Shadow kecil untuk Android
    shadowColor: "#000", // Shadow untuk iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backBtn: {
    paddingVertical: 10,
    paddingRight: 20,
    zIndex: 2, // Memastikan tombol bisa diklik dan berada di atas judul
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
    zIndex: 1,
  },
  expandOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  expandText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
});
