import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { KenteStrip } from '@/components/KenteStrip';

export default function OnboardingPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (!displayName.trim() || !username.trim()) {
      setError('Display name and username are required.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setError('Username: 3–20 chars, lowercase letters, numbers, underscores only.');
      return;
    }
    if (!user) return;
    setLoading(true);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Upsert profile
    const { error: upsertError } = await supabase
      .from('messenger_profiles')
      .upsert({
        user_id: user.id,
        phone: user.phone ?? null,
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        onboarding_completed: true,
      }, { onConflict: 'user_id' });

    if (upsertError) {
      setError(upsertError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Set up your profile</Text>
          <KenteStrip style={styles.kente} height={3} />
          <Text style={styles.subtitle}>How should your contacts know you?</Text>
        </View>

        {/* Avatar placeholder */}
        <View style={styles.avatarBox}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {displayName.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.avatarHint}>Photo can be added from Profile later</Text>
        </View>

        {/* Fields */}
        <View style={styles.fields}>
          <Field
            label="Display Name"
            placeholder="e.g. Amara Osei"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
          <Field
            label="Username"
            placeholder="e.g. amara_osei"
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            hint="3–20 chars · letters, numbers, underscores"
          />
          <Field
            label="Bio (optional)"
            placeholder="A short line about you…"
            value={bio}
            onChangeText={setBio}
            multiline
          />
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          onPress={handleContinue}
          disabled={loading}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          {loading
            ? <ActivityIndicator color="#110D07" size="small" />
            : <Text style={styles.primaryBtnText}>Enter Loop →</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, placeholder, value, onChangeText, autoCapitalize, autoCorrect, hint, multiline,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean; hint?: string; multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={[fieldStyles.input, multiline && fieldStyles.inputMulti]}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={autoCorrect ?? true}
        multiline={multiline}
        keyboardAppearance="dark"
        returnKeyType={multiline ? 'default' : 'next'}
      />
      {hint && <Text style={fieldStyles.hint}>{hint}</Text>}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: 'Inter_400Regular',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 11.5, color: Colors.textMuted },
});

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, flexGrow: 1, gap: 24 },
  header: { gap: 10 },
  title: { fontSize: 30, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: -0.5 },
  kente: { width: 40 },
  subtitle: { fontSize: 14, color: Colors.textSecondary },
  avatarBox: { alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryDim,
    borderWidth: 2.5, borderColor: Colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 38, fontFamily: 'Inter_700Bold', color: Colors.primary },
  avatarHint: { fontSize: 12, color: Colors.textMuted },
  fields: { gap: 16 },
  errorText: { fontSize: 13, color: Colors.error, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#110D07' },
});
