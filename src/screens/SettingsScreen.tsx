import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { getActiveProfile, getActiveProfileId, clearActiveProfile, scopedKey, Profile } from '../utils/profileService';
import { useCustomAlert } from '../components/CustomAlert';

type Subject = { id: string; name: string; attended: number; total: number; };

const BASE_ATTENDANCE_KEY = '@attendance_data';
const BASE_TIMETABLE_KEY = '@timetable_data';
const BASE_SETTINGS_KEY = '@app_settings';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showDanger, setShowDanger] = useState(false);
  const { showAlert, CustomAlert } = useCustomAlert();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [classAlerts, setClassAlerts] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await getActiveProfile();
        setActiveProfile(profile);
        if (!profile) return;

        const savedData = await AsyncStorage.getItem(scopedKey(BASE_ATTENDANCE_KEY, profile.id));
        if (savedData !== null) setSubjects(JSON.parse(savedData));

        const savedSettings = await AsyncStorage.getItem(scopedKey(BASE_SETTINGS_KEY, profile.id));
        if (savedSettings !== null) {
          const parsed = JSON.parse(savedSettings);
          setDailyReminder(parsed.dailyReminder || false);
          setClassAlerts(parsed.classAlerts || false);
        }
      } catch (e) { console.error('Failed to load settings', e); }
    };
    loadData();
  }, []);

  const saveSettings = async (daily: boolean, classes: boolean) => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) return;
      await AsyncStorage.setItem(scopedKey(BASE_SETTINGS_KEY, profileId), JSON.stringify({ dailyReminder: daily, classAlerts: classes }));
    } catch (e) { console.error('Failed to save settings', e); }
  };

  const handleToggleDaily = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ type: 'warning', title: 'Permission Denied', message: 'We need notification permissions to send you daily reminders!' });
        return;
      }
    }
    setDailyReminder(value);
    saveSettings(value, classAlerts);
  };

  const handleToggleClasses = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ type: 'warning', title: 'Permission Denied', message: 'We need notification permissions to alert you before class!' });
        return;
      }
    }
    setClassAlerts(value);
    saveSettings(dailyReminder, value);
  };

  const adjustValue = (id: string, field: 'attended' | 'total', amount: number) => {
    setHasUnsavedChanges(true);
    setSubjects(current =>
      current.map(sub => {
        if (sub.id === id) {
          let newValue = sub[field] + amount;
          if (newValue < 0) newValue = 0; 
          if (field === 'attended' && newValue > sub.total) return sub;
          if (field === 'total' && newValue < sub.attended) return sub;
          return { ...sub, [field]: newValue };
        }
        return sub;
      })
    );
  };

  const saveManualSync = async () => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) return;
      await AsyncStorage.setItem(scopedKey(BASE_ATTENDANCE_KEY, profileId), JSON.stringify(subjects));
      setHasUnsavedChanges(false);
      showAlert({ type: 'success', title: 'Saved! ✨', message: 'Your exact attendance records have been permanently saved.' });
    } catch (e) { showAlert({ type: 'error', title: 'Save Failed', message: 'Something went wrong. Please try again.' }); }
  };

  const handleSwitchProfile = () => {
    showAlert({
      type: 'confirm',
      title: 'Switch Profile?',
      message: 'You\'ll be taken back to the profile selection screen.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Switch', style: 'default', onPress: async () => { await clearActiveProfile(); navigation.replace('ProfileSelect'); } },
      ],
    });
  };

  const factoryReset = () => {
    showAlert({
      type: 'delete',
      title: 'Wipe All Data?',
      message: 'This permanently deletes ALL subjects, attendance & timetable data for this profile. Cannot be undone.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Everything', style: 'destructive', onPress: async () => {
            const profileId = await getActiveProfileId();
            if (profileId) {
              await AsyncStorage.removeItem(scopedKey(BASE_ATTENDANCE_KEY, profileId));
              await AsyncStorage.removeItem(scopedKey(BASE_TIMETABLE_KEY, profileId));
              await AsyncStorage.removeItem(scopedKey(BASE_SETTINGS_KEY, profileId));
            }
            setSubjects([]); setHasUnsavedChanges(false);
            setDailyReminder(false); setClassAlerts(false);
            showAlert({ type: 'success', title: 'Clean Slate', message: 'All data has been wiped. Fresh start!' });
          },
        },
      ],
    });
  };

  const getPercentage = (attended: number, total: number) => {
    if (total === 0) return 0;
    return ((attended / total) * 100).toFixed(1);
  };

  const renderSubjectButton = ({ item }: { item: Subject }) => {
    const percentage = getPercentage(item.attended, item.total);
    const isSafe = parseFloat(percentage as string) >= 75;
    const dotColor = isSafe ? '#10B981' : '#EF4444'; 

    return (
      <TouchableOpacity style={styles.subjectBtn} onPress={() => setEditingSubjectId(item.id)}>
        <View style={styles.subjectBtnLeft}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.subjectBtnText} numberOfLines={1}>{item.name}</Text>
        </View>
        <View style={styles.subjectBtnRight}>
          <Text style={styles.subjectBtnStats}>{item.attended}/{item.total}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>
    );
  };

  const activeSubject = subjects.find(s => s.id === editingSubjectId);
  const activePercentage = activeSubject ? getPercentage(activeSubject.attended, activeSubject.total) : '0';
  const activeIsSafe = parseFloat(activePercentage as string) >= 75;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        renderItem={renderSubjectButton}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View>
            {/* 1. Profile Header */}
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{activeProfile ? activeProfile.name.charAt(0).toUpperCase() : '?'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{activeProfile?.name || 'Unknown'}</Text>
                <Text style={styles.profileBio}>{activeProfile ? `${activeProfile.year} • ${activeProfile.branch}` : ''}</Text>
              </View>
            </View>

            {/* 2. Notifications Section */}
            <Text style={styles.sectionTitle}>Smart Alerts</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="notifications-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                  <View>
                    <Text style={styles.settingLabel}>Daily Log Reminder</Text>
                    <Text style={styles.settingSub}>Ping me at 5:00 PM to log classes</Text>
                  </View>
                </View>
                <Switch 
                  value={dailyReminder} 
                  onValueChange={handleToggleDaily}
                  trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                  ios_backgroundColor="#E5E7EB"
                />
              </View>
              
              <View style={styles.settingDivider} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="alarm-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                  <View>
                    <Text style={styles.settingLabel}>Class Alerts</Text>
                    <Text style={styles.settingSub}>Notify me 30 mins before a class starts</Text>
                  </View>
                </View>
                <Switch 
                  value={classAlerts} 
                  onValueChange={handleToggleClasses}
                  trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                  ios_backgroundColor="#E5E7EB"
                />
              </View>
            </View>

            <View style={styles.header}>
              <Text style={styles.sectionTitle}>Manual Sync</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No subjects available to sync.</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveBtn, !hasUnsavedChanges && styles.saveBtnDisabled]} 
          onPress={saveManualSync} disabled={!hasUnsavedChanges}
        >
          <Ionicons name="checkmark-done" size={22} color={hasUnsavedChanges ? "white" : "#9CA3AF"} style={{ marginRight: 8 }} />
          <Text style={[styles.btnText, !hasUnsavedChanges && { color: '#9CA3AF' }]}>
            {hasUnsavedChanges ? "Save All Changes" : "Up to Date"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetBtn} onPress={handleSwitchProfile}>
          <Text style={styles.switchBtnText}>⇄ Switch Profile</Text>
        </TouchableOpacity>

        {/* Danger Zone — collapsed by default */}
        <TouchableOpacity
          style={[styles.dangerZoneToggle, showDanger && styles.dangerZoneToggleOpen]}
          onPress={() => setShowDanger(v => !v)}
        >
          <Text style={styles.dangerZoneToggleText}>{showDanger ? '▲' : '▼'}  Danger Zone</Text>
        </TouchableOpacity>
        {showDanger && (
          <TouchableOpacity style={styles.resetBtn} onPress={factoryReset}>
            <Text style={styles.resetBtnText}>🗑 Wipe My Data</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Editing Modal */}
      <CustomAlert />
      <Modal animationType="slide" transparent={true} visible={!!editingSubjectId} onRequestClose={() => setEditingSubjectId(null)}>
        <View style={styles.modalOverlay}>
          {activeSubject && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalSubjectName} numberOfLines={1}>{activeSubject.name}</Text>
                <TouchableOpacity onPress={() => setEditingSubjectId(null)} style={styles.closeModalBtn}>
                  <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalProgressRow}>
                <Text style={styles.modalStatText}>Current Standing:</Text>
                <Text style={[styles.modalPercentage, { color: activeIsSafe ? '#10B981' : '#EF4444' }]}>{activePercentage}%</Text>
              </View>

              <View style={styles.stepperContainer}>
                <View style={styles.stepperBlock}>
                  <Text style={styles.stepperLabel}>Attended</Text>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity style={styles.roundBtn} onPress={() => adjustValue(activeSubject.id, 'attended', -1)}>
                      <Ionicons name="remove" size={24} color="#4B5563" />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{activeSubject.attended}</Text>
                    <TouchableOpacity style={styles.roundBtn} onPress={() => adjustValue(activeSubject.id, 'attended', 1)}>
                      <Ionicons name="add" size={24} color="#4B5563" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.dividerLine} />
                <View style={styles.stepperBlock}>
                  <Text style={styles.stepperLabel}>Total</Text>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity style={styles.roundBtn} onPress={() => adjustValue(activeSubject.id, 'total', -1)}>
                      <Ionicons name="remove" size={24} color="#4B5563" />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{activeSubject.total}</Text>
                    <TouchableOpacity style={styles.roundBtn} onPress={() => adjustValue(activeSubject.id, 'total', 1)}>
                      <Ionicons name="add" size={24} color="#4B5563" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={() => setEditingSubjectId(null)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' }, 
  listContainer: { paddingHorizontal: 15, paddingTop: 20, paddingBottom: 20 },
  
  // Profile Section
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 25, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 2 } }) },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 15, borderWidth: 1, borderColor: '#DBEAFE' },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#2563EB' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 2 },
  profileBio: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12, marginLeft: 5 },
  header: { marginTop: 25, marginBottom: 5 },

  // Settings Group
  settingsGroup: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 2 } }) },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  settingInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  settingSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  settingDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 50 },

  // Subject Buttons
  subjectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, marginBottom: 10, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }) },
  subjectBtnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  subjectBtnText: { color: '#1F2937', fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 10 },
  subjectBtnRight: { flexDirection: 'row', alignItems: 'center' },
  subjectBtnStats: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  
  emptyState: { alignItems: 'center', marginTop: 20 },
  emptyText: { color: '#9CA3AF', fontSize: 15, fontWeight: '500' },

  footer: { padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  saveBtn: { backgroundColor: '#10B981', flexDirection: 'row', padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  saveBtnDisabled: { backgroundColor: '#F3F4F6' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  resetBtn: { padding: 15, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 15 },
  switchBtnText: { color: '#6366F1', fontWeight: 'bold', fontSize: 15 },
  dangerZoneToggle: { marginHorizontal: 20, marginTop: 4, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FFF5F5', alignItems: 'center' },
  dangerZoneToggleOpen: { borderColor: '#EF4444', backgroundColor: '#FEE2E2' },
  dangerZoneToggleText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 25, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalSubjectName: { color: '#111827', fontSize: 22, fontWeight: 'bold', flex: 1, paddingRight: 10 },
  closeModalBtn: { padding: 5 },
  
  modalProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 15, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  modalStatText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
  modalPercentage: { fontSize: 24, fontWeight: 'bold' },

  stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  stepperBlock: { flex: 1, alignItems: 'center' },
  stepperLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  stepperValue: { color: '#111827', fontSize: 26, fontWeight: 'bold', width: 45, textAlign: 'center' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  dividerLine: { width: 1, height: 50, backgroundColor: '#F3F4F6', marginHorizontal: 10 },
  
  doneBtn: { backgroundColor: '#111827', padding: 16, borderRadius: 14, alignItems: 'center' },
  doneBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});