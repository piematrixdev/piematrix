import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Timer1, ArrowLeft2, ArrowRight2, Refresh, Pause, Play } from 'iconsax-react-native';
import GlassCard from './GlassCard';

interface TimeTravelPanelProps {
  displayTime: Date;
  isRealTime: boolean;
  onAdjustHours: (hours: number) => void;
  onAdjustDays: (days: number) => void;
  onGoLive: () => void;
  onClose: () => void;
}

export default function TimeTravelPanel({
  displayTime, isRealTime, onAdjustHours, onAdjustDays, onGoLive, onClose,
}: TimeTravelPanelProps) {
  return (
    <>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />
      <GlassCard style={s.panel}>
        <View style={{ padding: 16 }}>
          {/* Header */}
          <View style={s.head}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Timer1 size={16} color="#d4c5a0" variant="Bulk" />
              <Text style={s.title}>Time Travel</Text>
            </View>
            {!isRealTime && (
              <TouchableOpacity style={s.liveBtn} onPress={onGoLive}>
                <Refresh size={14} color="#d4c5a0" variant="Bold" />
                <Text style={s.liveBtnText}>Now</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Current time display */}
          <View style={s.timeDisplay}>
            <Text style={s.timeMain}>
              {displayTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
            <Text style={s.timeDate}>
              {displayTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
            {isRealTime && (
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveBadgeText}>Live</Text>
              </View>
            )}
          </View>

          {/* Day controls */}
          <View style={s.controlRow}>
            <TouchableOpacity style={s.btn} onPress={() => onAdjustDays(-1)}>
              <ArrowLeft2 size={16} color="#fff" variant="Bold" />
              <Text style={s.btnText}>-1 day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={() => onAdjustDays(1)}>
              <Text style={s.btnText}>+1 day</Text>
              <ArrowRight2 size={16} color="#fff" variant="Bold" />
            </TouchableOpacity>
          </View>

          {/* Hour controls */}
          <View style={s.controlRow}>
            <TouchableOpacity style={s.btnSm} onPress={() => onAdjustHours(-6)}>
              <Text style={s.btnSmText}>-6h</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSm} onPress={() => onAdjustHours(-1)}>
              <Text style={s.btnSmText}>-1h</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnSm, isRealTime && s.btnActive]} onPress={onGoLive}>
              {isRealTime ? <Pause size={14} color="#d4c5a0" variant="Bold" /> : <Play size={14} color="#fff" variant="Bold" />}
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSm} onPress={() => onAdjustHours(1)}>
              <Text style={s.btnSmText}>+1h</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSm} onPress={() => onAdjustHours(6)}>
              <Text style={s.btnSmText}>+6h</Text>
            </TouchableOpacity>
          </View>

          {/* Time slider (visual) */}
          <View style={s.sliderRow}>
            <Text style={s.sliderLabel}>00:00</Text>
            <View style={s.sliderTrack}>
              <View style={[s.sliderFill, { width: `${((displayTime.getHours() * 60 + displayTime.getMinutes()) / 1440) * 100}%` }]} />
            </View>
            <Text style={s.sliderLabel}>24:00</Text>
          </View>
        </View>
      </GlassCard>
    </>
  );
}

const s = StyleSheet.create({
  panel: { position: 'absolute', bottom: 80, right: 12, left: 12, zIndex: 999 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  liveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(200,185,150,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveBtnText: { color: '#d4c5a0', fontSize: 12, fontWeight: '600' },
  timeDisplay: { alignItems: 'center', marginBottom: 14 },
  timeMain: { color: '#fff', fontSize: 32, fontWeight: '700', letterSpacing: 2 },
  timeDate: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  liveBadgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flex: 1, justifyContent: 'center' },
  btnText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  btnSm: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 44 },
  btnSmText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  btnActive: { backgroundColor: 'rgba(200,185,150,0.2)', borderWidth: 1, borderColor: '#d4c5a0' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sliderLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  sliderTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  sliderFill: { height: 4, backgroundColor: '#d4c5a0', borderRadius: 2 },
});
