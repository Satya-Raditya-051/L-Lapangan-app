import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "rgb(25, 102, 227)",
        headerShown: false,
        tabBarStyle: {
          height: 125,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: "bold",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tugas Baru",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="file-tray-full-outline" size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="selesai"
        options={{
          title: "Selesai",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle" size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="akun"
        options={{
          title: "Akun",
          tabBarIcon: ({ color }) => (
            // Sesuaikan nama ikon dengan library yang kamu pakai (misal: FontAwesome, Ionicons)
            <Ionicons name="person-circle-outline" size={25} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
