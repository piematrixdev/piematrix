/**
 * LoginScreen — Required auth gate with Apple + Google sign-in.
 * Premium dark design matching the app's aesthetic.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, Dimensions, ActivityIndicator, Platform, Alert,
  TextInput, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from './supabaseClient';
import { useContent } from '../content/ContentContext';

const { width: W, height: H } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'TenorSans_400Regular';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { t } = useContent();
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // --- Apple Sign-In ---
  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) {
          Alert.alert('Sign in failed', error.message);
        }
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Google Sign-In ---
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'com.thepiematrix.app',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          // Extract tokens from the redirect URL (could be in hash or query)
          const url = result.url;
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          // Try hash fragment first (Supabase default)
          const hashIdx = url.indexOf('#');
          if (hashIdx !== -1) {
            const params = new URLSearchParams(url.substring(hashIdx + 1));
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          }
          // Fallback to query params
          if (!accessToken) {
            const qIdx = url.indexOf('?');
            if (qIdx !== -1) {
              const params = new URLSearchParams(url.substring(qIdx + 1));
              accessToken = params.get('access_token');
              refreshToken = params.get('refresh_token');
            }
          }

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Email/Password ---
  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    try {
      setLoading(true);
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) Alert.alert('Sign up failed', error.message);
        else Alert.alert('Check your email', 'We sent you a confirmation link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert('Sign in failed', error.message);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Forgot Password ---
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter your email', 'Please type your email address above, then tap "Forgot password" again.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'com.thepiematrix.app://auth/reset-password',
      });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Check your email', 'We sent you a password reset link. Open it to set a new password.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#030308', '#0a0a14', '#030308']}
        style={StyleSheet.absoluteFillObject}
      />
      <Image
        source={require('../../assets/acrylic-paint-planet-galaxy-astronomy-outdoors-galaxy.jpg')}
        style={[StyleSheet.absoluteFillObject, { width: W, height: H, opacity: 0.4 }]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(3,3,8,0.3)', 'rgba(3,3,8,0.7)', 'rgba(3,3,8,0.95)']}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

      {/* Top section — branding */}
      <View style={s.topSection}>
        <Image source={require('../../assets/pie-logo.png')} style={s.logo} />
        <Text style={s.appName}>{t('brand.name', 'Pie Matrix')}</Text>
        <Text style={s.tagline}>{t('brand.tagline', 'Your window to the cosmos')}</Text>
      </View>

      {/* Bottom section — auth buttons */}
      <View style={s.bottomSection}>
        <Text style={s.signInLabel}>{t('login.signin_label', 'Sign in to continue')}</Text>

        {/* Apple Sign-In (iOS only) */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={s.appleBtn} onPress={handleAppleSignIn} disabled={loading} activeOpacity={0.9}>
            <Text style={s.appleLogo}>&#xF8FF;</Text>
            <Text style={s.appleBtnText}>Continue with Apple</Text>
          </TouchableOpacity>
        )}

        {/* Google Sign-In */}
        <TouchableOpacity style={s.googleBtn} onPress={handleGoogleSignIn} disabled={loading} activeOpacity={0.9}>
          <Text style={s.googleG}>G</Text>
          <Text style={s.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Email/Password */}
        {!showEmail ? (
          <TouchableOpacity style={s.emailToggle} onPress={() => setShowEmail(true)} activeOpacity={0.9}>
            <Text style={s.emailToggleText}>Sign in with email</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.emailForm}>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={s.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity style={s.emailSubmitBtn} onPress={handleEmailAuth} disabled={loading} activeOpacity={0.9}>
              <Text style={s.emailSubmitText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{ marginTop: 12 }}>
              <Text style={s.switchText}>
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </Text>
            </TouchableOpacity>
            {!isSignUp && (
              <TouchableOpacity onPress={handleForgotPassword} style={{ marginTop: 10 }}>
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading && (
          <ActivityIndicator size="small" color="#d4c5a0" style={{ marginTop: 20 }} />
        )}

        {/* Terms */}
        <Text style={s.terms}>
          By continuing, you agree to our Terms of Service{'\n'}and Privacy Policy
        </Text>

        <Text style={s.pieBrand}>Pie Matrix</Text>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },

  topSection: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60,
  },
  logo: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#fff',
    resizeMode: 'contain', marginBottom: 20,
  },
  appName: {
    color: '#fff', fontSize: 36, fontFamily: F_TITLE, letterSpacing: -1,
  },
  tagline: {
    color: 'rgba(255,255,255,0.35)', fontSize: 15, fontFamily: F_LIGHT, marginTop: 8,
  },

  bottomSection: {
    paddingHorizontal: 28, paddingBottom: 50,
  },
  signInLabel: {
    color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: F_REG,
    textAlign: 'center', marginBottom: 20,
  },

  // Apple button — white, standard Apple style
  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', paddingVertical: 16, borderRadius: 14, marginBottom: 12,
  },
  appleLogo: { fontSize: 18, color: '#000' },
  appleBtnText: { color: '#000', fontSize: 15, fontFamily: F_BOLD },

  // Google button — outlined
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'transparent', paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  googleG: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { color: '#fff', fontSize: 15, fontFamily: F_BOLD },

  terms: {
    color: 'rgba(255,255,255,0.2)', fontSize: 11, fontFamily: F_LIGHT,
    textAlign: 'center', marginTop: 24, lineHeight: 17,
  },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: F_LIGHT, marginHorizontal: 14 },

  // Email toggle
  emailToggle: { alignItems: 'center', paddingVertical: 14 },
  emailToggleText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: F_REG },

  // Email form
  emailForm: { marginTop: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
    color: '#fff', fontSize: 15, fontFamily: F_REG,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emailSubmitBtn: {
    backgroundColor: '#d4c5a0', paddingVertical: 15, borderRadius: 12,
    alignItems: 'center', marginTop: 4,
  },
  emailSubmitText: { color: '#030308', fontSize: 15, fontFamily: F_BOLD },
  switchText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: F_REG, textAlign: 'center' },
  forgotText: { color: '#d4c5a0', fontSize: 12, fontFamily: F_REG, textAlign: 'center' },

  pieBrand: {
    color: 'rgba(255,255,255,0.12)', fontSize: 12, fontFamily: F_BOLD,
    textAlign: 'center', marginTop: 20, letterSpacing: 0.5,
  },
});
