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
import { useRouter, useLocalSearchParams } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Notification {
  id: string;
  app_package: string;
  app_name: string;
  title: string;
  content: string;
  sender: string | null;
  category: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

const getCategoryConfig = (category: string) => {
  const configs: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
    text: { icon: 'chatbubbles', color: '#10B981', label: 'Text Messages' },
    talk: { icon: 'call', color: '#3B82F6', label: 'Calls / VoIP' },
    email: { icon: 'mail', color: '#F59E0B', label: 'Email' },
    other: { icon: 'apps', color: '#8B5CF6', label: 'Other' },
  };
  return configs[category] || configs.other;
};

const getStatusConfig = (status: string) => {
  const configs: Record<string, { color: string; label: string }> = {
    pending: { color: '#F59E0B', label: 'Pending' },
    sent: { color: '#3B82F6', label: 'Sent' },
    replied: { color: '#10B981', label: 'Replied' },
    delivered: { color: '#6366F1', label: 'Delivered' },
  };
  return configs[status] || configs.pending;
};

const NotificationItem = ({
  item,
  onPress,
  onSimulateReply,
}: {
  item: Notification;
  onPress: () => void;
  onSimulateReply: () => void;
}) => {
  const statusConfig = getStatusConfig(item.status);
  const categoryConfig = getCategoryConfig(item.category);
  const timeAgo = getTimeAgo(item.created_at);

  return (
    <TouchableOpacity style={styles.notificationItem} onPress={onPress}>
      <View style={[styles.itemIcon, { backgroundColor: categoryConfig.color + '20' }]}>
        <Ionicons name={categoryConfig.icon} size={20} color={categoryConfig.color} />
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title || item.sender || item.app_name}
          </Text>
          <Text style={styles.itemTime}>{timeAgo}</Text>
        </View>
        <Text style={styles.itemMessage} numberOfLines={2}>
          {item.content}
        </Text>
        <View style={styles.itemFooter}>
          <Text style={styles.itemApp}>{item.app_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
      </View>
      {item.status === 'pending' && (
        <TouchableOpacity style={styles.replyButton} onPress={onSimulateReply}>
          <Ionicons name="chatbox-ellipses" size={18} color="#10B981" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const category = params.category as string || 'all';
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const categoryConfig = category !== 'all' ? getCategoryConfig(category) : null;

  const fetchNotifications = useCallback(async () => {
    try {
      const url = category !== 'all'
        ? `${BACKEND_URL}/api/notifications?category=${category}`
        : `${BACKEND_URL}/api/notifications`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setNotifications(data);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleSimulateReply = async (notificationId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulate/assistant-reply/${notificationId}`, {
        method: 'POST',
      });
      if (response.ok) {
        Alert.alert('Success', 'Assistant reply simulated!');
        fetchNotifications();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to simulate reply');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/notifications/${notificationId}`, {
                method: 'DELETE',
              });
              fetchNotifications();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete');
            }
          },
        },
      ]
    );
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          {categoryConfig && (
            <Ionicons name={categoryConfig.icon} size={20} color={categoryConfig.color} />
          )}
          <Text style={styles.headerTitle}>
            {categoryConfig ? categoryConfig.label : 'All Notifications'}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        renderItem={({ item }) => (
          <NotificationItem
            item={item}
            onPress={() => handleDeleteNotification(item.id)}
            onSimulateReply={() => handleSimulateReply(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>Use the Simulate feature to test</Text>
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  listContent: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
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
    marginLeft: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  itemTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  itemMessage: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  itemApp: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  replyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B98120',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    marginTop: 4,
  },
});
