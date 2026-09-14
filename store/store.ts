import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from "redux-persist";
import authReducer from "./authSlice";
import syncReducer from "./syncSlice";
import taskReducer from "./taskSlice";

const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["auth", "tasks", "sync"], // Hanya menyimpan state auth, tasks, dan sync
};

const rootReducer = combineReducers({
  auth: authReducer,
  tasks: taskReducer,
  sync: syncReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Abaikan pengecekan untuk action bawaan redux-persist agar tidak muncul warning merah
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// Export persistor untuk digunakan di Root Layout
export const persistor = persistStore(store);
