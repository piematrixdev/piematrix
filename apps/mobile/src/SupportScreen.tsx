/**
 * SupportScreen — Help, FAQs and contact info.
 * Matches the dark premium design system.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import { ArrowLeft, MessageQuestion, Sms, Global, ArrowRight2 } from 'iconsax-react-native';

const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'TenorSans_400Regular';

interface SupportScreenProps { onClose: () => void }

const FAQ = [
  { q: 'How do I calibrate the AR view?', a: 'Hold your phone steady when entering the sky view. The compass calibrates automatically within a few seconds.' },
  { q: 'Why are some stars missing?', a: 'Star visibility depends on your Bortle scale setting (light pollution) and zoom level. Zoom in to reveal fainter stars.' },
  { q: 'How do I identify a star or planet?', a: 'Tap on any object in the sky view. A detail panel will appear with its name, magnitude, coordinates and more.' },
  { q: 'Does the app work offline?', a: 'The core sky view works offline once stars are loaded. The shop requires an internet connection.' },
  { q: 'Why does the sky look shaky?', a: 'At high zoom, hand tremor is amplified. The app applies smoothing automatically — hold your phone as steady as possible.' },
];

export default function SupportScreen({ onClose }: SupportScreenProps) {
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <ArrowLeft size={20} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* FAQ */}
        <Text style={s.sectionLabel}>Frequently Asked Questions</Text>
        {FAQ.map((item, i) => (
          <View key={i} style={s.faqItem}>
            <Text style={s.faqQ}>{item.q}</Text>
            <Text style={s.faqA}>{item.a}</Text>
          </View>
        ))}

        {/* Contact */}
        <Text style={[s.sectionLabel, { marginTop: 32 }]}>Get in Touch</Text>

        <TouchableOpacity style={s.contactRow} onPress={() => Linking.openURL('mailto:support@thepiematrix.com')}>
          <View style={s.contactIcon}>
            <Sms size={18} color="#fff" variant="Bulk" />
          </View>
          <View style={s.contactInfo}>
            <Text style={s.contactLabel}>Email</Text>
            <Text style={s.contactText}>support@thepiematrix.com</Text>
          </View>
          <ArrowRight2 size={16} color="rgba(255,255,255,0.3)" variant="Linear" />
        </TouchableOpacity>

        <TouchableOpacity style={s.contactRow} onPress={() => Linking.openURL('https://thepiematrix.com')}>
          <View style={s.contactIcon}>
            <Global size={18} color="#fff" variant="Bulk" />
          </View>
          <View style={s.contactInfo}>
            <Text style={s.contactLabel}>Website</Text>
            <Text style={s.contactText}>thepiematrix.com</Text>
          </View>
          <ArrowRight2 size={16} color="rgba(255,255,255,0.3)" variant="Linear" />
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 58, paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#161619', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontFamily: F_TITLE },

  scroll: { flex: 1, paddingHorizontal: 20 },

  sectionLabel: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_BOLD,
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 24, marginBottom: 14,
  },

  faqItem: {
    backgroundColor: '#141416', borderRadius: 16, padding: 18, marginBottom: 10,
  },
  faqQ: { color: '#fff', fontSize: 14, fontFamily: F_REG, lineHeight: 20 },
  faqA: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 10, lineHeight: 19 },

  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#141416', borderRadius: 16, padding: 16, marginBottom: 10,
  },
  contactIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  contactInfo: { flex: 1 },
  contactLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_LIGHT },
  contactText: { color: '#fff', fontSize: 14, fontFamily: F_REG, marginTop: 2 },
});
