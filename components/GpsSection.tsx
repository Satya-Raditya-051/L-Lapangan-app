import { useTheme } from "@/hooks/useTheme";
import * as Location from "expo-location";
import React, { memo, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

type Coordinate = {
  latitude: number;
  longitude: number;
};

interface GpsProps {
  onLocationFetched?: (location: Coordinate) => void;
  targetLocation?: Coordinate | null;
}

// Fungsi untuk memvalidasi koordinat dengan memastikan latitude dan longitude berada dalam rentang yang valid
const isValidCoordinate = (coordinate: Coordinate | null | undefined) =>
  coordinate !== null &&
  coordinate !== undefined &&
  Number.isFinite(coordinate.latitude) &&
  Number.isFinite(coordinate.longitude) &&
  coordinate.latitude >= -90 &&
  coordinate.latitude <= 90 &&
  coordinate.longitude >= -180 &&
  coordinate.longitude <= 180;

// Komponen GPSsection untuk menampilkan peta dan lokasi
const GPSsection = ({ onLocationFetched, targetLocation }: GpsProps) => {
  const { colors } = useTheme();
  const validTargetLocation = isValidCoordinate(targetLocation)
    ? targetLocation
    : null;
  const targetLatitude = validTargetLocation?.latitude;
  const targetLongitude = validTargetLocation?.longitude;
  const onLocationFetchedRef = useRef(onLocationFetched);
  onLocationFetchedRef.current = onLocationFetched;

  // 1. STATE KAMERA: Untuk mengatur area peta mana yang dilihat di layar
  const [mapRegion, setMapRegion] = useState({
    latitude: -6.2,
    longitude: 106.816666,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  //button custom untuk buka ke aplikasi google map
  const openInMaps = () => {
    if (targetLocation) {
      const url = `https://www.google.com/maps/search/?api=1&query=${targetLocation.latitude},${targetLocation.longitude}`;
      Linking.openURL(url);
    }
  };

  const getDirections = () => {
    if (targetLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${targetLocation.latitude},${targetLocation.longitude}`;
      Linking.openURL(url);
    }
  };

  // Fungsi untuk mengambil lokasi user
  useEffect(() => {
    let cancelled = false;
    let isFetching = false;

    async function loadLocation(isSilentRefresh = false) {
      if (isFetching) return;
      isFetching = true;
      setIsLoading(true);
      setErrorMsg(null);

      if (!isSilentRefresh) {
        setIsLoading(true);
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync(); // meminta izin akses lokasi dari user
        if (cancelled) return;
        // kalau user menolak izin akses lokasi, tampilkan pesan error dan hentikan proses
        if (status !== "granted") {
          setErrorMsg("Izin akses GPS ditolak");
          setIsLoading(false);
          return;
        }

        // Coba ambil lokasi dari cache HP terlebih dahulu
        let location = await Location.getLastKnownPositionAsync({});

        // Jika cache kosong, baru request lokasi baru ke sistem
        if (!location) {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }

        if (cancelled) return;

        if (!location) {
          throw new Error("Gagal mendapatkan kordinat lokasi");
        }

        setErrorMsg(null); // Hapus pesan error jika user baru saja mematikan Fake GPS

        // Pastikan kita menggunakan nama currentLoc di sini
        const currentLoc: Coordinate = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        if (!isValidCoordinate(currentLoc)) {
          throw new Error("Koordinat GPS tidak valid");
        }

        setCurrentLocation(currentLoc);

        if (targetLatitude !== undefined && targetLongitude !== undefined) {
          // Cari titik tengah antara posisi user dan posisi target
          const midLat = (currentLoc.latitude + targetLatitude) / 2;
          const midLon = (currentLoc.longitude + targetLongitude) / 2;

          const latDelta = Math.abs(currentLoc.latitude - targetLatitude) * 1.5;
          const lonDelta =
            Math.abs(currentLoc.longitude - targetLongitude) * 1.5;

          setMapRegion({
            latitude: midLat,
            longitude: midLon,
            latitudeDelta: Math.max(latDelta, 0.01),
            longitudeDelta: Math.max(lonDelta, 0.01),
          });
        } else {
          // Jika tidak ada target, zoom ke user seperti biasa
          setMapRegion({
            ...currentLoc,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }

        // Panggil onLocationFetched dengan variabel currentLoc
        onLocationFetchedRef.current?.(currentLoc);
        setIsLoading(false);
      } catch (error) {
        if (!cancelled) {
          console.error("Error mengambil lokasi:", error);
          setErrorMsg("Sinyal lokasi lambat atau tidak tersedia.");
          setIsLoading(false);
        }
      } finally {
        // Blok finally memastikan status state dikembalikan ke awal
        if (!cancelled) {
          setIsLoading(false);
          isFetching = false;
        }
      }
    }

    loadLocation();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // Jika aplikasi kembali ke layar utama (foreground)
      if (nextAppState === "active") {
        console.log("Aplikasi kembali dibuka, mengecek ulang lokasi...");
        loadLocation(); // Panggil fungsi cek lokasi lagi!
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [targetLatitude, targetLongitude]);

  return (
    <View>
      <View style={styles.mapWrapper}>
        {isLoading ? (
          <View style={[styles.map, styles.centerContent]}>
            <ActivityIndicator size="large" color={colors.text} />
            <Text
              style={{ marginTop: 12, color: colors.text, fontWeight: "500" }}
            >
              Mencari lokasi akurat...
            </Text>
          </View>
        ) : errorMsg ? (
          <View style={[styles.map, styles.centerContent, { padding: 20 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📍🚫</Text>
            <Text
              style={{
                color: "#EF4444",
                fontWeight: "bold",
                fontSize: 16,
                textAlign: "center",
              }}
            >
              {errorMsg}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Mohon buka pengaturan HP Anda dan izinkan akses lokasi agar bisa
              melaporkan progress.
            </Text>
          </View>
        ) : (
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            region={mapRegion}
            showsUserLocation={true}
            showsMyLocationButton={false}
            zoomControlEnabled={false}
            mapPadding={{ top: 70, right: 10, bottom: 10, left: 10 }}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
          >
            {validTargetLocation && (
              <Marker
                key="marker-target-location"
                coordinate={validTargetLocation}
                title="Target Pekerjaan"
                description="Titik lokasi kerusakan/perbaikan dari PDAM"
                pinColor="Red"
                tracksViewChanges={false}
              />
            )}
          </MapView>
        )}
      </View>

      {validTargetLocation && !isLoading && !errorMsg && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionBtn} onPress={openInMaps}>
            <Text style={styles.actionBtnText}>Buka di Maps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={getDirections}>
            <Text style={styles.actionBtnText}>Dapatkan Arah</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 20,
  },
  mapWrapper: {
    height: 350,
    width: "100%", // Tambahkan ini agar lebar peta selalu fix
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#e0e0e0", // Memberi warna dasar saat peta belum me-render
  },
  map: {
    width: "100%",
    height: "100%",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12, // Memberi jarak antar tombol
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    backgroundColor: "#3B82F6",
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffff",
  },
});

export default memo(GPSsection);
