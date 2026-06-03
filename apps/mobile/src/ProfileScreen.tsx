/**
 * ProfileScreen — User profile, settings, and account management.
 * Polished UI with gradient header, stats, and smooth interactions.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Alert, TextInput, Image, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft2, User, Logout, Edit2, Moon, Sun1,
  Location, Notification, Shield, InfoCircle, Camera,
  Star1, Calendar, Radar,
} from 'iconsax-react-native';
import { useAuth } from './auth/AuthContext';
import { supabase } from './auth/supabaseClient';

const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'TenorSans_400Regular';
const F_TITLE_SOFT = 'TenorSans_400Regular';

const ACCENT = '#d4c5a0';
const BG = '#030308';

interface ProfileScreenProps {
  onClose: () => void;
}

export default function ProfileScreen({ onClose }: ProfileScreenProps) {
  const { user, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  // Animations
  const headerScale = useRef(new Animated.Value(0.95)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  const email = user?.email ?? '';
  const avatarUrl = profileAvatarUrl ?? user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const provider = user?.app_metadata?.provider ?? 'email';
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
  const memberDays = user?.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // Fetch profile data
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('avatar_url, email_notifications, experience_level, interests, gear, custom_gear, bortle_default')
          .eq('id', user?.id)
          .single();
        if (data) {
          setProfileData(data);
          if (data.avatar_url) setProfileAvatarUrl(data.avatar_url);
          if (data.email_notifications) setEmailNotifs(true);
        }
      } catch {}
    })();
  }, [user?.id]);

  const handleChangePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0] || !user) return;

    const uri = result.assets[0].uri;
    try {
      const ext = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const fileName = `${user.id}/avatar.${ext}`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, uint8, { upsert: true, contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}` });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const newUrl = urlData.publicUrl + '?t=' + Date.now();

      await supabase.from('user_profiles').upsert({
        id: user.id,
        avatar_url: newUrl,
      });

      setProfileAvatarUrl(newUrl);
      Alert.alert('Updated', 'Profile photo changed.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to upload photo.');
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setEditing(false);
      Alert.alert('Updated', 'Your name has been updated.');
    }
  };

  const toggleEmailNotifications = async () => {
    const newVal = !emailNotifs;
    setEmailNotifs(newVal);
    await supabase.from('user_profiles').upsert({
      id: user?.id,
      email_notifications: newVal,
    });
    // Also toggle the daily push notification
    if (newVal) {
      const { scheduleDailySkyNotification } = require('./notifications/PushNotificationService');
      scheduleDailySkyNotification(19, 0);
    } else {
      const { cancelAllNotifications } = require('./notifications/PushNotificationService');
      cancelAllNotifications();
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Alert.alert('Contact Support', 'Please email support@thepiematrix.com to delete your account.');
          },
        },
      ]
    );
  };

  const experienceLabel = profileData?.experience_level
    ? profileData.experience_level.charAt(0).toUpperCase() + profileData.experience_level.slice(1)
    : 'Not set';

  const interestsCount = profileData?.interests?.length ?? 0;
  const gearCount = (profileData?.gear?.length ?? 0) + (profileData?.custom_gear?.length ?? 0);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero header with gradient */}
        <Animated.View style={[s.heroHeader, { transform: [{ scale: headerScale }] }]}>
          <LinearGradient
            colors={['rgba(212,197,160,0.15)', 'rgba(212,197,160,0.05)', 'transparent']}
            style={s.heroGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          {/* Navigation bar */}
          <View style={s.navBar}>
            <TouchableOpacity onPress={onClose} style={s.backBtn} activeOpacity={0.7}>
              <ArrowLeft2 size={20} color="#fff" variant="Linear" />
            </TouchableOpacity>
            <Text style={s.navTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Avatar + Name */}
          <View style={s.profileHero}>
            <TouchableOpacity style={s.avatarContainer} onPress={handleChangePhoto} activeOpacity={0.8}>
              <View style={s.avatarRing}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatar} />
                ) : (
                  <View style={s.avatarPlaceholder}>
                    <User size={36} color="rgba(255,255,255,0.4)" variant="Bold" />
                  </View>
                )}
              </View>
              <View style={s.cameraBadge}>
                <Camera size={13} color={BG} variant="Bold" />
              </View>
            </TouchableOpacity>

            {editing ? (
              <View style={s.editNameRow}>
                <TextInput
                  style={s.nameInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveName} disabled={saving}>
                  <Text style={s.saveBtnText}>{saving ? '...' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(false)} style={s.cancelBtn}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.nameRow} onPress={() => setEditing(true)} activeOpacity={0.7}>
                <Text style={s.userName}>{name || 'Set your name'}</Text>
                <Edit2 size={14} color="rgba(255,255,255,0.25)" variant="Linear" />
              </TouchableOpacity>
            )}

            <Text style={s.userEmail}>{email}</Text>

            {/* Provider + Level badges */}
            <View style={s.badgeRow}>
              <View style={s.badge}>
                <Shield size={12} color={ACCENT} variant="Bold" />
                <Text style={s.badgeText}>{provider}</Text>
              </View>
              <View style={s.badge}>
                <Star1 size={12} color={ACCENT} variant="Bold" />
                <Text style={s.badgeText}>{experienceLabel}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Stats row */}
        <Animated.View style={[s.statsRow, { opacity: fadeIn }]}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{memberDays}</Text>
            <Text style={s.statLabel}>Days</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{interestsCount}</Text>
            <Text style={s.statLabel}>Interests</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{gearCount}</Text>
            <Text style={s.statLabel}>Gear</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{profileData?.bortle_default ?? 5}</Text>
            <Text style={s.statLabel}>Bortle</Text>
          </View>
        </Animated.View>

        {/* Interests chips */}
        {profileData?.interests && profileData.interests.length > 0 && (
          <Animated.View style={[s.section, { opacity: fadeIn }]}>
            <Text style={s.sectionLabel}>INTERESTS</Text>
            <View style={s.chipsWrap}>
              {profileData.interests.map((interest: string) => (
                <View key={interest} style={s.chip}>
                  <Text style={s.chipText}>
                    {interest.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Preferences */}
        <Animated.View style={[s.section, { opacity: fadeIn }]}>
          <Text style={s.sectionLabel}>PREFERENCES</Text>
          <View style={s.card}>
            <SettingRow
              icon={<Moon size={20} color="#a78bfa" variant="Bulk" />}
              label="Theme"
              value="Dark"
            />
            <SettingRow
              icon={<Location size={20} color="#60a5fa" variant="Bulk" />}
              label="Location"
              value="Auto-detect"
            />
            <SettingRow
              icon={<Radar size={20} color={ACCENT} variant="Bulk" />}
              label="Bortle zone"
              value={`Class ${profileData?.bortle_default ?? 5}`}
            />
          </View>
        </Animated.View>

        {/* Notifications */}
        <Animated.View style={[s.section, { opacity: fadeIn }]}>
          <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.toggleRow} onPress={toggleEmailNotifications} activeOpacity={0.7}>
              <View style={s.toggleLeft}>
                <Notification size={20} color={emailNotifs ? ACCENT : 'rgba(255,255,255,0.4)'} variant="Bulk" />
                <View>
                  <Text style={s.settingLabel}>Nightly Sky Alert</Text>
                  <Text style={s.settingHint}>Daily notification at sunset with tonight's highlights</Text>
                </View>
              </View>
              <View style={[s.toggle, emailNotifs && s.toggleOn]}>
                <Animated.View style={[s.toggleDot, emailNotifs && s.toggleDotOn]} />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* About */}
        <Animated.View style={[s.section, { opacity: fadeIn }]}>
          <Text style={s.sectionLabel}>ABOUT</Text>
          <View style={s.card}>
            <SettingRow
              icon={<InfoCircle size={20} color="rgba(255,255,255,0.4)" variant="Bulk" />}
              label="Version"
              value="Beta v1.2"
            />
            <SettingRow
              icon={<Calendar size={20} color="rgba(255,255,255,0.4)" variant="Bulk" />}
              label="Member since"
              value={createdAt}
            />
            <SettingRow
              icon={<Sun1 size={20} color="rgba(255,255,255,0.4)" variant="Bulk" />}
              label="Made by"
              value="Pie Matrix"
            />
          </View>
        </Animated.View>

        {/* Actions */}
        <View style={s.actionsSection}>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Logout size={18} color="#ef4444" variant="Linear" />
            <Text style={s.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.6}>
            <Text style={s.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

function SettingRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={s.settingRow}>
      <View style={s.settingRowLeft}>
        {icon}
        <Text style={s.settingLabel}>{label}</Text>
      </View>
      <Text style={s.settingValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { paddingBottom: 40 },

  // Hero header
  heroHeader: {
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 58, paddingHorizontal: 20, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  navTitle: { color: '#fff', fontSize: 16, fontFamily: F_TITLE_SOFT, letterSpacing: 0.3 },

  // Profile hero
  profileHero: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  avatarContainer: { marginBottom: 16, position: 'relative' },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2.5, borderColor: 'rgba(212,197,160,0.4)',
    padding: 3,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 44 },
  avatarPlaceholder: {
    width: '100%', height: '100%', borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: BG,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { color: '#fff', fontSize: 24, fontFamily: F_TITLE, letterSpacing: -0.3 },
  userEmail: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 4 },

  // Badges
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(212,197,160,0.08)',
    borderWidth: 1, borderColor: 'rgba(212,197,160,0.15)',
  },
  badgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: F_REG, textTransform: 'capitalize' },

  // Edit name
  editNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, flexWrap: 'wrap', justifyContent: 'center' },
  nameInput: {
    flex: 1, minWidth: 160, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, color: '#fff', fontSize: 15, fontFamily: F_REG,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  saveBtn: { backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  saveBtnText: { color: BG, fontSize: 13, fontFamily: F_BOLD },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 11 },
  cancelBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: F_REG },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
    marginHorizontal: 20, marginTop: 20, marginBottom: 8,
    paddingVertical: 18, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: '#fff', fontSize: 20, fontFamily: F_BOLD },
  statLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 3, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Interests chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    backgroundColor: 'rgba(212,197,160,0.08)',
    borderWidth: 1, borderColor: 'rgba(212,197,160,0.15)',
  },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: F_REG },

  // Sections
  section: { marginHorizontal: 20, marginTop: 24 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: F_BOLD,
    letterSpacing: 1.5, marginBottom: 10, marginLeft: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },

  // Setting rows
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: F_REG },
  settingValue: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: F_LIGHT },
  settingHint: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 2 },

  // Toggle row
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 16,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: 'rgba(212,197,160,0.35)' },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.35)' },
  toggleDotOn: { backgroundColor: ACCENT, alignSelf: 'flex-end' },

  // Actions
  actionsSection: { marginTop: 32, paddingHorizontal: 20 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)',
  },
  logoutText: { color: '#ef4444', fontSize: 15, fontFamily: F_BOLD },
  deleteBtn: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  deleteText: { color: 'rgba(255,255,255,0.18)', fontSize: 12, fontFamily: F_LIGHT },
});
