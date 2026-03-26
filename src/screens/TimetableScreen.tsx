import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Modal, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleClassAlarm, cancelAlarm } from '../utils/notifications';
import { getActiveProfileId, scopedKey } from '../utils/profileService';
import { useCustomAlert } from '../components/CustomAlert';

type ClassSession = { id: string; time: string; subject: string; type: 'Lecture' | 'Lab'; room: string; notificationId?: string; };
type Subject = { id: string; name: string; attended: number; total: number; type: 'Lecture' | 'Lab' };
const SETTINGS_KEY = '@app_settings';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BASE_TIMETABLE_KEY = '@timetable_data';
const BASE_ATTENDANCE_KEY = '@attendance_data';

export default function TimetableScreen() {
  const [selectedDay, setSelectedDay] = useState('Mon');
  const [schedule, setSchedule] = useState<Record<string, ClassSession[]>>({ 'Mon': [], 'Tue': [], 'Wed': [], 'Thu': [], 'Fri': [], 'Sat': [] });
  const [isLoaded, setIsLoaded] = useState(false);

  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { showAlert, CustomAlert } = useCustomAlert();

  const [modalVisible, setModalVisible] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [newType, setNewType] = useState<'Lecture' | 'Lab'>('Lecture');
  // Time picker state
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>('AM');

  useFocusEffect(
    useCallback(() => {
      const loadTimetable = async () => {
        try {
          const profileId = await getActiveProfileId();
          if (!profileId) return;
          const savedTimetable = await AsyncStorage.getItem(scopedKey(BASE_TIMETABLE_KEY, profileId));
          if (savedTimetable) setSchedule(JSON.parse(savedTimetable));
          else setSchedule({ 'Mon': [], 'Tue': [], 'Wed': [], 'Thu': [], 'Fri': [], 'Sat': [] });
        } catch (e) { console.error('Failed to load timetable', e); }
        finally { setIsLoaded(true); }
      };
      loadTimetable();
    }, [])
  );

  const saveTimetable = async (newSchedule: Record<string, ClassSession[]>) => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) return;
      await AsyncStorage.setItem(scopedKey(BASE_TIMETABLE_KEY, profileId), JSON.stringify(newSchedule));
      setSchedule(newSchedule);
    } catch (e) { console.error('Failed to save timetable', e); }
  };

  const fmt = (h: number, m: number, ap: string) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;
  const adjHour = (cur: number, d: number) => { let n = cur + d; if (n < 1) n = 12; if (n > 12) n = 1; return n; };
  const adjMin = (cur: number, d: number) => { let n = cur + d; if (n < 0) n = 55; if (n > 55) n = 0; return n; };

  const addClass = async () => {
    if (!newSubject.trim() || !newRoom.trim()) {
      showAlert({ type: 'warning', title: 'Missing Info', message: 'Please enter both a subject name and room number.' });
      return;
    }

    const profileId = await getActiveProfileId();
    if (!profileId) return;

    const startTimeStr = fmt(startHour, startMinute, startAmPm);
    const endTimeStr = fmt(endHour, endMinute, endAmPm);

    let alarmId = undefined;
    const settingsStr = await AsyncStorage.getItem(SETTINGS_KEY);
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      if (settings.classAlerts) {
        alarmId = await scheduleClassAlarm(newSubject.trim(), startTimeStr, selectedDay, newRoom.trim());
      }
    }

    const newClass: ClassSession = {
      id: Date.now().toString(),
      time: `${startTimeStr} - ${endTimeStr}`,
      subject: newSubject.trim(),
      type: newType,
      room: newRoom.trim(),
      notificationId: alarmId,
    };

    const newSchedule = { ...schedule, [selectedDay]: [...(schedule[selectedDay] || []), newClass] };
    saveTimetable(newSchedule);

    // Auto-sync subject to attendance if not already there
    try {
      const attRaw = await AsyncStorage.getItem(scopedKey(BASE_ATTENDANCE_KEY, profileId));
      const attArr: Subject[] = attRaw ? JSON.parse(attRaw) : [];
      const exists = attArr.some(s => s.name.toLowerCase().trim() === newSubject.toLowerCase().trim());
      if (!exists) {
        attArr.push({ id: `${Date.now()}_att`, name: newSubject.trim(), attended: 0, total: 0, type: newType });
        await AsyncStorage.setItem(scopedKey(BASE_ATTENDANCE_KEY, profileId), JSON.stringify(attArr));
      }
    } catch (e) { console.error('Auto-sync attendance failed', e); }

    setModalVisible(false);
    setNewSubject(''); setNewRoom(''); setNewType('Lecture');
    setStartHour(9); setStartMinute(0); setStartAmPm('AM');
    setEndHour(10); setEndMinute(0); setEndAmPm('AM');
  };

  const deleteClass = (id: string, notificationId?: string) => {
    showAlert({
      type: 'delete',
      title: 'Remove This Class?',
      message: 'This class will be removed from your weekly schedule.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
            if (notificationId) cancelAlarm(notificationId);
            const newSchedule = { ...schedule, [selectedDay]: schedule[selectedDay].filter(c => c.id !== id) };
            saveTimetable(newSchedule);
          }
        },
      ],
    });
  };

  const renderDayTab = (day: string) => {
    const isActive = selectedDay === day;
    return (
      <TouchableOpacity key={day} style={[styles.dayTab, isActive && styles.activeDayTab]} onPress={() => setSelectedDay(day)}>
        <Text style={[styles.dayTabText, isActive && styles.activeDayTabText]}>{day}</Text>
      </TouchableOpacity>
    );
  };

  const renderClassCard = ({ item }: { item: ClassSession }) => {
    const typeColor = item.type === 'Lab' ? '#F59E0B' : '#3B82F6'; 
    const badgeBg = item.type === 'Lab' ? '#FEF3C7' : '#DBEAFE';

    return (
      <View style={styles.card}>
        <View style={styles.cardMain}>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{item.time.split(' - ')[0]}</Text>
            <View style={styles.timeLine} />
            <Text style={styles.timeText}>{item.time.split(' - ')[1]}</Text>
          </View>
          
          <View style={[styles.detailsContainer, { borderLeftColor: typeColor }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.subjectName} numberOfLines={1}>{item.subject}</Text>
              <TouchableOpacity onPress={() => deleteClass(item.id, item.notificationId)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.badgeText, { color: typeColor }]}>{item.type}</Text>
              </View>
              <Text style={styles.roomText}>📍 {item.room}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (!isLoaded) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#10B981" /></View>;

  const currentClasses = schedule[selectedDay] || [];

  return (
    // Replaced SafeAreaView with dynamic View to fix the Notch overlap
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>Timetable</Text>
      
      <View style={styles.daySelectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {DAYS.map(renderDayTab)}
        </ScrollView>
      </View>

      <FlatList
        data={currentClasses}
        keyExtractor={(item) => item.id}
        renderItem={renderClassCard}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No classes scheduled for {selectedDay}. 🎉</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      <CustomAlert />

      <Modal animationType="slide" transparent statusBarTranslucent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalView, { maxHeight: screenHeight * 0.85, paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Class to {selectedDay}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
                <TextInput style={styles.input} placeholder="Subject Name" placeholderTextColor="#9CA3AF" value={newSubject} onChangeText={setNewSubject} />

                {/* Time Picker — Start */}
                <Text style={styles.timeLabel}>Start Time</Text>
                <View style={styles.timePickerRow}>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setStartHour(h => adjHour(h, -1))}><Text style={styles.timeBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.timeValue}>{String(startHour).padStart(2,'0')}</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setStartHour(h => adjHour(h, 1))}><Text style={styles.timeBtnText}>+</Text></TouchableOpacity>
                  <Text style={styles.timeColon}>:</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setStartMinute(m => adjMin(m, -5))}><Text style={styles.timeBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.timeValue}>{String(startMinute).padStart(2,'0')}</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setStartMinute(m => adjMin(m, 5))}><Text style={styles.timeBtnText}>+</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.amPmBtn} onPress={() => setStartAmPm(a => a === 'AM' ? 'PM' : 'AM')}>
                    <Text style={styles.amPmText}>{startAmPm}</Text>
                  </TouchableOpacity>
                </View>

                {/* Time Picker — End */}
                <Text style={styles.timeLabel}>End Time</Text>
                <View style={styles.timePickerRow}>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setEndHour(h => adjHour(h, -1))}><Text style={styles.timeBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.timeValue}>{String(endHour).padStart(2,'0')}</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setEndHour(h => adjHour(h, 1))}><Text style={styles.timeBtnText}>+</Text></TouchableOpacity>
                  <Text style={styles.timeColon}>:</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setEndMinute(m => adjMin(m, -5))}><Text style={styles.timeBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.timeValue}>{String(endMinute).padStart(2,'0')}</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setEndMinute(m => adjMin(m, 5))}><Text style={styles.timeBtnText}>+</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.amPmBtn} onPress={() => setEndAmPm(a => a === 'AM' ? 'PM' : 'AM')}>
                    <Text style={styles.amPmText}>{endAmPm}</Text>
                  </TouchableOpacity>
                </View>

                <TextInput style={styles.input} placeholder="Room / Lab Number" placeholderTextColor="#9CA3AF" value={newRoom} onChangeText={setNewRoom} />
                <View style={styles.typeSelector}>
                  <TouchableOpacity style={[styles.typeBtn, newType === 'Lecture' && styles.typeActiveBlue]} onPress={() => setNewType('Lecture')}>
                    <Text style={[styles.buttonText, newType === 'Lecture' ? {color: '#2563EB'} : {color: '#6B7280'}]}>Theory</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.typeBtn, newType === 'Lab' && styles.typeActiveOrange]} onPress={() => setNewType('Lab')}>
                    <Text style={[styles.buttonText, newType === 'Lab' ? {color: '#D97706'} : {color: '#6B7280'}]}>Lab</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                    <Text style={[styles.buttonText, {color: '#4B5563'}]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={addClass}>
                    <Text style={[styles.buttonText, {color: 'white'}]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  headerTitle: { color: '#111827', fontSize: 32, fontWeight: '800', marginHorizontal: 20, marginBottom: 15, marginTop: 15 }, // Fixed margin
  
  daySelectorContainer: { height: 60, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 15 },
  dayScroll: { paddingHorizontal: 15, alignItems: 'center' },
  dayTab: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 20, backgroundColor: '#E5E7EB', marginRight: 10 },
  activeDayTab: { backgroundColor: '#10B981' },
  dayTabText: { color: '#6B7280', fontWeight: '700', fontSize: 15 },
  activeDayTabText: { color: 'white' },
  
  listContainer: { paddingHorizontal: 15, paddingBottom: 130 }, // Fixed padding for FAB
  emptyText: { color: '#9CA3AF', textAlign: 'center', marginTop: 50, fontSize: 16, fontWeight: '500' },
  
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 15, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 }, android: { elevation: 2 } }) },
  cardMain: { flexDirection: 'row', padding: 15 },
  timeContainer: { width: 75, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#F3F4F6', paddingRight: 10 },
  timeText: { color: '#6B7280', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  timeLine: { height: 25, width: 2, backgroundColor: '#F3F4F6', marginVertical: 5 },
  
  detailsContainer: { flex: 1, paddingLeft: 15, borderLeftWidth: 4, justifyContent: 'center' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  subjectName: { color: '#1F2937', fontSize: 18, fontWeight: '700', flex: 1 },
  deleteBtn: { padding: 5, paddingRight: 0 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, marginRight: 10 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  roomText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },

  fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 25, backgroundColor: '#10B981', borderRadius: 30, ...Platform.select({ ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 }, android: { elevation: 6 } }) }, // Fixed bottom padding

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
  modalHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 14 },
  modalTitle: { color: '#111827', fontSize: 18, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  input: { backgroundColor: '#F3F4F6', color: '#1F2937', borderRadius: 14, padding: 16, marginBottom: 15, fontSize: 16, fontWeight: '500' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  typeSelector: { flexDirection: 'row', marginBottom: 25, gap: 10 },
  typeBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  typeActiveBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  typeActiveOrange: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  // Time Picker Styles
  timeLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 2 },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6, marginBottom: 12, gap: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  timeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  timeBtnText: { fontSize: 16, fontWeight: '600', color: '#374151', lineHeight: 20 },
  timeValue: { fontSize: 20, fontWeight: '800', color: '#111827', minWidth: 30, textAlign: 'center' },
  timeColon: { fontSize: 20, fontWeight: '800', color: '#111827' },
  amPmBtn: { backgroundColor: '#10B981', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 9, marginLeft: 2 },
  amPmText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  modalBtn: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F3F4F6' },
  saveBtn: { backgroundColor: '#10B981' },
  buttonText: { fontWeight: 'bold', fontSize: 16 },
});