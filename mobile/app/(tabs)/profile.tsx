import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { KenteStrip } from '@/components/KenteStrip';
import { Avatar } from '@/components/Avatar';

type SettingItem = {
  icon: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
};

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  async function handleAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0] || !user) return;
    setUploading(true);
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('messenger-avatars')
      .upload(path, blob, { upsert: true, contentType: `image/${ext}` });

    if (!error) {
      const { data } = supabase.storage.from('messenger-avatars').getPublicUrl(path);
      await supabase.from('messenger_profiles').update({ avatar_url: data.publicUrl }).eq('user_id', user.id);
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setUploading(false);
  }

  const MENU_GROUPS: { label: string; items: SettingItem[] }[] = [
    {
      label: 'Preferences',
      items: [
        { icon: 'notifications-outline', label: 'Notifications', sub: 'Manage alerts & sounds' },
        { icon: 'shield-outline', label: 'Privacy & Security', sub: 'Control who sees what' },
        { icon: 'settings-outline', label: 'Settings', sub: 'App preferences' },
      ],
    },
    {
      label: 'Account',
      items: [
        { icon: 'help-circle-outline', label: 'Help & FAQ', sub: 'Get support or send feedback' },
        { icon: 'information-circle-outline', label: 'About Loop', sub: 'V1 · African-first messenger' },
        { icon: 'log-out-outline', label: 'Sign Out', danger: true, onPress: handleSignOut },
      ],
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {/* Hero card */}
      <View style={styles.heroCard}>
        <KenteStrip height={4} />
        <View style={styles.heroBody}>
          <Pressable onPress={handleAvatar} style={styles.avatarWrap}>
            {uploading ? (
              <View style={[styles.avatarOuter, styles.avatarLoading]}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : (
              <View style={styles.avatarOuter}>
                <Avatar uri={profile?.avatar_url} name={profile?.display_name ?? profile?.username} size={76} />
                <View style={styles.cameraBtn}>
                  <Ionicons name="camera" size={12} color="#110D07" />
                </View>
              </View>
            )}
          </Pressable>

          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{profile?.display_name ?? 'No name'}</Text>
            <Text style={styles.heroUsername}>@{profile?.username ?? 'username'}</Text>
            {profile?.bio ? <Text style={styles.heroBio} numberOfLines={2}>{profile.bio}</Text> : null}
            <Text style={styles.heroPhone}>{profile?.phone ?? user?.phone ?? ''}</Text>
          </View>
        </View>
      </View>

      {/* Settings groups */}
      {MENU_GROUPS.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.groupCard}>
            {group.items.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.menuRow,
                  i < group.items.length - 1 && styles.menuRowBorder,
                  pressed && styles.menuRowPressed,
                ]}
              >
                <View style={[styles.menuIcon, item.danger && styles.menuIconDanger]}>
                  <Ionicons
                    name={item.icon as any}
                    size={18}
                    color={item.danger ? Colors.error : Colors.textSecondary}
                  />
                </View>
                <View style={styles.menuBody}>
                  <Text style={[styles.menuLabel, item.danger && { color: Colors.error }]}>
                    {item.label}
                  </Text>
                  {item.sub && <Text style={styles.menuSub}>{item.sub}</Text>}
                </View>
                {!item.danger && (
                  <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  heroCard: {
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  heroBody: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, gap: 16 },
  avatarWrap: {},
  avatarOuter: { position: 'relative' },
  avatarLoading: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  heroInfo: { flex: 1, gap: 3 },
  heroName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text },
  heroUsername: { fontSize: 13.5, color: Colors.primary, fontFamily: 'Inter_500Medium' },
  heroBio: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: 4 },
  heroPhone: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  group: { marginHorizontal: 16, marginBottom: 20 },
  groupLabel: {
    fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase',
    color: Colors.textMuted, fontFamily: 'Inter_600SemiBold',
    marginBottom: 10, paddingLeft: 4,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuRowPressed: { backgroundColor: 'rgba(212,162,50,0.06)' },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: Colors.errorDim },
  menuBody: { flex: 1 },
  menuLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text },
  menuSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1.5 },
});
