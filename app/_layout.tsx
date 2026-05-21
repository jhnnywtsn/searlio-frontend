import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F0F14' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="pending" />
        <Stack.Screen name="replies" />
        <Stack.Screen name="simulate" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="voice" />
        <Stack.Screen name="leads" />
        <Stack.Screen name="conversation/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
