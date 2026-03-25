import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { verifyPIN, setActiveProfile, Profile } from '../utils/profileService';

const AVATAR_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
const getAvatarColor = (id: string) => AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length];

type Props = { navigation: any; route: any };

export default function PINScreen({ navigation, route }: Props) {
  const { profile }: { profile: Profile } = route.params;
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [hasError, setHasError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = async (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setHasError(false);

    if (newPin.length === 4) {
      const correct = await verifyPIN(profile.id, newPin);
      if (correct) {
        await setActiveProfile(profile.id);
        navigation.replace('MainApp');
      } else {
        shake();
        setHasError(true);
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setHasError(false);
  };

  const avatarColor = getAvatarColor(profile.id);
  const initial = profile.name.charAt(0).toUpperCase();

  const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#6B7280" />
      </TouchableOpacity>

      {/* Profile Info */}
      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.profileName}>{profile.name}</Text>
        <Text style={styles.profileMeta}>{profile.branch} • {profile.year}</Text>
        <Text style={styles.prompt}>Enter your PIN</Text>
      </View>

      {/* PIN Dots */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              hasError && styles.dotError,
            ]}
          />
        ))}
      </Animated.View>
      {hasError && <Text style={styles.errorText}>Wrong PIN! Try again.</Text>}

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key, ki) => {
              if (key === '') return <View key={ki} style={styles.keyPlaceholder} />;
              if (key === 'del') {
                return (
                  <TouchableOpacity key={ki} style={styles.key} onPress={handleDelete} activeOpacity={0.7}>
                    <Ionicons name="backspace-outline" size={26} color="#374151" />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={ki} style={styles.key} onPress={() => handleDigit(key)} activeOpacity={0.7}>
                  <Text style={styles.keyDigit}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', marginLeft: 16, marginTop: 10, padding: 8 },

  profileSection: { alignItems: 'center', marginTop: 20, marginBottom: 36 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  profileName: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  profileMeta: { fontSize: 14, color: '#9CA3AF', fontWeight: '500', marginBottom: 12 },
  prompt: { fontSize: 16, color: '#6B7280', fontWeight: '600' },

  dotsRow: { flexDirection: 'row', gap: 18, marginBottom: 12 },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#111827', borderColor: '#111827' },
  dotError: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 14, fontWeight: '600', marginBottom: 8 },

  keypad: { width: '80%', marginTop: 20 },
  keyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  key: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  keyPlaceholder: { width: 76, height: 76 },
  keyDigit: { fontSize: 28, fontWeight: '600', color: '#111827' },
});
