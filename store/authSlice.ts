import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null, // Data akun login (email, dll)
    petugas: null, // Data profil (nama_lengkap, role, is_active)
    isLoading: true,
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload.user;
      state.petugas = action.payload.petugas;
      state.isLoading = false;
    },
    clearUser: (state) => {
      state.user = null;
      state.petugas = null;
      state.isLoading = false;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setUser, clearUser, setLoading } = authSlice.actions;
export default authSlice.reducer;
