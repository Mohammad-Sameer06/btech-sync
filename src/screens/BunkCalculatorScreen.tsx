import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getActiveProfileId, scopedKey } from '../utils/profileService';

type Subject = { id: string; name: string; attended: number; total: number; type: 'Lecture' | 'Lab' };

const BASE_ATTENDANCE_KEY = '@attendance_data';
const BASE_CALC_KEY = '@calc_settings';

const canMiss = (a: number, t: number, threshold: number) =>
  t === 0 ? 0 : Math.max(0, Math.floor((a * 100 - threshold * t) / threshold));

const needFor = (a: number, t: number, threshold: number) =>
  a * 100 >= threshold * t ? 0 : Math.ceil((threshold * t - a * 100) / (100 - threshold));

const pct = (a: number, t: number) =>
  t === 0 ? '0.0' : ((a / t) * 100).toFixed(1);

export default function BunkCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [minLevel, setMinLevel] = useState(75);
  const [targetLevel, setTargetLevel] = useState(85);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [minText, setMinText] = useState('75');
  const [targetText, setTargetText] = useState('85');

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setIsLoaded(false);
        const profileId = await getActiveProfileId();
        if (!profileId) { setIsLoaded(true); return; }
        try {
          const attRaw = await AsyncStorage.getItem(scopedKey(BASE_ATTENDANCE_KEY, profileId));
          if (attRaw) setSubjects(JSON.parse(attRaw));
          const calcRaw = await AsyncStorage.getItem(scopedKey(BASE_CALC_KEY, profileId));
          if (calcRaw) {
            const c = JSON.parse(calcRaw);
            if (c.bunkLevel) { setMinLevel(c.bunkLevel); setMinText(String(c.bunkLevel)); }
            if (c.targetGoal) { setTargetLevel(c.targetGoal); setTargetText(String(c.targetGoal)); }
          }
        } catch (e) { console.error(e); }
        setIsLoaded(true);
      };
      load();
    }, [])
  );

  const saveGoals = async (min: number, target: number) => {
    const profileId = await getActiveProfileId();
    if (!profileId) return;
    await AsyncStorage.setItem(scopedKey(BASE_CALC_KEY, profileId), JSON.stringify({ bunkLevel: min, targetGoal: target }));
  };

  const adjustMin = (delta: number) => {
    const next = Math.min(Math.max(minLevel + delta, 50), Math.min(94, targetLevel - 1));
    setMinLevel(next); setMinText(String(next)); saveGoals(next, targetLevel);
  };
  const adjustTarget = (delta: number) => {
    const next = Math.min(Math.max(targetLevel + delta, minLevel + 1), 99);
    setTargetLevel(next); setTargetText(String(next)); saveGoals(minLevel, next);
  };
  const commitMin = () => {
    const v = parseInt(minText);
    if (!isNaN(v)) {
      const next = Math.min(Math.max(v, 50), Math.min(94, targetLevel - 1));
      setMinLevel(next); setMinText(String(next)); saveGoals(next, targetLevel);
    } else { setMinText(String(minLevel)); }
  };
  const commitTarget = () => {
    const v = parseInt(targetText);
    if (!isNaN(v)) {
      const next = Math.min(Math.max(v, minLevel + 1), 99);
      setTargetLevel(next); setTargetText(String(next)); saveGoals(minLevel, next);
    } else { setTargetText(String(targetLevel)); }
  };

  if (!isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Overall totals
  const totalAttended = subjects.reduce((s, x) => s + x.attended, 0);
  const totalClasses  = subjects.reduce((s, x) => s + x.total, 0);
  const overallMiss   = canMiss(totalAttended, totalClasses, minLevel);
  const overallNeedMin = needFor(totalAttended, totalClasses, minLevel);
  const overallNeedTarget = needFor(totalAttended, totalClasses, targetLevel);
  const overallPct    = pct(totalAttended, totalClasses);
  const aboveMin      = parseFloat(overallPct) >= minLevel;
  const aboveTarget   = parseFloat(overallPct) >= targetLevel;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Bunk Calculator</Text>

      {/* ── Goal Settings ── */}
      <Text style={styles.sectionLabel}>Your Goals</Text>
      <View style={styles.card}>
        {/* Min row */}
        <View style={styles.goalRow}>
          <Text style={styles.goalEmoji}>🚨</Text>
          <Text style={styles.goalLabel}>Min</Text>
          <View style={styles.adjRow}>
            <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMin(-5)}>
              <Text style={styles.adjBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.adjInput}
              value={minText}
              onChangeText={setMinText}
              onBlur={commitMin}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            <Text style={styles.adjPct}>%</Text>
            <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMin(5)}>
              <Text style={styles.adjBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Target row */}
        <View style={styles.goalRow}>
          <Text style={styles.goalEmoji}>🎯</Text>
          <Text style={styles.goalLabel}>Target</Text>
          <View style={styles.adjRow}>
            <TouchableOpacity style={styles.adjBtn} onPress={() => adjustTarget(-5)}>
              <Text style={styles.adjBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.adjInput}
              value={targetText}
              onChangeText={setTargetText}
              onBlur={commitTarget}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            <Text style={styles.adjPct}>%</Text>
            <TouchableOpacity style={styles.adjBtn} onPress={() => adjustTarget(5)}>
              <Text style={styles.adjBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Overall Summary ── */}
      <Text style={styles.sectionLabel}>Overall</Text>
      {subjects.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calculator-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No subjects yet. Add classes in the Timetable tab.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {/* Big % display */}
          <View style={styles.overallTop}>
            <Text style={[styles.overallPct, { color: aboveMin ? '#059669' : '#DC2626' }]}>
              {overallPct}%
            </Text>
            <Text style={styles.overallRatio}>{totalAttended}/{totalClasses} classes</Text>
          </View>

          <View style={styles.divider} />

          {/* Bunk limit result */}
          <View style={styles.resultRow}>
            <View style={[styles.resultDot, { backgroundColor: aboveMin ? '#10B981' : '#EF4444' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resultLabel}>Bunk Limit ({minLevel}%)</Text>
              {aboveMin ? (
                <Text style={styles.resultGreen}>
                  You can skip <Text style={styles.resultNum}>{overallMiss}</Text> more class{overallMiss !== 1 ? 'es' : ''}
                </Text>
              ) : (
                <Text style={styles.resultRed}>
                  Attend <Text style={styles.resultNum}>{overallNeedMin}</Text> more classes to reach {minLevel}%
                </Text>
              )}
            </View>
          </View>

          <View style={styles.rowDivider} />

          {/* Target result */}
          <View style={styles.resultRow}>
            <View style={[styles.resultDot, { backgroundColor: aboveTarget ? '#3B82F6' : '#8B5CF6' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resultLabel}>Target ({targetLevel}%)</Text>
              {aboveTarget ? (
                <Text style={styles.resultBlue}>✅ You've reached your target!</Text>
              ) : (
                <Text style={styles.resultPurple}>
                  Attend <Text style={styles.resultNum}>{overallNeedTarget}</Text> more classes to reach {targetLevel}%
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ── Subject Breakdown button ── */}
      {subjects.length > 0 && (
        <>
          <TouchableOpacity
            style={styles.breakdownToggle}
            onPress={() => setShowBreakdown(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.breakdownToggleText}>Subject Breakdown</Text>
            <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={18} color="#6366F1" />
          </TouchableOpacity>

          {showBreakdown && subjects.map(item => {
            const p        = parseFloat(pct(item.attended, item.total));
            const safe     = p >= minLevel;
            const atTarget = p >= targetLevel;
            const miss     = canMiss(item.attended, item.total, minLevel);
            const needMin  = needFor(item.attended, item.total, minLevel);
            const needTgt  = needFor(item.attended, item.total, targetLevel);
            const typeColor = item.type === 'Lab' ? '#F59E0B' : '#6366F1';

            return (
              <View key={item.id} style={styles.subCard}>
                {/* Subject name + % */}
                <View style={styles.subHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subName} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.subType, { color: typeColor }]}>{item.type} · {item.attended}/{item.total}</Text>
                  </View>
                  <Text style={[styles.subPct, { color: safe ? '#059669' : '#DC2626' }]}>
                    {pct(item.attended, item.total)}%
                  </Text>
                </View>

                {/* Bunk row */}
                <View style={[styles.subResultRow, { backgroundColor: safe ? '#F0FDF4' : '#FEF2F2' }]}>
                  <Ionicons name={safe ? 'checkmark-circle' : 'warning'} size={14} color={safe ? '#059669' : '#DC2626'} />
                  <Text style={[styles.subResultText, { color: safe ? '#059669' : '#DC2626' }]} numberOfLines={1}>
                    {safe ? `Can skip ${miss} more class${miss !== 1 ? 'es' : ''}` : `Need ${needMin} more for ${minLevel}%`}
                  </Text>
                </View>

                {/* Target row */}
                <View style={[styles.subResultRow, { backgroundColor: atTarget ? '#EFF6FF' : '#F5F3FF', marginTop: 4 }]}>
                  <Ionicons name={atTarget ? 'flag' : 'flag-outline'} size={14} color={atTarget ? '#2563EB' : '#7C3AED'} />
                  <Text style={[styles.subResultText, { color: atTarget ? '#2563EB' : '#7C3AED' }]} numberOfLines={1}>
                    {atTarget ? `Target reached!` : `Need ${needTgt} more for ${targetLevel}%`}
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginHorizontal: 16, marginTop: 4, marginBottom: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginBottom: 8 },

  // Card base
  card: {
    marginHorizontal: 16, marginBottom: 20, backgroundColor: '#FFFFFF', borderRadius: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  rowDivider: { height: 1, backgroundColor: '#F9FAFB', marginHorizontal: 16 },

  // Setting rows — compact
  goalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  goalEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
  goalLabel: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  adjRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adjBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  adjBtnText: { fontSize: 18, fontWeight: '700', color: '#374151', lineHeight: 22 },
  adjInput: { width: 40, height: 32, borderRadius: 8, backgroundColor: '#F9FAFB', textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', padding: 0 },
  adjPct: { fontSize: 14, fontWeight: '700', color: '#6B7280' },

  // Overall
  overallTop: { alignItems: 'center', paddingVertical: 20 },
  overallPct: { fontSize: 56, fontWeight: '900' },
  overallRatio: { fontSize: 14, color: '#9CA3AF', fontWeight: '600', marginTop: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  resultDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  resultLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 3 },
  resultGreen: { fontSize: 14, fontWeight: '600', color: '#059669' },
  resultRed: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  resultBlue: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  resultPurple: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  resultNum: { fontSize: 16, fontWeight: '900' },

  // Breakdown toggle
  breakdownToggle: {
    marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: '#EEF2FF', borderRadius: 14,
  },
  breakdownToggleText: { fontSize: 14, fontWeight: '700', color: '#4338CA' },

  // Subject cards
  subCard: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 } }),
  },
  subHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  subName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  subType: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  subPct: { fontSize: 20, fontWeight: '900' },
  subResultRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  subResultText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // Empty
  emptyCard: { marginHorizontal: 16, alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 12, paddingHorizontal: 20 },
});
