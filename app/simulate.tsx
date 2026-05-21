import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type Category = 'text' | 'talk' | 'email' | 'other';

interface SimulationOption {
  category: Category;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  examples: string[];
}

const simulationOptions: SimulationOption[] = [
  {
    category: 'text',
    title: 'Text Message',
    description: 'Simulate SMS, WhatsApp, Telegram, etc.',
    icon: 'chatbubbles',
    color: '#10B981',
    examples: ['WhatsApp', 'Telegram', 'Signal', 'SMS', 'Messenger'],
  },
  {
    category: 'talk',
    title: 'Call / VoIP',
    description: 'Simulate incoming calls and VoIP notifications',
    icon: 'call',
    color: '#3B82F6',
    examples: ['Phone Call', 'WhatsApp Call', 'Zoom', 'Google Meet'],
  },
  {
    category: 'email',
    title: 'Email',
    description: 'Simulate email notifications',
    icon: 'mail',
    color: '#F59E0B',
    examples: ['Gmail', 'Outlook', 'Yahoo Mail'],
  },
  {
    category: 'other',
    title: 'Other Apps',
    description: 'Simulate misc app notifications',
    icon: 'apps',
    color: '#8B5CF6',
    examples: ['Spotify', 'YouTube', 'Twitter', 'News'],
  },
];

export default function SimulateScreen() {
  const router = useRouter();
  const [simulating, setSimulating] = useState<Category | null>(null);
  const [recentSimulations, setRecentSimulations] = useState<{ category: Category; time: Date }[]>([]);

  const handleSimulate = async (category: Category) => {
    setSimulating(category);
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulate/notification?category=${category}`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setRecentSimulations((prev) => [{ category, time: new Date() }, ...prev.slice(0, 4)]);
        router.push('/pending');
      } else {
        Alert.alert('Error', 'Failed to simulate notification');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setSimulating(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Simulate Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info */}
        <View style={styles.infoSection}>
          <Ionicons name="flask" size={32} color="#6366F1" />
          <Text style={styles.infoTitle}>Test the Flow</Text>
          <Text style={styles.infoText}>
            Since real notification interception requires Android system permissions,
            use this simulator to test the complete flow:
          </Text>
          <View style={styles.flowContainer}>
            <View style={styles.flowStep}>
              <View style={[styles.flowIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="notifications" size={16} color="#F59E0B" />
              </View>
              <Text style={styles.flowText}>Receive</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#444" />
            <View style={styles.flowStep}>
              <View style={[styles.flowIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="send" size={16} color="#3B82F6" />
              </View>
              <Text style={styles.flowText}>Send</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#444" />
            <View style={styles.flowStep}>
              <View style={[styles.flowIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="chatbox-ellipses" size={16} color="#10B981" />
              </View>
              <Text style={styles.flowText}>Reply</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#444" />
            <View style={styles.flowStep}>
              <View style={[styles.flowIcon, { backgroundColor: '#6366F120' }]}>
                <Ionicons name="push" size={16} color="#6366F1" />
              </View>
              <Text style={styles.flowText}>Push</Text>
            </View>
          </View>
        </View>

        {/* Simulation Options */}
        <Text style={styles.sectionTitle}>Choose a Category</Text>
        {simulationOptions.map((option) => (
          <TouchableOpacity
            key={option.category}
            style={[styles.optionCard, { borderLeftColor: option.color }]}
            onPress={() => handleSimulate(option.category)}
            disabled={simulating !== null}
          >
            <View style={[styles.optionIcon, { backgroundColor: option.color + '20' }]}>
              {simulating === option.category ? (
                <ActivityIndicator size="small" color={option.color} />
              ) : (
                <Ionicons name={option.icon} size={24} color={option.color} />
              )}
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
              <View style={styles.examplesRow}>
                {option.examples.slice(0, 3).map((ex) => (
                  <View key={ex} style={[styles.exampleBadge, { backgroundColor: option.color + '15' }]}>
                    <Text style={[styles.exampleText, { color: option.color }]}>{ex}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Ionicons name="add-circle" size={24} color={option.color} />
          </TouchableOpacity>
        ))}

        {/* Recent Simulations */}
        {recentSimulations.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Simulations</Text>
            {recentSimulations.map((sim, index) => {
              const opt = simulationOptions.find((o) => o.category === sim.category)!;
              return (
                <View key={index} style={styles.recentItem}>
                  <Ionicons name={opt.icon} size={18} color={opt.color} />
                  <Text style={styles.recentText}>{opt.title}</Text>
                  <Text style={styles.recentTime}>
                    {sim.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F28',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  scrollContent: {
    padding: 16,
  },
  infoSection: {
    backgroundColor: '#1F1F28',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  flowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  flowStep: {
    alignItems: 'center',
    gap: 4,
  },
  flowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowText: {
    fontSize: 10,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F28',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 14,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  optionDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  examplesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  exampleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  exampleText: {
    fontSize: 11,
  },
  recentSection: {
    marginTop: 24,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F28',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  recentText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  recentTime: {
    color: '#666',
    fontSize: 12,
  },
});
