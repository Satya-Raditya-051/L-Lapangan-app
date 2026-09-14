import { createSlice } from "@reduxjs/toolkit";

const taskSlice = createSlice({
  name: "tasks",
  initialState: {
    jobsBaru: [],
    jobsProgress: [],
    jobsSelesai: [],
    lastSync: null as string | null,
  },
  reducers: {
    setTasks(state, action) {
      const { filterType, data } = action.payload;
      if (filterType === "baru") {
        state.jobsBaru = data;
      } else if (filterType === "progress") {
        state.jobsProgress = data;
      } else if (filterType === "selesai") {
        state.jobsSelesai = data;
      }
      state.lastSync = new Date().toISOString();
    },
    clearTasks(state) {
      state.jobsBaru = [];
      state.jobsProgress = [];
      state.jobsSelesai = [];
      state.lastSync = null;
    },
  },
});

export const { setTasks, clearTasks } = taskSlice.actions;
export default taskSlice.reducer;
