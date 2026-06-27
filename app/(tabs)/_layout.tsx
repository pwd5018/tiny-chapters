import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DeveloperEnvironmentBanner } from "@/components/DeveloperEnvironmentBanner";
import { theme } from "@/theme/theme";

type TabIconName = "sunny-outline" | "albums-outline" | "search-outline" | "settings-outline";

function TabIcon({ name, color }: { name: TabIconName; color: string }) {
  return <Ionicons name={name} size={20} color={color} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <>
      <DeveloperEnvironmentBanner />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            color: theme.colors.textPrimary,
            fontSize: theme.typography.title,
            fontWeight: "700",
          },
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            height: 56 + bottomInset,
            paddingTop: 6,
            paddingBottom: bottomInset,
          },
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarLabelStyle: {
            fontSize: theme.typography.caption,
            fontWeight: "600",
          },
          sceneStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Today",
            tabBarIcon: ({ color }) => <TabIcon name="sunny-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="timeline"
          options={{
            title: "Timeline",
            tabBarIcon: ({ color }) => <TabIcon name="albums-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color }) => <TabIcon name="search-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => <TabIcon name="settings-outline" color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}
