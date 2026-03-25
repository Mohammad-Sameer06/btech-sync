import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createProfile } from '../utils/profileService';

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const BRANCHES = ['CSE', 'ECE', 'ME', 'CE', 'EEE', 'IT', 'Other'];

type Props = { navigation: any };

export default function CreateProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return Alert.alert('Oops!', 'Please enter your name.');
    if (!selectedBranch) return Alert.alert('Oops!', 'Please select your branch.');
    if (!selectedYear) return Alert.alert('Oops!', 'Please select your year.');
    if (pin.length !== 4) return Alert.alert('Oops!', 'Your PIN must be exactly 4 digits.');
    if (pin !== confirmPin) return Alert.alert('Oops!', 'PINs do not match. Try again!');

    setIsLoading(true);
    try {
      await createProfile(name, selectedBranch, selectedYear, pin);
      Alert.alert('Profile Created! 🎉', `Welcome, ${name.trim()}! You can now log in with your PIN.`, [
        { text: 'Let\'s Go!', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to create profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Create Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Rahul Sharma"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={40}
        />

        <Text style={styles.sectionLabel}>Branch</Text>
        <View style={styles.chipRow}>
          {BRANCHES.map(b => (
            <TouchableOpacity
              key={b}
              style={[styles.chip, selectedBranch === b && styles.chipActive]}
              onPress={() => setSelectedBranch(b)}
            >
              <Text style={[styles.chipText, selectedBranch === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Year</Text>
        <View style={styles.chipRow}>
          {YEARS.map(y => (
            <TouchableOpacity
              key={y}
              style={[styles.chip, selectedYear === y && styles.chipActive]}
              onPress={() => setSelectedYear(y)}
            >
              <Text style={[styles.chipText, selectedYear === y && styles.chipTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Set a 4-Digit PIN</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter PIN"
          placeholderTextColor="#9CA3AF"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />

        <Text style={styles.sectionLabel}>Confirm PIN</Text>
        <TextInput
          style={styles.input}
          placeholder="Re-enter PIN"
          placeholderTextColor="#9CA3AF"
          value={confirmPin}
          onChangeText={setConfirmPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />

        <TouchableOpacity
          style={[styles.createBtn, isLoading && { opacity: 0.7 }]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="white" />
            : <>
              <Ionicons name="checkmark-circle" size={22} color="white" />
              <Text style={styles.createBtnText}>Create Profile</Text>
            </>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },

  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },

  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10, marginTop: 18, textTransform: 'uppercase', letterSpacing: 0.5 },

  input: {
    backgroundColor: '#FFFFFF', color: '#1F2937', borderRadius: 16, padding: 16,
    fontSize: 18, fontWeight: '500',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#059669' },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#10B981', borderRadius: 18,
    padding: 18, marginTop: 32,
    ...Platform.select({
      ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 5 },
    }),
  },
  createBtnText: { color: 'white', fontSize: 17, fontWeight: '800' },
});
