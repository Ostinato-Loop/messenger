import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { RaldBox, type BoxState } from '@/components/RaldCorner';
import { KenteStrip } from '@/components/KenteStrip';

type Mode = 'signin' | 'join';
type Step = 'phone' | 'otp';

export default function LoginPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [boxState, setBoxState] = useState<BoxState>('idle');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failCount, setFailCount] = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const otpRefs = useRef<(TextInput | null)[]>([]);

  function shake() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }

  async function handleSendOtp() {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 8) {
      setBoxState('error');
      setErrorMsg('Enter a valid phone number');
      shake();
      return;
    }
    setLoading(true);
    setBoxState('typing');
    setErrorMsg('');

    // Send OTP via Termii (server-side) + Supabase phone auth
    const fullPhone = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setLoading(false);

    if (error) {
      setBoxState('error');
      setErrorMsg(error.message);
      shake();
      return;
    }
    setStep('otp');
    setBoxState('idle');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleVerifyOtp() {
    const code = otp.join('');
    if (code.length < 6) {
      setBoxState('error');
      setErrorMsg('Enter the 6-digit code');
      shake();
      return;
    }
    setLoading(true);
    setBoxState('typing');
    setErrorMsg('');

    const fullPhone = phone.replace(/\s/g, '');
    const formatted = fullPhone.startsWith('+') ? fullPhone : `+${fullPhone}`;
    const { error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: code,
      type: 'sms',
    });
    setLoading(false);

    if (error) {
      const count = failCount + 1;
      setFailCount(count);
      setBoxState('error');
      setErrorMsg(error.message);
      shake();
      return;
    }
    setBoxState('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => router.replace('/'), 600);
  }

  function handleOtpChange(val: string, idx: number) {
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    setBoxState(val ? 'typing' : 'idle');
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) otpRefs.current[idx - 1]?.focus();
  }

  async function resendOtp() {
    setOtp(['', '', '', '', '', '']);
    setFailCount(0);
    setBoxState('idle');
    await handleSendOtp();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoMark}>
            <View style={styles.logoInner} />
          </View>
          <KenteStrip style={styles.kente} height={3} />
          <Text style={styles.logoTitle}>Loop</Text>
          <Text style={styles.logoSub}>Stay close. Stay looped.</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          {(['signin', 'join'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => { setMode(m); setStep('phone'); setOtp(['','','','','','']); setErrorMsg(''); setBoxState('idle'); }}
              style={[styles.tab, mode === m && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* RALD Auth Box */}
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <RaldBox state={boxState} style={styles.box}>
            {step === 'phone' ? (
              <View style={styles.formInner}>
                <Text style={styles.label}>
                  {mode === 'signin' ? 'Your phone number' : 'Phone to register with'}
                </Text>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🌍</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(v) => { setPhone(v); setBoxState(v ? 'typing' : 'idle'); setErrorMsg(''); }}
                    placeholder="+234 800 000 0000"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    keyboardAppearance="dark"
                    autoComplete="tel"
                    returnKeyType="done"
                    onSubmitEditing={handleSendOtp}
                  />
                </View>

                {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                <Pressable
                  onPress={handleSendOtp}
                  disabled={loading}
                  style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#110D07" size="small" />
                    : <Text style={styles.primaryBtnText}>Send Code →</Text>
                  }
                </Pressable>
              </View>
            ) : (
              <View style={styles.formInner}>
                <Pressable onPress={() => { setStep('phone'); setBoxState('idle'); setErrorMsg(''); }} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← {phone}</Text>
                </Pressable>

                <Text style={styles.label}>6-digit code</Text>
                <Text style={styles.labelSub}>Sent to your phone via SMS</Text>

                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(r) => { otpRefs.current[i] = r; }}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(v, i)}
                      style={[styles.otpBox, digit && styles.otpBoxFilled]}
                      keyboardType="number-pad"
                      keyboardAppearance="dark"
                      maxLength={1}
                      textAlign="center"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
                {failCount >= 3 && (
                  <Pressable onPress={resendOtp} style={styles.resendBtn}>
                    <Text style={styles.resendText}>Wrong code too many times? Resend →</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.join('').length < 6}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (loading || otp.join('').length < 6) && styles.primaryBtnDisabled,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {loading
                    ? <ActivityIndicator color="#110D07" size="small" />
                    : <Text style={styles.primaryBtnText}>Verify & Continue →</Text>
                  }
                </Pressable>
              </View>
            )}
          </RaldBox>
        </Animated.View>

        <Text style={styles.footer}>Loop Messenger · Africa-first · End-to-end encrypted</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoMark: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.primaryDim,
    borderWidth: 2, borderColor: Colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoInner: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 3.5, borderColor: Colors.primary,
  },
  kente: { width: 48, marginBottom: 12 },
  logoTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: -0.5 },
  logoSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabTextActive: { color: '#110D07', fontFamily: 'Inter_700Bold' },
  box: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  formInner: { padding: 24, gap: 14 },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  labelSub: { fontSize: 12, color: Colors.textSecondary, marginTop: -10 },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  countryCodeText: { fontSize: 20 },
  phoneInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: Colors.text,
    fontFamily: 'Inter_400Regular',
  },
  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  otpBox: {
    width: 44, height: 54, borderRadius: 12,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1.5, borderColor: Colors.border,
    fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text,
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  errorText: { fontSize: 12.5, color: Colors.error, textAlign: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_500Medium' },
  resendBtn: { alignSelf: 'center' },
  resendText: { fontSize: 12.5, color: Colors.primary, textDecorationLine: 'underline' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: { backgroundColor: Colors.surfaceRaised },
  primaryBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#110D07' },
  footer: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 32 },
});
