import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllProfiles, deleteProfile, Profile } from '../utils/profileService';
import { nfs, hp } from '../utils/responsive';
import { useCustomAlert } from '../components/CustomAlert';

type Props = { navigation: any };

// Generate a consistent color per profile based on ID
const AVATAR_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
const getAvatarColor = (id: string) => AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length];

export default function ProfileSelectScreen({ navigation }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const insets = useSafeAreaInsets();
  const { showAlert, CustomAlert } = useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const all = await getAllProfiles();
        setProfiles(all);
        setIsLoaded(true);
      };
      load();
    }, [])
  );

  const handleLongPress = (profile: Profile) => {
    showAlert({
      type: 'delete',
      title: `Delete "${profile.name}"?`,
      message: 'This will permanently delete this profile and ALL its attendance & timetable data.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            await deleteProfile(profile.id);
            setProfiles(prev => prev.filter(p => p.id !== profile.id));
          }
        },
      ],
    });
  };

  const renderProfile = ({ item }: { item: Profile }) => {
    const color = getAvatarColor(item.id);
    const initial = item.name.charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.profileCard}
        onPress={() => navigation.navigate('PINEntry', { profile: item })}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{item.name}</Text>
          <Text style={styles.profileMeta}>{item.branch} • {item.year}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  if (!isLoaded) {
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
        <View style={styles.logoRow}>
          <Ionicons name="school" size={28} color="#10B981" />
          <Text style={styles.logoText}>BtechSync</Text>
        </View>
        <Text style={styles.headerTitle}>Who's studying{'\n'}today? 📚</Text>
        <Text style={styles.headerSub}>Select your profile to continue</Text>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={item => item.id}
        renderItem={renderProfile}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No profiles yet</Text>
            <Text style={styles.emptySub}>Create your first profile to get started</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateProfile')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={22} color="#10B981" />
            <Text style={styles.addButtonText}>Add New Profile</Text>
          </TouchableOpacity>
        }
      />
      <Text style={styles.hint}>Long press a profile to delete it</Text>
      <CustomAlert />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingTop: hp(16),
    paddingBottom: hp(28),
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: hp(20),
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: hp(16), gap: 8 },
  logoText: { fontSize: nfs(17), fontWeight: '800', color: '#10B981' },
  headerTitle: { fontSize: nfs(28), fontWeight: '900', color: '#FFFFFF', lineHeight: nfs(34), marginBottom: 6 },
  headerSub: { fontSize: nfs(14), color: '#9CA3AF', fontWeight: '500' },

  list: { paddingHorizontal: 20, paddingBottom: 20 },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  avatarText: { fontSize: nfs(20), fontWeight: '800', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: nfs(16), fontWeight: '700', color: '#111827', marginBottom: 3 },
  profileMeta: { fontSize: nfs(12), color: '#9CA3AF', fontWeight: '500' },

  emptyState: { alignItems: 'center', paddingVertical: hp(36) },
  emptyTitle: { fontSize: nfs(18), fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 6 },
  emptySub: { fontSize: nfs(13), color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },

  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 18,
    borderWidth: 2, borderColor: '#10B981', borderStyle: 'dashed',
    marginTop: 8, backgroundColor: '#F0FDF4',
  },
  addButtonText: { fontSize: nfs(15), fontWeight: '700', color: '#10B981' },

  hint: {
    textAlign: 'center', color: '#D1D5DB', fontSize: nfs(11),
    fontWeight: '500', paddingBottom: 16,
  },
});
