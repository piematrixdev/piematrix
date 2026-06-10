/**
 * ResetPasswordScreen — Shown when user opens a password reset deep link.
 * Allows setting a new password.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, StatusBar, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from './AuthContext';

const F_LIGHT = 'Poppins-Light';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';

export default function ResetPasswordScreen() {
  const { updatePassword, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in both fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Your password has been updated.', [
        { text: 'OK', onPress: clearPasswordRecovery },
      ]);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#030308', '#0a0a14', '#030308']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.content}>
        <Text style={s.title}>Set New Password</Text>
        <Text style={s.subtitle}>Enter your new password below</Text>

        <TextInput
          style={s.input}
          placeholder="New password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
        />
        <TextInput
          style={s.input}
          placeholder="Confirm password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity style={s.btn} onPress={handleReset} disabled={loading} activeOpacity={0.9}>
          {loading ? (
            <ActivityIndicator color="#030308" />
          ) : (
            <Text style={s.btnText}>Update Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={clearPasswordRecovery} style={{ marginTop: 20 }}>
          <Text style={s.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { color: '#fff', fontSize: 28, fontFamily: F_TITLE, textAlign: 'center', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: F_LIGHT, textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12,
    color: '#fff', fontSize: 15, fontFamily: F_REG,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  btn: {
    backgroundColor: '#d4c5a0', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#030308', fontSize: 15, fontFamily: F_BOLD },
  skipText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: F_REG, textAlign: 'center' },
});
