import { createSlice } from "@reduxjs/toolkit";

const syncSlice = createSlice({
  name: "sync",
  initialState: {
    pendingUpdates: [], // Array untuk menyimpan form yang gagal terkirim (ngantre)
    isSyncing: false, // Penanda apakah aplikasi sedang dalam proses upload data ngantre
  },
  reducers: {
    // Menambahkan form ke dalam antrean offline
    addPendingUpdate: (state: any, action) => {
      //  ID unik (timestamp) agar mudah dihapus nanti setelah sukses terkirim
      const newUpdate = {
        ...action.payload,
        queueId: Date.now().toString(),
      };
      state.pendingUpdates.push(newUpdate);
    },

    // Menghapus form dari antrean setelah sukses masuk ke Supabase
    removePendingUpdate: (state: any, action) => {
      state.pendingUpdates = state.pendingUpdates.filter(
        (update: any) => update.queueId !== action.payload,
      );
    },

    // Mengubah status loading saat proses sinkronisasi latar belakang berjalan
    setSyncing: (state: any, action) => {
      state.isSyncing = action.payload;
    },

    // (Opsional) Membersihkan semua antrean jika user logout
    clearSyncQueue: (state: any) => {
      state.pendingUpdates = [];
      state.isSyncing = false;
    },
  },
});

export const {
  addPendingUpdate,
  removePendingUpdate,
  setSyncing,
  clearSyncQueue,
} = syncSlice.actions;
export default syncSlice.reducer;
