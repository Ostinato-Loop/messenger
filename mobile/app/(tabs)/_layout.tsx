import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { KenteStrip } from '@/components/KenteStrip';

function TabBarBackground() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border }}>
      <KenteStrip height={2} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + (Platform.OS === 'web' ? 34 : insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: tabBarHeight,
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom,
          paddingTop: 6,
          elevation: 0,
        },
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarShowLabel: false,
        tabBarBackground: () => <TabBarBackground />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="loop"
        options={{
          tabBarIcon: ({ color }) => (
            <View style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: Colors.primaryDim,
              borderWidth: 1.5, borderColor: Colors.primaryBorder,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                borderWidth: 2.5, borderColor: color,
              }} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="call" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
