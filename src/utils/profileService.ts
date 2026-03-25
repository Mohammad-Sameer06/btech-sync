import AsyncStorage from '@react-native-async-storage/async-storage';

export type Profile = {
  id: string;
  name: string;
  branch: string;
  year: string;
  pinHash: string; // We store a simple hash of the 4-digit PIN
  createdAt: string;
};

const PROFILES_KEY = '@all_profiles';
const ACTIVE_PROFILE_KEY = '@active_profile_id';

// Simple hash — good enough for a local PIN (not storing credit cards!)
const hashPin = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString();
};

export const getAllProfiles = async (): Promise<Profile[]> => {
  try {
    const data = await AsyncStorage.getItem(PROFILES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const createProfile = async (
  name: string,
  branch: string,
  year: string,
  pin: string
): Promise<Profile> => {
  const profiles = await getAllProfiles();
  const newProfile: Profile = {
    id: Date.now().toString(),
    name: name.trim(),
    branch: branch.trim(),
    year,
    pinHash: hashPin(pin),
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify([...profiles, newProfile]));
  return newProfile;
};

export const verifyPIN = async (profileId: string, pin: string): Promise<boolean> => {
  const profiles = await getAllProfiles();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return false;
  return profile.pinHash === hashPin(pin);
};

export const setActiveProfile = async (profileId: string): Promise<void> => {
  await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
};

export const getActiveProfileId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
};

export const getActiveProfile = async (): Promise<Profile | null> => {
  const id = await getActiveProfileId();
  if (!id) return null;
  const profiles = await getAllProfiles();
  return profiles.find(p => p.id === id) || null;
};

export const clearActiveProfile = async (): Promise<void> => {
  await AsyncStorage.removeItem(ACTIVE_PROFILE_KEY);
};

export const deleteProfile = async (profileId: string): Promise<void> => {
  // Remove profile from list
  const profiles = await getAllProfiles();
  const updated = profiles.filter(p => p.id !== profileId);
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated));

  // Clean up all data belonging to this profile
  const keys = await AsyncStorage.getAllKeys();
  const profileKeys = keys.filter(k => k.endsWith(`_${profileId}`));
  if (profileKeys.length > 0) {
    await AsyncStorage.multiRemove(profileKeys);
  }
};

// Scoped storage key helpers — each profile gets isolated data
export const scopedKey = (baseKey: string, profileId: string) =>
  `${baseKey}_${profileId}`;
