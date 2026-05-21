import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

export default function Index() {
  const { session, profile, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      router.replace('/login');
    } else if (!profile?.onboarding_completed) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  }, [hydrated, session, profile]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
}
