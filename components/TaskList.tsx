import { supabase } from "@/components/supabaseClient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { setTasks } from "@/store/taskSlice";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

// --- RUMUS HAVERSINE UNTUK MENGUKUR JARAK ---
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371; // Radius bumi dalam KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface TaskListProps {
  filterType: "baru" | "progress" | "selesai";
}

export default function TaskList({ filterType }: TaskListProps) {
  const { user } = useSelector((state: any) => state.auth);
  const { jobsBaru, jobsProgress, jobsSelesai } = useSelector(
    (state: any) => state.tasks,
  );
  const dispatch = useDispatch();

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- STATE LOKASI & SORTING ---
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [sortBy, setSortBy] = useState<
    "tanggal_terbaru" | "tanggal_terlama" | "jarak"
  >("tanggal_terbaru");
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const getOfflineData = useCallback(() => {
    if (filterType === "baru") return jobsBaru;
    if (filterType === "progress") return jobsProgress;
    if (filterType === "selesai") return jobsSelesai;
    return [];
  }, [filterType, jobsBaru, jobsProgress, jobsSelesai]);

  const [page, setPage] = useState(0);
  const [totalData, setTotalData] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { colors } = useTheme();

  const getHeaderTitle = () => {
    switch (filterType) {
      case "baru":
        return "Tugas Baru";
      case "progress":
        return "Progress";
      case "selesai":
        return "Selesai";
      default:
        return "";
    }
  };

  const getSummaryCard = () => {
    switch (filterType) {
      case "baru":
        return {
          bg: "#FEF2F2",
          border: "#FCA5A5",
          iconColor: "#EF4444",
          icon: "document-text",
          label: "Tugas belum dikerjakan",
        };
      case "progress":
        return {
          bg: "#EFF6FF",
          border: "#93C5FD",
          iconColor: "#3B82F6",
          icon: "construct",
          label: "Tugas sedang dikerjakan",
        };
      case "selesai":
        return {
          bg: "#F0FDF4",
          border: "#86EFAC",
          iconColor: "#10B981",
          icon: "checkmark-done-circle",
          label: "Tugas telah selesai",
        };
      default:
        return {
          bg: "#F3F4F6",
          border: "#D1D5DB",
          iconColor: "#4B5563",
          icon: "list",
          label: "Tugas",
        };
    }
  };

  const summary = getSummaryCard();

  // --- AMBIL LOKASI (GPS MALAS) ---
  useEffect(() => {
    const fetchUserLocation = async () => {
      if (filterType === "selesai") return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        let location = await Location.getLastKnownPositionAsync({});
        if (!location) {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
        }
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.log("Gagal ambil lokasi untuk sortir:", error);
      }
    };
    fetchUserLocation();
  }, [filterType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- FUNGSI HELPER UNTUK SORTING LOKAL & KALKULASI ---
  const processData = useCallback(
    (rawData: any[]) => {
      let processed = [...rawData];

      // 1. Hitung Jarak
      if (userLocation && filterType !== "selesai") {
        processed = processed.map((job) => {
          if (job.target_latitude && job.target_longitude) {
            const dist = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              parseFloat(job.target_latitude),
              parseFloat(job.target_longitude),
            );
            return { ...job, distanceKm: dist };
          }
          return { ...job, distanceKm: null };
        });
      }

      // 2. Terapkan Sorting Lokal
      processed.sort((a, b) => {
        const dateA = new Date(
          filterType === "baru" ? a.created_at : a.updated_at || a.created_at,
        ).getTime();
        const dateB = new Date(
          filterType === "baru" ? b.created_at : b.updated_at || b.created_at,
        ).getTime();

        if (sortBy === "tanggal_terbaru") return dateB - dateA;
        if (sortBy === "tanggal_terlama") return dateA - dateB;
        if (sortBy === "jarak" && filterType !== "selesai") {
          const distA =
            a.distanceKm !== null && a.distanceKm !== undefined
              ? a.distanceKm
              : 9999;
          const distB =
            b.distanceKm !== null && b.distanceKm !== undefined
              ? b.distanceKm
              : 9999;
          return distA - distB;
        }
        return 0;
      });

      return processed;
    },
    [userLocation, sortBy, filterType],
  );

  // --- MENGELOMPOKKAN DATA BERDASARKAN TANGGAL UNTUK SECTIONLIST ---
  const groupedJobs = React.useMemo(() => {
    const groups: { title: string; data: any[] }[] = [];

    jobs.forEach((job) => {
      const dateString =
        filterType === "baru"
          ? job.created_at
          : job.updated_at || job.created_at;
      let dateTitle = "Tanpa Tanggal";

      if (dateString) {
        const d = new Date(dateString);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        dateTitle = `${day}-${month}-${year}`; // Format: DD-MM-YYYY
      }

      const existingGroup = groups.find((g) => g.title === dateTitle);
      if (existingGroup) {
        existingGroup.data.push(job);
      } else {
        groups.push({ title: dateTitle, data: [job] });
      }
    });

    return groups;
  }, [jobs, filterType]);

  const fetchJobs = useCallback(
    async (pageNumber: number, searchText: string) => {
      if (!user || typeof user.id === "undefined") {
        setLoading(false);
        return;
      }
      try {
        const from = pageNumber * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
          .from("pekerjaan")
          .select("*", { count: "exact" })
          .eq("petugas_id", user.id);

        if (searchText) {
          query = query.or(
            `judul_pekerjaan.ilike.%${searchText}%,lokasi.ilike.%${searchText}%`,
          );
        }

        // --- PENGATURAN SORTING DARI SUPABASE ---
        const dateField = filterType === "baru" ? "created_at" : "updated_at";
        if (sortBy === "tanggal_terlama") {
          query = query.order(dateField, { ascending: true }); // Terlama
        } else {
          query = query.order(dateField, { ascending: false }); // Terbaru / Default
        }

        if (filterType === "baru") {
          query = query.or("status_terkini.is.null,status_terkini.eq.");
        } else if (filterType === "progress") {
          query = query.in("status_terkini", [
            "Menuju Lokasi",
            "Pengecekan",
            "Perbaikan Pipa",
          ]);
        } else if (filterType === "selesai") {
          query = query.eq("status_terkini", "Selesai & Pembersihan");
        }

        query = query.range(from, to);
        const { data, error, count } = await query;
        if (error) throw error;

        setJobs(processData(data || []));
        if (count !== null) setTotalData(count);

        if (pageNumber === 0 && !searchText) {
          dispatch(setTasks({ filterType, data: data || [] }));
        }
      } catch (error) {
        console.log("Offline mode aktif:", error);
        if (pageNumber === 0 && !searchText) {
          const offlineData = getOfflineData();
          setJobs(processData(offlineData));
          setTotalData(offlineData.length);
        } else {
          setJobs([]);
          setTotalData(0);
        }
      }
    },
    [filterType, user, dispatch, getOfflineData, processData, sortBy],
  );

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        if (jobs.length === 0) setLoading(true);
        await fetchJobs(page, debouncedQuery);
        setLoading(false);
      };
      loadData();
    }, [page, fetchJobs, debouncedQuery, jobs.length, sortBy]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs(page, debouncedQuery);
    setRefreshing(false);
  }, [page, fetchJobs, debouncedQuery]);

  const renderJobItem = ({ item: job }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({ pathname: `/progress-detail/${job.id}` as any })
      }
    >
      <Text style={styles.jobTitle}>{job.judul_pekerjaan}</Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={[styles.jobLocation, { flex: 1, marginBottom: 0 }]}>
          📍 {job.lokasi}
        </Text>

        {job.distanceKm !== undefined && job.distanceKm !== null && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>
              {job.distanceKm < 1
                ? `${(job.distanceKm * 1000).toFixed(0)} meter`
                : `${job.distanceKm.toFixed(1)} km`}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {job.status_terkini || "Tugas Baru"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.primary }}
      edges={["top", "left", "right"]}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
        </View>

        {/* --- AREA SEARCH & TOMBOL FILTER --- */}
        <View style={styles.searchContainer}>
          <View style={styles.InputWrapper}>
            <Ionicons
              name="search"
              size={20}
              color="#9CA3AF"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari tugas..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setIsFilterVisible(true)}
          >
            <Ionicons name="options" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          {/* ... kode search bar kamu ... */}
        </View>

        {/* --- MINI DASHBOARD CARD --- */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: summary.bg, borderColor: summary.border },
          ]}
        >
          <View style={styles.summaryIconWrapper}>
            <Ionicons
              name={summary.icon as any}
              size={32}
              color={summary.iconColor}
            />
          </View>
          <View style={styles.summaryTextWrapper}>
            <Text style={[styles.summaryNumber, { color: summary.iconColor }]}>
              {totalData}{" "}
              {/* Menggunakan state totalData yang sudah ada dari Supabase/Redux */}
            </Text>
            <Text style={styles.summaryLabel}>{summary.label}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <>
            {/* --- SECTION LIST UNTUK PEMISAH TANGGAL --- */}
            <SectionList
              sections={groupedJobs}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderJobItem}
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.dateSeparator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.dateSeparatorText}>{title}</Text>
                  <View style={styles.separatorLine} />
                </View>
              )}
              contentContainerStyle={styles.scrollContainer}
              ListEmptyComponent={() => (
                <View style={styles.centerContent}>
                  <Text style={{ color: "#6B7280" }}>
                    {searchQuery
                      ? "Tidak ada tugas yang cocok."
                      : "Kategori ini kosong."}
                  </Text>
                </View>
              )}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={"#3B82F6"}
                />
              }
              stickySectionHeadersEnabled={false} // Agar separator ikut scroll alami
            />

            {totalData > ITEMS_PER_PAGE && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                  disabled={page === 0}
                  onPress={() => setPage(page - 1)}
                >
                  <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <Text style={{ fontWeight: "bold", color: "#4A4A4A" }}>
                  Halaman {page + 1} / {Math.ceil(totalData / ITEMS_PER_PAGE)}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    (page + 1) * ITEMS_PER_PAGE >= totalData &&
                      styles.pageBtnDisabled,
                  ]}
                  disabled={(page + 1) * ITEMS_PER_PAGE >= totalData}
                  onPress={() => setPage(page + 1)}
                >
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* --- MODAL BOTTOM SHEET UNTUK SORTING --- */}
        <Modal
          visible={isFilterVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsFilterVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Urutkan Tugas</Text>
                <TouchableOpacity onPress={() => setIsFilterVisible(false)}>
                  <Ionicons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortBy === "tanggal_terbaru" && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortBy("tanggal_terbaru");
                  setIsFilterVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.sortText,
                    sortBy === "tanggal_terbaru" && styles.sortTextActive,
                  ]}
                >
                  Tanggal (Terbaru)
                </Text>
                {sortBy === "tanggal_terbaru" && (
                  <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortBy === "tanggal_terlama" && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortBy("tanggal_terlama");
                  setIsFilterVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.sortText,
                    sortBy === "tanggal_terlama" && styles.sortTextActive,
                  ]}
                >
                  Tanggal (Terlama)
                </Text>
                {sortBy === "tanggal_terlama" && (
                  <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>

              {filterType !== "selesai" && (
                <TouchableOpacity
                  style={[
                    styles.sortOption,
                    sortBy === "jarak" && styles.sortOptionActive,
                  ]}
                  onPress={() => {
                    setSortBy("jarak");
                    setIsFilterVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortText,
                      sortBy === "jarak" && styles.sortTextActive,
                    ]}
                  >
                    Jarak Terdekat
                  </Text>
                  {sortBy === "jarak" && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#3B82F6"
                    />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  scrollContainer: { padding: 10, paddingBottom: 10, flexGrow: 1 },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#8e9eab",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  jobLocation: { fontSize: 14, color: "#6B7280", marginBottom: 12 },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  statusText: { color: "#3B82F6", fontSize: 12, fontWeight: "700" },
  distanceBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  distanceText: { color: "#0284C7", fontWeight: "bold", fontSize: 12 },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderColor: "#E5E5E5",
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgb(6, 160, 229)",
    borderRadius: 999,
  },
  pageBtnDisabled: { backgroundColor: "#D1D5DB" },
  header: {
    fontSize: 40,
    backgroundColor: "rgb(6, 160, 229)",
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#F3F4F6",
    gap: 10,
  },
  InputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    height: 50,
    borderRadius: 999,
    paddingHorizontal: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: { flex: 1, fontSize: 16, color: "#1F2937", borderWidth: 0 },
  searchIcon: { marginRight: 8 },
  filterBtn: {
    height: 50,
    width: 50,
    backgroundColor: "rgb(6, 160, 229)",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },

  // --- STYLE UNTUK MODAL BOTTOM SHEET ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937" },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sortOptionActive: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
  },
  sortText: { fontSize: 16, color: "#4B5563", fontWeight: "500" },
  sortTextActive: { color: "#3B82F6", fontWeight: "bold" },

  // --- STYLE UNTUK PEMISAH TANGGAL (SECTION HEADER) ---
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: "#CBD5E1" },
  dateSeparatorText: {
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: "bold",
    color: "#64748B",
  },
  // --- STYLE UNTUK MINI DASHBOARD DI TAB ---
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  summaryIconWrapper: {
    marginRight: 16,
    backgroundColor: "rgba(255,255,255,0.6)", // Sedikit efek kaca
    padding: 8,
    borderRadius: 12,
  },
  summaryTextWrapper: {
    flex: 1,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
});
