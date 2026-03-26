import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Platform, SectionList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getActiveProfile, getActiveProfileId, scopedKey } from '../utils/profileService';
import { BRANCH_SUBJECTS, PresetSubject } from '../data/subjectPresets';
import { useCustomAlert } from '../components/CustomAlert';

type Props = { navigation: any };

type SelectableSubject = PresetSubject & { key: string; selected: boolean; source: 'timetable' | 'preset' };
type Subject = { id: string; name: string; attended: number; total: number; type: 'Lecture' | 'Lab' };

const BASE_ATTENDANCE_KEY = '@attendance_data';
const BASE_TIMETABLE_KEY = '@timetable_data';

export default function QuickAddScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert, CustomAlert } = useCustomAlert();
  const [items, setItems] = useState<SelectableSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const profile = await getActiveProfile();
      if (!profile) return;

      // 1. Load existing subjects to avoid duplicates
      const existingRaw = await AsyncStorage.getItem(scopedKey(BASE_ATTENDANCE_KEY, profile.id));
      const existing: Subject[] = existingRaw ? JSON.parse(existingRaw) : [];
      const existingNames = new Set(existing.map(s => s.name.toLowerCase().trim()));

      // 2. Extract unique subjects from timetable
      const timetableRaw = await AsyncStorage.getItem(scopedKey(BASE_TIMETABLE_KEY, profile.id));
      const timetableSubjects: SelectableSubject[] = [];
      if (timetableRaw) {
        const timetable = JSON.parse(timetableRaw);
        const seen = new Set<string>();
        for (const day of Object.values(timetable) as any[]) {
          for (const cls of day) {
            const key = cls.subject.toLowerCase().trim();
            if (!seen.has(key) && !existingNames.has(key)) {
              seen.add(key);
              timetableSubjects.push({
                key: `timetable_${cls.subject}`,
                name: cls.subject,
                type: cls.type || 'Lecture',
                selected: true, // pre-select timetable subjects
                source: 'timetable',
              });
            }
          }
        }
      }

      // 3. Load branch presets, filter already existing ones
      const branch = profile.branch || 'Other';
      const presets = BRANCH_SUBJECTS[branch] || BRANCH_SUBJECTS['Other'];
      const timetableNames = new Set(timetableSubjects.map(s => s.name.toLowerCase().trim()));
      const presetSubjects: SelectableSubject[] = presets
        .filter(p => !existingNames.has(p.name.toLowerCase().trim()) && !timetableNames.has(p.name.toLowerCase().trim()))
        .map(p => ({
          ...p,
          key: `preset_${p.name}`,
          selected: false,
          source: 'preset',
        }));

      setItems([...timetableSubjects, ...presetSubjects]);
      setIsLoading(false);
    };
    load();
  }, []);

  const toggleItem = (key: string) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, selected: !i.selected } : i));
  };

  const selectAll = (source: 'timetable' | 'preset') => {
    const allSelected = items.filter(i => i.source === source).every(i => i.selected);
    setItems(prev => prev.map(i => i.source === source ? { ...i, selected: !allSelected } : i));
  };

  const handleAdd = async () => {
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) {
      showAlert({ type: 'warning', title: 'Nothing Selected', message: 'Please select at least one subject.' });
      return;
    }

    setIsSaving(true);
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) return;

      const existingRaw = await AsyncStorage.getItem(scopedKey(BASE_ATTENDANCE_KEY, profileId));
      const existing: Subject[] = existingRaw ? JSON.parse(existingRaw) : [];

      const newSubjects: Subject[] = selected.map(s => ({
        id: `${Date.now()}_${Math.random()}`,
        name: s.name,
        attended: 0,
        total: 0,
        type: s.type,
      }));

      await AsyncStorage.setItem(
        scopedKey(BASE_ATTENDANCE_KEY, profileId),
        JSON.stringify([...existing, ...newSubjects])
      );

      showAlert({
        type: 'success',
        title: `Added ${selected.length} subject${selected.length !== 1 ? 's' : ''}! 🎉`,
        message: 'All selected subjects are now in your attendance tracker.',
        buttons: [{ text: 'Done', onPress: () => navigation.goBack() }],
      });
    } catch {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save subjects. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const timetableItems = items.filter(i => i.source === 'timetable');
  const presetItems = items.filter(i => i.source === 'preset');
  const selectedCount = items.filter(i => i.selected).length;

  const renderItem = ({ item }: { item: SelectableSubject }) => {
    const typeColor = item.type === 'Lab' ? '#F59E0B' : '#3B82F6';
    const badgeBg = item.type === 'Lab' ? '#FEF3C7' : '#DBEAFE';
    return (
      <TouchableOpacity style={styles.item} onPress={() => toggleItem(item.key)} activeOpacity={0.8}>
        <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
          {item.selected && <Ionicons name="checkmark" size={14} color="white" />}
        </View>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: typeColor }]}>{item.type}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string, source: 'timetable' | 'preset', count: number) => {
    if (count === 0) return null;
    const allSelected = items.filter(i => i.source === source).every(i => i.selected);
    return (
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>{count} subjects</Text>
        </View>
        <TouchableOpacity onPress={() => selectAll(source)} style={styles.selectAllBtn}>
          <Text style={styles.selectAllText}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quick Add</Text>
          <Text style={styles.headerSub}>{selectedCount} subject{selectedCount !== 1 ? 's' : ''} selected</Text>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>All subjects from your timetable and branch presets are already in your tracker.</Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {timetableItems.length > 0 && (
                <>
                  {renderSectionHeader('📅 From Your Timetable', 'timetable', timetableItems.length)}
                  {timetableItems.map(item => renderItem({ item }))}
                </>
              )}
              {presetItems.length > 0 && (
                <>
                  {renderSectionHeader('🎓 Branch Presets', 'preset', presetItems.length)}
                  {presetItems.map(item => renderItem({ item }))}
                </>
              )}
              <View style={{ height: 120 }} />
            </>
          }
          keyExtractor={() => 'list'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Add Button */}
      {selectedCount > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.addBtn, isSaving && { opacity: 0.7 }]}
            onPress={handleAdd}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator color="white" />
              : <>
                <Ionicons name="add-circle" size={22} color="white" />
                <Text style={styles.addBtnText}>Add {selectedCount} Subject{selectedCount !== 1 ? 's' : ''}</Text>
              </>
            }
          </TouchableOpacity>
        </View>
      )}

      <CustomAlert />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, backgroundColor: '#F3F4F6', gap: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#10B981', fontWeight: '600' },

  list: { paddingHorizontal: 16 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sectionSub: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
  selectAllBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#E5E7EB', borderRadius: 10 },
  selectAllText: { fontSize: 13, fontWeight: '700', color: '#374151' },

  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#10B981', borderColor: '#10B981' },
  itemName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', fontWeight: '500', lineHeight: 20 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#10B981', borderRadius: 18, padding: 18,
    ...Platform.select({
      ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 5 },
    }),
  },
  addBtnText: { color: 'white', fontSize: 17, fontWeight: '800' },
});
