import { supabase } from "@/components/supabaseClient";
import { removePendingUpdate, setSyncing } from "@/store/syncSlice";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

export default function SyncManager() {
  const dispatch = useDispatch();
  const { pendingUpdates, isSyncing } = useSelector((state: any) => state.sync);
  const [isOnline, setIsOnline] = useState(false);

  const hasFailedThisSession = useRef(false);

  //  Reset status syncing saat aplikasi baru pertama kali dibuka untuk mencegah deadlock
  useEffect(() => {
    dispatch(setSyncing(false));
  }, [dispatch]);

  //  Pantau sinyal hanya saat komponen dimuat untuk menghindari infinite loop
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);

      if (state.isConnected) {
        hasFailedThisSession.current = false;
      }
    });
    return () => unsubscribe();
  }, []); //  Array kosong mencegah infinite loop

  // Jalankan antrean jika syarat ini terpenuhi
  useEffect(() => {
    if (
      isOnline &&
      pendingUpdates.length > 0 &&
      !isSyncing &&
      !hasFailedThisSession.current
    ) {
      processQueue();
    }
  }, [isOnline, pendingUpdates.length, isSyncing]);

  const processQueue = async () => {
    dispatch(setSyncing(true));
    console.log(`Memulai sinkronisasi ${pendingUpdates.length} antrean...`);

    // Amankan data antrean ke variabel lokal agar tidak berubah di tengah jalan
    const queueToProcess = [...pendingUpdates];

    for (const item of queueToProcess) {
      try {
        let imageUrl = null;

        // Proses 1: Upload Foto (Jika Ada)
        if (item.fotoUri) {
          const fileName = `foto_offline_${Date.now()}.jpg`;
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

          const uploadResult = await FileSystem.uploadAsync(
            `${supabaseUrl}/storage/v1/object/job_photos/${fileName}`,
            item.fotoUri,
            {
              httpMethod: "POST",
              headers: {
                Authorization: `Bearer ${session?.access_token}`,
                apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string,
                "Content-Type": "image/jpeg",
              },
            },
          );

          if (uploadResult.status !== 200) throw new Error("Gagal upload foto");

          const { data } = supabase.storage
            .from("job_photos")
            .getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        }

        // Proses 2: Insert Database
        const { error: insertError } = await supabase
          .from("progres_pekerjaan")
          .insert([
            {
              pekerjaan_id: item.jobId,
              status_progress: item.jobStats,
              catatan_petugas:
                item.deskripsi + "\n(Dikirim via sinkronisasi otomatis)",
              foto_bukti_url: imageUrl,
              latitude: item.latitude,
              longitude: item.longitude,
              created_at: item.timestamp,
            },
          ]);

        if (insertError) throw insertError;

        // Proses 3: Update Master Database
        const { error: updateError } = await supabase
          .from("pekerjaan")
          .update({
            status_terkini: item.jobStats,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.jobId);

        if (updateError) throw updateError;

        dispatch(removePendingUpdate(item.queueId));
        console.log(`Berhasil sinkronisasi: ${item.jobStats}`);

        // Proses 4: Sukses! Hapus dari memori HP
        dispatch(removePendingUpdate(item.queueId));
        console.log(`Berhasil sinkronisasi: ${item.jobStats}`);
      } catch (error) {
        console.log(
          `Gagal sinkronisasi ${item.queueId}, sinyal mungkin putus lagi. Error:`,
          error,
        );

        hasFailedThisSession.current = true; // Tandai bahwa ada kegagalan sinkronisasi
        break; // Hentikan antrean, coba lagi nanti saat sinyal lebih stabil
      }
    }

    // Lepaskan status sibuk
    dispatch(setSyncing(false));
  };

  return null;
}
