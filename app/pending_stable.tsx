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
  Switch,
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
  created_at?: string;
  source?: string;
  status?: string;
}

export default function PendingScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'leads'>('all');
  const [draftReadyIds, setDraftReadyIds] = useState<string[]>([]);
  const [autoSend, setAutoSend] = useState(false);

  const isWebsiteLead = (item: Notification) =>
    item.source === 'paid.searlio.com' ||
    item.app_name === 'Website Lead' ||
    (item.title || '').toLowerCase().includes('lead');

  const isHighValueLead = (item: Notification) => {
    const text = (item.content || '').toLowerCase();

    return (
      text.length > 80 ||
      text.includes('quote') ||
      text.includes('price') ||
      text.includes('help') ||
      text.includes('service')
    );
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications`);
      const data = await res.json();

      const sorted = [...data].sort((a, b) => {
        const aLead = isWebsiteLead(a);
        const bLead = isWebsiteLead(b);
        const aHigh = aLead && isHighValueLead(a);
        const bHigh = bLead && isHighValueLead(b);

        if (aHigh !== bHigh) return aHigh ? -1 : 1;
        if (aLead !== bLead) return aLead ? -1 : 1;

        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      });

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

  const openRepliesTab = (replyId?: string) => {
    const url = replyId ? `/replies?highlight=${replyId}` : '/replies';

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      router.push('/replies');
    }
  };

  const handleGenerateAIReply = async (id: string) => {
    setGeneratingAI(id);

    const item = notifications.find((n) => n.id === id);
    const isLead = !!(item && isWebsiteLead(item));
    const isHighValue = !!(item && isHighValueLead(item));
    const shouldAutoSend = !!(autoSend && isLead && isHighValue);

    const newTab =
      !shouldAutoSend && typeof window !== 'undefined'
        ? window.open('about:blank', '_blank')
        : null;

    try {
      const res = await fetch(`${BACKEND_URL}/api/llm/generate-reply/${id}`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('AI failed');

      const data = await res.json();
      const replyId = data?.id;

      setDraftReadyIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

      if (shouldAutoSend && replyId) {
        const approveRes = await fetch(
          `${BACKEND_URL}/api/replies/${replyId}/approve`,
          { method: 'PATCH' }
        );

        if (!approveRes.ok) throw new Error('Approve failed');

        const sendRes = await fetch(
          `${BACKEND_URL}/api/replies/${replyId}/delivered`,
          { method: 'PATCH' }
        );

        if (!sendRes.ok) {
          const sendData = await sendRes.json().catch(() => ({}));
          throw new Error(sendData?.detail || 'Send failed');
        }

        Alert.alert('🔥 High Value Lead', 'Replied instantly');
        await fetchNotifications();
        return;
      }

      Alert.alert('Success', 'AI reply generated');

      const url = replyId ? `/replies?highlight=${replyId}` : '/replies';

      if (newTab) {
        newTab.location.href = url;
      } else {
        router.push('/replies');
      }

      fetchNotifications();
    } catch (err: any) {
      if (newTab) newTab.close();
      Alert.alert('Error', err?.message || 'Failed to generate AI reply');
    } finally {
      setGeneratingAI(null);
    }
  };

  const visibleNotifications = notifications.filter(
    (item) => item.status !== 'delivered'
  );

  const filteredNotifications =
    filter === 'leads'
      ? visibleNotifications.filter(isWebsiteLead)
      : visibleNotifications;

  const highValueCount = visibleNotifications.filter(
    (item) => isWebsiteLead(item) && isHighValueLead(item)
  ).length;

  const leadCount = visibleNotifications.filter(isWebsiteLead).length;

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'text':
        return '#10B981';
      case 'email':
        return '#6366F1';
      case 'call':
      case 'talk':
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
      case 'talk':
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

      <View style={styles.topControls}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
            onPress={() => setFilter('all')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'all' && styles.activeFilterText,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'leads' && styles.activeFilter,
            ]}
            onPress={() => setFilter('leads')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'leads' && styles.activeFilterText,
              ]}
            >
              Leads
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.autoSendRow}>
          <Text style={styles.autoSendLabel}>Auto Send Leads</Text>
          <Switch
            value={autoSend}
            onValueChange={setAutoSend}
            trackColor={{ false: '#334155', true: '#22C55E' }}
            thumbColor={autoSend ? '#07130B' : '#E5E7EB'}
          />
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryHigh]}>
            <Text style={styles.summaryNumber}>{highValueCount}</Text>
            <Text style={styles.summaryLabel}>High Value</Text>
          </View>

          <View style={[styles.summaryCard, styles.summaryLead]}>
            <Text style={styles.summaryNumber}>{leadCount}</Text>
            <Text style={styles.summaryLabel}>Leads</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredNotifications}
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
          const isLead = isWebsiteLead(item);
          const isHighValue = isLead && isHighValueLead(item);
          const isDraftReady = draftReadyIds.includes(item.id);

          return (
            <View
              style={[
                styles.notificationItem,
                isLead && styles.leadItem,
                isDraftReady && !autoSend && styles.draftReadyItem,
                isHighValue && styles.highValueItem,
              ]}
            >
              <View style={[styles.itemIcon, { backgroundColor: color + '20' }]}>
                <Ionicons
                  name={getCategoryIcon(item.category) as any}
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

                <View style={styles.metaRow}>
                  {!isLead && <Text style={styles.itemApp}>{item.app_name}</Text>}
                  {isLead && <Text style={styles.leadBadge}>WEBSITE LEAD</Text>}
                  {isHighValue && (
                    <Text style={styles.highValueBadge}>🔥 HIGH VALUE</Text>
                  )}
                  {isDraftReady && !autoSend && (
                    <Text style={styles.draftReadyBadge}>DRAFT READY</Text>
                  )}
                  {autoSend && isLead && (
                    <Text style={styles.autoSendBadge}>AUTO SEND ON</Text>
                  )}
                </View>

                {isDraftReady && !autoSend && (
                  <TouchableOpacity
                    style={styles.openRepliesButton}
                    onPress={() => openRepliesTab()}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="open-outline" size={14} color="#C7D2FE" />
                    <Text style={styles.openRepliesText}>Open Replies</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.aiButton}
                  onPress={() => handleGenerateAIReply(item.id)}
                  disabled={isGenerating}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonInner}>
                    {isGenerating ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <Ionicons name="sparkles" size={18} color="#10B981" />
                    )}
                    <Text style={styles.aiText}>AI</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={64}
              color="#10B981"
            />
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'leads' ? 'No website leads' : 'No pending notifications'}
            </Text>
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
  topControls: {
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 16,
    gap: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1F1F28',
  },
  activeFilter: {
    backgroundColor: '#22C55E',
  },
  filterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#07130B',
  },
  autoSendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F1F28',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  autoSendLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  summaryHigh: {
    backgroundColor: '#3A1518',
  },
  summaryLead: {
    backgroundColor: '#13201B',
  },
  summaryNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#CFCFCF',
    fontSize: 12,
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
  leadItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
    backgroundColor: '#1A2A22',
  },
  highValueItem: {
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  draftReadyItem: {
    borderColor: '#6366F1',
    borderWidth: 1,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  itemApp: {
    color: '#666',
    fontSize: 11,
  },
  leadBadge: {
    backgroundColor: '#22C55E',
    color: '#07130B',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  highValueBadge: {
    backgroundColor: '#EF4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  draftReadyBadge: {
    backgroundColor: '#6366F1',
    color: '#E0E7FF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  autoSendBadge: {
    backgroundColor: '#F59E0B',
    color: '#111827',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  openRepliesButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openRepliesText: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonInner: {
    alignItems: 'center',
  },
  aiButton: {
    backgroundColor: '#10B98120',
    padding: 8,
    borderRadius: 8,
  },
  aiText: {
    fontSize: 10,
    color: '#10B981',
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