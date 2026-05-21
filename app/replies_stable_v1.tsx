import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Reply {
  id: string;
  notification_id: string;
  content: string;
  created_at: string;
  delivered: boolean;
  delivered_at: string | null;
  metadata: Record<string, any> | null;
  ai_generated?: boolean;
}

function getTimeAgo(dateString: string) {
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

export default function RepliesScreen() {
  const router = useRouter();

  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [delivering, setDelivering] = useState<string | null>(null);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState<string | null>(null);

  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.96)).current;

  const sortReplies = (data: Reply[]) => {
    return [...data].sort((a, b) => {
      if (a.delivered !== b.delivered) {
        return a.delivered ? 1 : -1;
      }

      const dateA = new Date(
        a.delivered ? a.delivered_at || a.created_at : a.created_at
      ).getTime();

      const dateB = new Date(
        b.delivered ? b.delivered_at || b.created_at : b.created_at
      ).getTime();

      return dateB - dateA;
    });
  };

  const fetchReplies = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/replies`);
      if (!response.ok) {
        throw new Error('Failed to fetch replies');
      }

      const data: Reply[] = await response.json();
      setReplies(sortReplies(data));
    } catch (err) {
      console.error('Fetch replies error:', err);
      Alert.alert('Error', 'Failed to load replies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  useEffect(() => {
    if (deleteModalVisible) {
      modalOpacity.setValue(0);
      modalScale.setValue(0.96);

      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [deleteModalVisible, modalOpacity, modalScale]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReplies();
  };

  const handleMarkDelivered = async (replyId: string) => {
    setDelivering(replyId);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/replies/${replyId}/delivered`,
        {
          method: 'PATCH',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to send reply');
      }

      const updatedReply: Reply = await response.json();

      setReplies((prev) =>
        sortReplies(
          prev.map((reply) => (reply.id === replyId ? updatedReply : reply))
        )
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send reply');
    } finally {
      setDelivering(null);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    const previousReplies = replies;

    try {
      setReplies((prev) => prev.filter((r) => r.id !== replyId));

      const response = await fetch(`${BACKEND_URL}/api/replies/${replyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }
    } catch (err) {
      setReplies(previousReplies);
      Alert.alert('Error', 'Failed to delete');
      fetchReplies();
    }
  };

  const confirmDelete = (id: string) => {
    setReplyToDelete(id);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!replyToDelete) return;

    const id = replyToDelete;
    setDeleteModalVisible(false);
    setReplyToDelete(null);

    await handleDeleteReply(id);
  };

  const handleCancelDelete = () => {
    setDeleteModalVisible(false);
    setReplyToDelete(null);
  };

  const pendingCount = replies.filter((r) => !r.delivered).length;
  const deliveredCount = replies.filter((r) => r.delivered).length;
  const aiCount = replies.filter((r) => r.ai_generated).length;
  const newestReplyId = replies[0]?.id;

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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Assistant Replies</Text>

        <View style={styles.headerRight} />
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statItem, { backgroundColor: '#10B98120' }]}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>
            {pendingCount}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>

        <View style={[styles.statItem, { backgroundColor: '#6366F120' }]}>
          <Text style={[styles.statValue, { color: '#6366F1' }]}>
            {deliveredCount}
          </Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>

        <View style={[styles.statItem, { backgroundColor: '#F59E0B20' }]}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>
            {aiCount}
          </Text>
          <Text style={styles.statLabel}>AI Generated</Text>
        </View>
      </View>

      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.replyItem,
              item.delivered && styles.replyDelivered,
              item.id === newestReplyId && styles.newestReply,
            ]}
          >
            <View style={styles.replyHeader}>
              <View style={styles.replyIconRow}>
                <View
                  style={[
                    styles.replyIconContainer,
                    {
                      backgroundColor: item.delivered
                        ? '#6366F120'
                        : '#10B98120',
                    },
                  ]}
                >
                  <Ionicons
                    name={item.delivered ? 'checkmark-done' : 'chatbox-ellipses'}
                    size={18}
                    color={item.delivered ? '#6366F1' : '#10B981'}
                  />
                </View>

                {item.ai_generated && (
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={12} color="#F59E0B" />
                    <Text style={styles.aiText}>AI</Text>
                  </View>
                )}

                {item.metadata?.provider && (
                  <View style={styles.providerBadge}>
                    <Ionicons
                      name="hardware-chip-outline"
                      size={12}
                      color="#6366F1"
                    />
                    <Text style={styles.providerText}>
                      {item.metadata.provider}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.replyTime}>{getTimeAgo(item.created_at)}</Text>
            </View>

            <Text style={styles.replyContent}>{item.content}</Text>

            <View style={styles.replyFooter}>
              {item.metadata?.simulated && (
                <View style={styles.simulatedBadge}>
                  <Ionicons name="flask" size={12} color="#F59E0B" />
                  <Text style={styles.simulatedText}>AI Generated</Text>
                </View>
              )}

              <View style={styles.footerSpacer} />

              <View style={styles.replyActions}>
                {!item.delivered ? (
                  <TouchableOpacity
                    style={styles.deliverButton}
                    onPress={() => handleMarkDelivered(item.id)}
                    disabled={delivering === item.id}
                    activeOpacity={0.8}
                  >
                    {delivering === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="push" size={14} color="#fff" />
                        <Text style={styles.deliverText}>Send Reply</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.deliveredBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#6366F1" />
                    <Text style={styles.deliveredText}>
                      Delivered{' '}
                      {item.delivered_at ? getTimeAgo(item.delivered_at) : ''}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(item.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash" size={14} color="#fff" />
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbox-outline" size={64} color="#444" />
            <Text style={styles.emptyText}>No replies yet</Text>
            <Text style={styles.emptySubtext}>
              Generate AI replies from pending notifications
            </Text>
          </View>
        }
      />

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="none"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: modalOpacity,
                transform: [{ scale: modalScale }],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="trash" size={18} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>Delete Reply</Text>
            </View>

            <Text style={styles.modalMessage}>
              This action cannot be undone.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCancelDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={handleConfirmDelete}
                activeOpacity={0.8}
              >
                <Ionicons name="trash" size={14} color="#fff" />
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
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
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  replyItem: {
    backgroundColor: '#1F1F28',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  replyDelivered: {
    borderLeftColor: '#6366F1',
    opacity: 0.92,
  },
  newestReply: {
    borderWidth: 2,
    borderColor: '#6366F1',
    backgroundColor: '#151527',
    shadowColor: '#6366F1',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  replyIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  aiText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  providerText: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '500',
  },
  replyTime: {
    fontSize: 12,
    color: '#666',
  },
  replyContent: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
  },
  replyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  simulatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  simulatedText: {
    fontSize: 11,
    color: '#F59E0B',
  },
  footerSpacer: {
    flex: 1,
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  deliverText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveredText: {
    fontSize: 12,
    color: '#6366F1',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  deleteText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
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
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#151521',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A38',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  modalIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EF444420',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalMessage: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#27272A',
  },
  modalCancelText: {
    color: '#E4E4E7',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#7F1D1D',
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});