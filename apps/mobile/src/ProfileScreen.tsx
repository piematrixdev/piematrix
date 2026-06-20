/**
 * ProfileScreen — Clean user profile with account info, preferences, and actions.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Alert, TextInput, RefreshControl, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft2, User, Logout, Edit2,
  Notification, Shield, Camera, Star1,
} from 'iconsax-react-native';
import { useAuth } from './auth/AuthContext';
import { supabase } from './auth/supabaseClient';
import SkyIcon from './components/SkyIcon';
import Constants from 'expo-constants';

const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';
const ACCENT = '#d4c5a0';
const BG = '#030308';
const { width: W } = Dimensions.get('window');

interface Props { onClose: () => void; onNavigate?: (screen: string) => void; }

export default function ProfileScreen({ onClose, onNavigate }: Props) {
  const { user, signOut, deleteAccount } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [notifs, setNotifs] = useState(true); // ON by default
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const email = user?.email ?? '';
  const displayAvatar = avatarUrl ?? user?.user_metadata?.avatar_url ?? null;
  const provider = user?.app_metadata?.provider ?? 'email';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const memberDays = user?.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? user.id;
    if (authData?.user?.user_metadata) {
      const meta = authData.user.user_metadata;
      if (meta.full_name) setName(meta.full_name);
      else if (meta.name) setName(meta.name);
      if (meta.phone) setPhone(meta.phone);
    }
    // Fetch profile row for avatar, interests, etc.
    const { data } = await supabase.from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data);
      if (data.avatar_url) { setAvatarUrl(data.avatar_url); Image.prefetch(data.avatar_url); }
      // Respect DB value: if explicitly false, turn off. If null/true, keep on.
      setNotifs(data.email_notifications !== false);
    }
  };

  useEffect(() => { fetchProfile(); }, [user?.id]);

  // Auto-open edit mode if phone is missing
  useEffect(() => {
    if (profile && !phone) setEditing(true);
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled || !result.assets[0] || !user) return;
    const uri = result.assets[0].uri;
    try {
      const ext = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const fileName = `${user.id}/avatar.${ext}`;
      const response = await fetch(uri);
      const buf = new Uint8Array(await response.arrayBuffer());
      await supabase.storage.from('avatars').upload(fileName, buf, { upsert: true, contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const url = data.publicUrl + '?t=' + Date.now();
      await supabase.from('user_profiles').upsert({ id: user.id, avatar_url: url });
      setAvatarUrl(url);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to upload photo.');
    }
  };

  const saveName = async () => {
    if (!name.trim()) return;
    if (!phone.trim()) { Alert.alert('Required', 'Please enter your phone number.'); return; }
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { full_name: name.trim(), phone: phone.trim() } });
      setEditing(false);
      await fetchProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update.');
    } finally { setSaving(false); }
  };

  const toggleNotifs = async () => {
    const val = !notifs;
    if (val) {
      // Opt-in: request notification permission now, in context. If the user
      // declines, leave the toggle off and point them to Settings.
      const Notifications = require('expo-notifications');
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications are off',
          'To get nightly sky alerts, enable notifications for Pie Matrix in your device Settings.',
          [{ text: 'OK' }],
        );
        return; // keep the toggle off
      }
      setNotifs(true);
      await supabase.from('user_profiles').update({ email_notifications: true }).eq('id', user?.id);
      try {
        const Push = require('./notifications/PushNotificationService');
        await Push.scheduleDailySkyNotification(19, 0);
        if (user?.id) await Push.registerForPushNotifications(user.id, true);
      } catch {}
    } else {
      setNotifs(false);
      await supabase.from('user_profiles').update({ email_notifications: false }).eq('id', user?.id);
      try {
        const { cancelAllNotifications } = require('./notifications/PushNotificationService');
        await cancelAllNotifications();
      } catch {}
    }
  };

  const logout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation to prevent accidents
            Alert.alert(
              'Are you absolutely sure?',
              'Your profile, favorites, and all personal data will be permanently removed.',
              [
                { text: 'Keep Account', style: 'cancel' },
                {
                  text: 'Delete Permanently',
                  style: 'destructive',
                  onPress: async () => {
                    const { error } = await deleteAccount();
                    if (error) {
                      Alert.alert('Error', error);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const experience = profile?.experience_level
    ? profile.experience_level.charAt(0).toUpperCase() + profile.experience_level.slice(1)
    : 'Stargazer';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4c5a0" />}
      >

        {/* Header */}
        <LinearGradient colors={['rgba(212,197,160,0.12)', 'transparent']} style={s.headerGrad} />
        <View style={s.nav}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <ArrowLeft2 size={20} color="#fff" variant="Linear" />
          </TouchableOpacity>
          <Text style={s.navTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar + Info */}
        <View style={s.profileSection}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={s.avatarWrap}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={s.avatar} cachePolicy="disk" />
            ) : (
              <View style={s.avatarEmpty}>
                <User size={36} color="rgba(255,255,255,0.3)" variant="Bold" />
              </View>
            )}
            <View style={s.cameraBadge}>
              <Camera size={12} color={BG} variant="Bold" />
            </View>
          </TouchableOpacity>

          {editing ? (
            <View style={s.editBlock}>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="rgba(255,255,255,0.3)" autoFocus />
              <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="phone-pad" />
              <View style={s.editBtns}>
                <TouchableOpacity style={s.saveBtn} onPress={saveName} disabled={saving}>
                  <Text style={s.saveBtnText}>{saving ? '...' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)} style={s.nameRow}>
              <Text style={s.name}>{name || 'Set your name'}</Text>
              <Edit2 size={14} color="rgba(255,255,255,0.2)" variant="Linear" />
            </TouchableOpacity>
          )}

          <Text style={s.email}>{email}</Text>
          {phone ? <Text style={s.phone}>{phone}</Text> : null}

          <View style={s.badges}>
            <View style={s.badge}>
              <Shield size={12} color={ACCENT} variant="Bold" />
              <Text style={s.badgeText}>{provider}</Text>
            </View>
            <View style={s.badge}>
              <Star1 size={12} color={ACCENT} variant="Bold" />
              <Text style={s.badgeText}>{experience}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statVal}>{memberDays}</Text>
            <Text style={s.statLbl}>Days</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={s.statVal}>{profile?.interests?.length ?? 0}</Text>
            <Text style={s.statLbl}>Interests</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={s.statVal}>{profile?.bortle_default ?? 5}</Text>
            <Text style={s.statLbl}>Bortle</Text>
          </View>
        </View>

        {/* Interests */}
        {profile?.interests?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>INTERESTS</Text>
            <View style={s.chips}>
              {profile.interests.map((i: string) => (
                <View key={i} style={s.chip}>
                  <Text style={s.chipText}>{i.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notifications */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
          <TouchableOpacity style={s.card} onPress={toggleNotifs} activeOpacity={0.7}>
            <View style={s.cardRow}>
              <SkyIcon name="satellite" size={20} color={notifs ? ACCENT : 'rgba(255,255,255,0.3)'} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Nightly Sky Alert</Text>
                <Text style={s.cardHint}>Get notified at sunset with tonight's highlights</Text>
              </View>
              <View style={[s.toggle, notifs && s.toggleOn]}>
                <View style={[s.dot, notifs && s.dotOn]} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ABOUT</Text>
          <View style={s.card}>
            <View style={s.infoRow}><Text style={s.infoLabel}>Member since</Text><Text style={s.infoVal}>{memberSince}</Text></View>
            <View style={s.infoRow}><Text style={s.infoLabel}>Version</Text><Text style={s.infoVal}>v{Constants.nativeAppVersion ?? '1.0'}</Text></View>
            <View style={[s.infoRow, { borderBottomWidth: 0 }]}><Text style={s.infoLabel}>Made by</Text><Text style={s.infoVal}>Pie Matrix</Text></View>
          </View>
        </View>

        {/* Features — all app screens grouped */}
        {onNavigate && (
          <View style={s.featuresSection}>
            <Text style={s.featuresTitle}>FEATURES</Text>
            <View style={s.featuresGrid}>
              {[
                { screen: 'skywatch', icon: '🔭', label: 'Sky View' },
                { screen: 'telescope', icon: '⭐', label: 'Telescope' },
                { screen: 'aichat', icon: '✨', label: 'Ask Orion' },
                { screen: 'calendar', icon: '📅', label: 'Calendar' },
                { screen: 'events', icon: '🌠', label: 'Events' },
                { screen: 'polarscope', icon: '🧭', label: 'Polar Scope' },
                { screen: 'shop', icon: '🛒', label: 'Shop' },
                { screen: 'feedback', icon: '💬', label: 'Feedback' },
              ].map((item) => (
                <TouchableOpacity key={item.screen} style={s.featureCard} activeOpacity={0.8} onPress={() => onNavigate(item.screen)}>
                  <Text style={s.featureEmoji}>{item.icon}</Text>
                  <Text style={s.featureLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Logout size={18} color="#ef4444" variant="Linear" />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete account */}
        <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.8}>
          <Text style={s.deleteText}>Delete Account</Text>
        </TouchableOpacity>

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: {},
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 58, paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  navTitle: { color: '#fff', fontSize: 16, fontFamily: F_BOLD },

  profileSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  avatarWrap: { marginBottom: 14 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(212,197,160,0.4)' },
  avatarEmpty: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: BG },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontSize: 22, fontFamily: F_TITLE },
  email: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 4 },
  phone: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 3 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(212,197,160,0.08)', borderWidth: 1, borderColor: 'rgba(212,197,160,0.15)' },
  badgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: F_REG, textTransform: 'capitalize' },

  editBlock: { width: '100%', paddingHorizontal: 24, gap: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: '#fff', fontSize: 15, fontFamily: F_REG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  editBtns: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 6 },
  saveBtn: { backgroundColor: ACCENT, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  saveBtnText: { color: BG, fontSize: 13, fontFamily: F_BOLD },
  cancelText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: F_REG, paddingVertical: 10 },

  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', marginHorizontal: 20, paddingVertical: 18, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  stat: { alignItems: 'center', flex: 1 },
  statVal: { color: '#fff', fontSize: 20, fontFamily: F_BOLD },
  statLbl: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 3 },
  statDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.06)' },

  section: { marginHorizontal: 20, marginTop: 24 },
  sectionLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: F_BOLD, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(212,197,160,0.08)', borderWidth: 1, borderColor: 'rgba(212,197,160,0.15)' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F_REG, textTransform: 'capitalize' },

  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  cardTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: F_REG },
  cardHint: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  infoLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: F_LIGHT },
  infoVal: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: F_REG },

  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: 'rgba(212,197,160,0.35)' },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: ACCENT, alignSelf: 'flex-end' },

  // Features grid
  featuresSection: { marginHorizontal: 20, marginTop: 28 },
  featuresTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' } as any,
  featureCard: { width: '22%', minWidth: 70, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' } as any,
  featureEmoji: { fontSize: 22, marginBottom: 6 },
  featureLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: F_REG, textAlign: 'center' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 20, marginTop: 32, paddingVertical: 16, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)' },
  logoutText: { color: '#ef4444', fontSize: 15, fontFamily: F_BOLD },
  deleteBtn: { alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginTop: 16, paddingVertical: 14, borderRadius: 16 },
  deleteText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: F_REG },
});
