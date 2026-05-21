import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Notification {
  id: string;
  title?: string;
  content: string;
  sender?: string;
  app_name?: string;
  category?: string;
}

export default function PendingScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications`);
      const data = await res.json();

      // newest first
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

      setNotifications(sorted);
    } catch (err) {
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleGenerateAIReply = async (id: string) => {
    setGeneratingAI(id);

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/llm/generate-reply/${id}`,
        { method: 'POST' }
      );

      if (!res.ok) throw new Error('AI failed');

      Alert.alert('Success', 'AI reply generated');
      router.push('/replies');
    } catch (err) {
      Alert.alert('Error', 'Failed to generate AI reply');
    } finally {
      setGeneratingAI(null);
    }
  };

  const handleSimulateReply = async (id: string) => {
    try {
      await fetch(
        `${BACKEND_URL}/api/simulate/assistant-reply/${id}`,
        { method: 'POST' }
      );

      Alert.alert('Success', 'Simulated reply created');
      router.push('/replies');
    } catch {
      Alert.alert('Error', 'Simulation failed');
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'text':
        return '#10B981';
      case 'email':
        return '#6366F1';
      case 'call':
        return '#F59E0B';
      default:
        return '#888';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'text':
        return 'chatbubble';
      case 'email':
        return 'mail';
      case 'call':
        return 'call';
      default:
        return 'notifications';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pending Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
        renderItem={({ item }) => {
          const color = getCategoryColor(item.category);
          const isGenerating = generatingAI === item.id;

          return (
            <View style={styles.notificationItem}>
              <View style={[styles.itemIcon, { backgroundColor: color + '20' }]}>
                <Ionicons
                  name={getCategoryIcon(item.category)}
                  size={20}
                  color={color}
                />
              </View>

              <View style={styles.itemContent}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title || item.sender || item.app_name}
                </Text>

                <Text style={styles.itemMessage} numberOfLines={2}>
                  {item.content}
                </Text>

                <Text style={styles.itemApp}>{item.app_name}</Text>
              </View>

              <View style={styles.actionButtons}>
                {/* AI */}
                <TouchableOpacity
                  style={[
                    styles.aiButton,
                    !true && styles.buttonDisabled,
                  ]}
                  onPress={() => handleGenerateAIReply(item.id)}
                  disabled={isGenerating}
                  activeOpacity={0.8}
                >
                  <View style={{ alignItems: 'center' }}>
                    {isGenerating ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <Ionicons name="sparkles" size={18} color="#10B981" />
                    )}
                    <Text style={styles.aiText}>AI</Text>
                  </View>
                </TouchableOpacity>

                {/* QUICK */}
                <TouchableOpacity
                  style={styles.simulateButton}
                  onPress={() => handleSimulateReply(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="flash" size={16} color="#F59E0B" />
                    <Text style={styles.quickText}>Quick</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>No pending notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F28',
  },
  headerTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F28',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    marginLeft: 10,
  },
  itemTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  itemMessage: {
    color: '#aaa',
    fontSize: 13,
  },
  itemApp: {
    color: '#666',
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  aiButton: {
    backgroundColor: '#10B98120',
    padding: 8,
    borderRadius: 8,
  },
  simulateButton: {
    backgroundColor: '#F59E0B20',
    padding: 8,
    borderRadius: 8,
  },
  aiText: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 2,
  },
  quickText: {
    fontSize: 10,
    color: '#F59E0B',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginTop: 12,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
  },
});