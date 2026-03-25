import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getActiveProfileId, scopedKey } from '../utils/profileService';

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

  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAttended, setNewAttended] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [newType, setNewType] = useState<'Lecture' | 'Lab'>('Lecture');

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

  const handleLogClass = (id: string, status: 'Present' | 'Absent' | 'Cancelled') => {
    if (status === 'Cancelled') {
      Alert.alert('Class Cancelled 🚫', 'Enjoy the free time! Math remains untouched.');
      return;
    }

    const updatedSubjects = subjects.map(sub => {
      if (sub.id === id) {
        return {
          ...sub,
          attended: status === 'Present' ? sub.attended + 1 : sub.attended,
          total: sub.total + 1,
        };
      }
      return sub;
    });

    saveSubjects(updatedSubjects);
  };

  const addSubject = () => {
    if (!newName.trim()) {
      Alert.alert('Hold up', 'Please enter a subject name.');
      return;
    }

    const attended = parseInt(newAttended) || 0;
    const total = parseInt(newTotal) || 0;

    if (attended > total) {
      Alert.alert('Math Error', 'Attended cannot be greater than Total!');
      return;
    }

    const newSubject: Subject = {
      id: Date.now().toString(),
      name: newName.trim(),
      attended,
      total,
      type: newType,
    };

    saveSubjects([...subjects, newSubject]);
    
    setModalVisible(false);
    setNewName(''); setNewAttended(''); setNewTotal(''); setNewType('Lecture');
  };

  const deleteSubject = (id: string) => {
    Alert.alert('Delete Subject', 'Are you sure you want to drop this class?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => saveSubjects(subjects.filter(sub => sub.id !== id)) },
    ]);
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
    const isSafe = parseFloat(percentage as string) >= 75;
    const typeColor = item.type === 'Lab' ? '#F59E0B' : '#3B82F6'; 
    const badgeBg = item.type === 'Lab' ? '#FEF3C7' : '#DBEAFE';

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
      </View>
    );
  };

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
              {viewMode === 'Today' ? "No classes scheduled for today! 🎉" : "No subjects added yet."}
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* Modal is unchanged */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Add New Subject</Text>
            <TextInput style={styles.input} placeholder="Subject Name" placeholderTextColor="#9CA3AF" value={newName} onChangeText={setNewName} />
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} placeholder="Attended (Optional)" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={newAttended} onChangeText={setNewAttended} />
              <TextInput style={[styles.input, { flex: 1, marginLeft: 5 }]} placeholder="Total (Optional)" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={newTotal} onChangeText={setNewTotal} />
            </View>
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
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={addSubject}>
                <Text style={[styles.buttonText, {color: 'white'}]}>Save Subject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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