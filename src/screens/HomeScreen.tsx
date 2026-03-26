import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getActiveProfileId, scopedKey } from '../utils/profileService';
import { useCustomAlert } from '../components/CustomAlert';

type Subject = {
  id: string;
  name: string;
  attended: number;
  total: number;
  type: 'Lecture' | 'Lab'; 
};

const BASE_ATTENDANCE_KEY = '@attendance_data';
const BASE_TIMETABLE_KEY = '@timetable_data';

export default function HomeScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [todayClasses, setTodayClasses] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'Today' | 'All'>('Today'); // New toggle state
  const [isLoaded, setIsLoaded] = useState(false);
  
  const insets = useSafeAreaInsets();
  const { showAlert, CustomAlert } = useCustomAlert();

  // Tracks which subject IDs have been logged today (resets daily)
  const [loggedToday, setLoggedToday] = useState<Set<string>>(new Set());
  // When non-null: waiting for user to pick a multiplier (1×/2×/3×)
  const [pendingLog, setPendingLog] = useState<{ id: string; status: 'Present' | 'Absent' } | null>(null);
  const [customCount, setCustomCount] = useState('');

  // Goal settings (managed in BunkCalculatorScreen)
  const [bunkLevel] = useState(75); // used only for isSafe colour

  const getTodayKey = (profileId: string) => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return `@logged_today_${profileId}_${dateStr}`;
  };


  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const profileId = await getActiveProfileId();
          if (!profileId) return;

          // 1. Load Attendance Data (scoped to this profile)
          const savedData = await AsyncStorage.getItem(scopedKey(BASE_ATTENDANCE_KEY, profileId));
          if (savedData !== null) {
            const parsedData = JSON.parse(savedData);
            const upgradedData = parsedData.map((sub: any) => ({
              ...sub, type: sub.type || 'Lecture'
            }));
            setSubjects(upgradedData);
          } else {
            setSubjects([]);
          }

          // 2. Load Timetable Data & Figure out what day it is
          const savedTimetable = await AsyncStorage.getItem(scopedKey(BASE_TIMETABLE_KEY, profileId));
          if (savedTimetable !== null) {
            const parsedTimetable = JSON.parse(savedTimetable);
            const currentDayIndex = new Date().getDay();
            const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const todayStr = DAYS[currentDayIndex];
            const scheduleForToday = parsedTimetable[todayStr] || [];
            const namesOfClassesToday = scheduleForToday.map((c: any) => c.subject.toLowerCase().trim());
            setTodayClasses(namesOfClassesToday);
          } else {
            setTodayClasses([]);
          }
          // 3. Load today's logged subjects
          const todayKey = getTodayKey(profileId);
          const todayRaw = await AsyncStorage.getItem(todayKey);
          if (todayRaw) setLoggedToday(new Set(JSON.parse(todayRaw)));
        } catch (e) {
          console.error('Failed to load data', e);

        } finally {
          setIsLoaded(true);
        }
      };
      loadData();
    }, [])
  );

  const saveSubjects = async (newData: Subject[]) => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) return;
      await AsyncStorage.setItem(scopedKey(BASE_ATTENDANCE_KEY, profileId), JSON.stringify(newData));
      setSubjects(newData);
    } catch (e) {
      console.error('Failed to save data', e);
    }
  };

  // Step 1: tap Present/Absent → show multiplier picker
  const handleLogClass = (id: string, status: 'Present' | 'Absent' | 'Cancelled') => {
    if (status === 'Cancelled') {
      showAlert({ type: 'info', title: 'Class Cancelled 🚫', message: 'Enjoy the free time! Your attendance math stays untouched.' });
      return;
    }
    setCustomCount('');
    setPendingLog({ id, status });
  };

  // Step 2: user picks multiplier → log and mark as done for today
  const confirmLog = async (multiplier: number) => {
    if (!pendingLog) return;
    const { id, status } = pendingLog;
    setPendingLog(null);

    const updatedSubjects = subjects.map(sub => {
      if (sub.id !== id) return sub;
      return {
        ...sub,
        attended: status === 'Present' ? sub.attended + multiplier : sub.attended,
        total: sub.total + multiplier,
      };
    });
    saveSubjects(updatedSubjects);

    // Persist today's log
    const profileId = await getActiveProfileId();
    if (profileId) {
      const newLogged = new Set(loggedToday).add(id);
      setLoggedToday(newLogged);
      await AsyncStorage.setItem(getTodayKey(profileId), JSON.stringify([...newLogged]));
    }
  };


  const deleteSubject = (id: string) => {
    showAlert({
      type: 'delete',
      title: 'Drop This Subject?',
      message: 'This will remove the subject and all its attendance data.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => saveSubjects(subjects.filter(sub => sub.id !== id)) },
      ],
    });
  };

  const calculatePercentage = (attended: number, total: number) => {
    if (total === 0) return 0;
    return ((attended / total) * 100).toFixed(1);
  };

  // Stats calculate based on ALL subjects, so your dashboard is always accurate
  const totalClasses = subjects.reduce((sum, sub) => sum + sub.total, 0);
  const totalAttended = subjects.reduce((sum, sub) => sum + sub.attended, 0);
  const labSubjects = subjects.filter(s => s.type === 'Lab');
  const labTotal = labSubjects.reduce((sum, sub) => sum + sub.total, 0);
  const labAttended = labSubjects.reduce((sum, sub) => sum + sub.attended, 0);
  const theorySubjects = subjects.filter(s => s.type === 'Lecture');
  const theoryTotal = theorySubjects.reduce((sum, sub) => sum + sub.total, 0);
  const theoryAttended = theorySubjects.reduce((sum, sub) => sum + sub.attended, 0);

  // 3. The Filter Logic
  const displaySubjects = viewMode === 'Today' 
    ? subjects.filter(sub => todayClasses.includes(sub.name.toLowerCase().trim()))
    : subjects;

  const renderSubject = ({ item }: { item: Subject }) => {
    const percentage = calculatePercentage(item.attended, item.total);
    const isSafe = parseFloat(percentage as string) >= bunkLevel;
    const typeColor = item.type === 'Lab' ? '#F59E0B' : '#3B82F6';
    const badgeBg = item.type === 'Lab' ? '#FEF3C7' : '#DBEAFE';
    const isLogged = loggedToday.has(item.id);
    const isPending = pendingLog?.id === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardMain}>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.subjectName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.badgeText, { color: typeColor }]}>{item.type}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <Text style={styles.stats}>{item.attended}/{item.total}</Text>
              <Text style={[styles.percentage, { color: isSafe ? '#10B981' : '#EF4444' }]}>
                {percentage}%
              </Text>
              <TouchableOpacity onPress={() => deleteSubject(item.id)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── State 1: Already logged today ── */}
        {isLogged && (
          <View style={styles.loggedBar}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.loggedText}>Logged for today ✓</Text>
          </View>
        )}

        {/* ── State 2: Multiplier picker (pending) ── */}
        {!isLogged && isPending && (
          <View style={styles.multiplierBar}>
            <Text style={styles.multiplierLabel}>How many?</Text>
            {[1, 2, 3].map(n => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.multiplierBtn,
                  pendingLog.status === 'Present' ? styles.multiplierPresent : styles.multiplierAbsent,
                ]}
                onPress={() => confirmLog(n)}
              >
                <Text style={styles.multiplierBtnText}>{n}/{n}</Text>
              </TouchableOpacity>
            ))}
            {/* Custom input */}
            <View style={styles.customInputWrap}>
              <TextInput
                style={[
                  styles.customInput,
                  pendingLog.status === 'Present' ? styles.multiplierPresent : styles.multiplierAbsent,
                ]}
                value={customCount}
                onChangeText={v => setCustomCount(v.replace(/[^0-9]/g, ''))}
                placeholder="?"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={2}
              />
              {customCount.length > 0 && (
                <TouchableOpacity
                  style={styles.customConfirm}
                  onPress={() => {
                    const n = parseInt(customCount);
                    if (n > 0) confirmLog(n);
                  }}
                >
                  <Ionicons name="checkmark" size={16} color="#10B981" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.multiplierCancel} onPress={() => setPendingLog(null)}>
              <Ionicons name="close" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── State 3: Normal action buttons ── */}
        {!isLogged && !isPending && (
          <View style={styles.actionBar}>
            <TouchableOpacity style={[styles.actionBtn, styles.btnPresent]} onPress={() => handleLogClass(item.id, 'Present')}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={[styles.actionText, { color: '#10B981' }]}>Present</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={[styles.actionBtn, styles.btnAbsent]} onPress={() => handleLogClass(item.id, 'Absent')}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={[styles.actionText, { color: '#EF4444' }]}>Absent</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={[styles.actionBtn, styles.btnCancelled]} onPress={() => handleLogClass(item.id, 'Cancelled')}>
              <Ionicons name="ban" size={20} color="#F59E0B" />
              <Text style={[styles.actionText, { color: '#F59E0B' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const navigation = useNavigation<any>();

  if (!isLoaded) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#10B981" /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>Overview</Text>

      <View style={styles.statsDashboard}>
        <View style={[styles.statBox, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.statLabel, { color: '#065F46' }]}>Total</Text>
          <Text style={[styles.statValue, { color: parseFloat(calculatePercentage(totalAttended, totalClasses) as string) >= 75 ? '#047857' : '#B91C1C' }]}>
            {calculatePercentage(totalAttended, totalClasses)}%
          </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.statLabel, { color: '#1E40AF' }]}>Theory</Text>
          <Text style={[styles.statValue, { color: '#1D4ED8' }]}>
            {calculatePercentage(theoryAttended, theoryTotal)}%
          </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.statLabel, { color: '#92400E' }]}>Lab</Text>
          <Text style={[styles.statValue, { color: '#B45309' }]}>
            {calculatePercentage(labAttended, labTotal)}%
          </Text>
        </View>
      </View>
      
      {/* 4. The View Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleBtn, viewMode === 'Today' && styles.toggleActive]} 
          onPress={() => setViewMode('Today')}
        >
          <Text style={[styles.toggleText, viewMode === 'Today' && styles.toggleTextActive]}>Today's Classes</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleBtn, viewMode === 'All' && styles.toggleActive]} 
          onPress={() => setViewMode('All')}
        >
          <Text style={[styles.toggleText, viewMode === 'All' && styles.toggleTextActive]}>All Subjects</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displaySubjects}
        keyExtractor={(item) => item.id}
        renderItem={renderSubject}
        contentContainerStyle={styles.listContainer} 
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name={viewMode === 'Today' ? "calendar-clear-outline" : "book-outline"} size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {viewMode === 'Today' ? "No classes today! 🎉" : "Go to Timetable tab to add your classes."}
            </Text>
          </View>
        }
      />

      <CustomAlert />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  headerTitle: { color: '#111827', fontSize: 28, fontWeight: '800', marginHorizontal: 15, marginBottom: 15 },
  
  statsDashboard: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 15, gap: 10 },
  statBox: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }) },
  statLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '900' },

  // Toggle Styles
  toggleContainer: { flexDirection: 'row', marginHorizontal: 15, backgroundColor: '#E5E7EB', borderRadius: 10, padding: 4, marginBottom: 15 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  toggleActive: { backgroundColor: '#FFFFFF', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }, android: { elevation: 1 } }) },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#111827', fontWeight: '700' },

  listContainer: { paddingHorizontal: 15, paddingBottom: 130 },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#9CA3AF', marginTop: 10, fontSize: 16, fontWeight: '500' },
  
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 }, android: { elevation: 2 } }) },
  cardMain: { padding: 14, paddingBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  subjectName: { color: '#1F2937', fontSize: 17, fontWeight: '700', marginRight: 8 },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stats: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  percentage: { fontSize: 18, fontWeight: '800' },
  deleteButton: { paddingLeft: 6 },
  
  actionBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  btnPresent: { backgroundColor: 'rgba(16, 185, 129, 0.08)' },
  btnAbsent: { backgroundColor: 'rgba(239, 68, 68, 0.08)' },
  btnCancelled: { backgroundColor: 'rgba(245, 158, 11, 0.08)' },
  actionText: { fontSize: 13, fontWeight: '700' },
  actionDivider: { width: 1, backgroundColor: '#F3F4F6' },

  // Logged today chip
  loggedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#F0FDF4', borderTopWidth: 1, borderTopColor: '#D1FAE5' },
  loggedText: { color: '#059669', fontSize: 13, fontWeight: '700' },

  // Calculator row (inside card)
  calcRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  calcChip: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  calcChipRed: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  calcChipGreen: { fontSize: 12, fontWeight: '700', color: '#059669' },
  calcChipBlue: { fontSize: 12, fontWeight: '700', color: '#2563EB' },

  // Attendance Goals panel
  goalsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 15, marginTop: 2, marginBottom: 4, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#EEF2FF', borderRadius: 14 },
  goalsHeaderText: { fontSize: 13, fontWeight: '700', color: '#4338CA' },
  goalsPanel: { marginHorizontal: 15, marginBottom: 10, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, gap: 10, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }, android: { elevation: 1 } }) },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalLabel: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  goalAdj: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  goalAdjText: { fontSize: 18, fontWeight: '700', color: '#374151' },
  goalValue: { fontSize: 20, fontWeight: '900', color: '#111827', marginHorizontal: 14, minWidth: 50, textAlign: 'center' },
  goalsHint: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', textAlign: 'center', marginTop: 2 },

  // Multiplier picker row
  multiplierBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  multiplierLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginRight: 4 },
  multiplierBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  multiplierPresent: { backgroundColor: '#D1FAE5' },
  multiplierAbsent: { backgroundColor: '#FEE2E2' },
  multiplierBtnText: { fontSize: 14, fontWeight: '800', color: '#1F2937' },
  multiplierCancel: { padding: 6, marginLeft: 4 },

  // Custom count input
  customInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  customInput: { width: 36, height: 32, borderRadius: 8, textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#1F2937', paddingVertical: 0 },
  customConfirm: { padding: 4, backgroundColor: '#ECFDF5', borderRadius: 8 },

  fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 25, backgroundColor: '#10B981', borderRadius: 30, ...Platform.select({ ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 }, android: { elevation: 6 } }) },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 25, paddingBottom: 40 },
  modalTitle: { color: '#111827', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#F3F4F6', color: '#1F2937', borderRadius: 14, padding: 16, marginBottom: 15, fontSize: 16, fontWeight: '500' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  typeSelector: { flexDirection: 'row', marginBottom: 25, gap: 10 },
  typeBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  typeActiveBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  typeActiveOrange: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F3F4F6' },
  saveBtn: { backgroundColor: '#10B981' },
  buttonText: { fontWeight: 'bold', fontSize: 16 },
});