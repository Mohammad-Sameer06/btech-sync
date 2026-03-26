import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getActiveProfile } from '../utils/profileService';
import ProfileSelectScreen from '../screens/ProfileSelectScreen';
import CreateProfileScreen from '../screens/CreateProfileScreen';
import PINScreen from '../screens/PINScreen';
import BottomTabNavigator from './BottomTabNavigator';
import QuickAddScreen from '../screens/QuickAddScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [isChecking, setIsChecking] = useState(true);
  const [initialRoute, setInitialRoute] = useState<'ProfileSelect' | 'MainApp'>('ProfileSelect');

  useEffect(() => {
    const checkSession = async () => {
      const active = await getActiveProfile();
      setInitialRoute(active ? 'MainApp' : 'ProfileSelect');
      setIsChecking(false);
    };
    checkSession();
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="ProfileSelect" component={ProfileSelectScreen} />
        <Stack.Screen name="CreateProfile" component={CreateProfileScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="PINEntry" component={PINScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="MainApp" component={BottomTabNavigator} options={{ animation: 'fade' }} />
        <Stack.Screen name="QuickAdd" component={QuickAddScreen} options={{ animation: 'slide_from_bottom', headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
