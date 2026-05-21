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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Reply {
  id: string;
  notification_id: string;
  content: string;
  created_at?: string;
  approved?: boolean;
  delivered?: boolean;
  delivered_at?: string | null;
  ai_generated?: boolean;
  metadata?: {
    provider?: string;
    sid?: string;
    to?: string;
    edited?: boolean;
    replaces_reply_id?: string;
    [key: string]: any;
  };
}

interface NotificationLite {
  id: string;
  title?: string;
  sender?: string;
  app_name?: string;
  content?: string;
}

interface Thread {
  notification_id: string;
  notification?: NotificationLite;
  replies: Reply[];
  latestAt: number;
}

export default function RepliesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const highlightId =
    typeof params.highlight === 'string' ? params.highlight : null;

  const [replies, setReplies] = useState<Reply[]>([]);
  const [notificationsById, setNotificationsById] = useState<Record<string, NotificationLite>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  const fetchReplies = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/replies`);
      const data = await res.json();

      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );

      setReplies(sorted);

      const uniqueNotificationIds = Array.from(
        new Set(sorted.map((r: Reply) => r.notification_id).filter(Boolean))
      );

      const allRes = await fetch(`${BACKEND_URL}/api/notifications`);
      const allNotifications = allRes.ok ? await allRes.json() : [];
      
      const entries = uniqueNotificationIds.map((id) => {
        const found = allNotifications.find(
          (n: any) => n.id === id || n._id === id || n.notification_id === id
        );
      
        return [id, found || null] as const;
      });

      const map: Record<string, NotificationLite> = {};
      entries.forEach(([id, value]) => {
        if (value) map[id] = value;
      });
      setNotificationsById(map);
    } catch {
      Alert.alert('Error', 'Failed to load replies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReplies();
    const timer = setInterval(fetchReplies, 8000);
    return () => clearInterval(timer);
  }, [fetchReplies]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReplies();
  };

  const handleSendNow = async (replyId: string) => {
    setSendingId(replyId);
    ////////////////////////////////////////////////////////////////////////////////
    console.log("HANDLE SEND NOW:", replyId);

const approveRes = await fetch(
  `${BACKEND_URL}/api/replies/${replyId}/approve`,
  { method: "PATCH" }
);

console.log("APPROVE STATUS:", approveRes.status);

const sendRes = await fetch(
  `${BACKEND_URL}/api/replies/${replyId}/delivered`,
  { method: "PATCH" }
);

console.log("DELIVER STATUS:", sendRes.status);
    try {
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
        const data = await sendRes.json().catch(() => ({}));
        throw new Error(data?.detail || 'Send failed');
      }

      await fetchReplies();
      Alert.alert('Sent', 'Reply sent successfully 🚀');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send reply');
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (replyId: string) => {
    const proceed =
      typeof window !== 'undefined'
        ? window.confirm('Are you sure you want to delete this reply?')
        : true;

    if (!proceed) return;

    setDeletingId(replyId);

    try {
      const res = await fetch(`${BACKEND_URL}/api/replies/${replyId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Delete failed');

      await fetchReplies();
    } catch {
      Alert.alert('Error', 'Failed to delete reply');
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (item: Reply) => {
    setEditingId(item.id);
    setEditedContent(item.content || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditedContent('');
  };

  const handleSaveEdit = async (item: Reply, sendAfter = false) => {
    const trimmed = editedContent.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Reply cannot be empty.');
      return;
    }

    setSavingEditId(item.id);

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/notifications/${item.notification_id}/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: trimmed,
            metadata: {
              edited: true,
              replaces_reply_id: item.id,
            },
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Failed to save edited reply');
      }

      const createdReply = await res.json();

      setEditingId(null);
      setEditedContent('');
      await fetchReplies();

      if (sendAfter && createdReply?.id) {
        await handleSendNow(createdReply.id);
      } else {
        Alert.alert('Saved', 'Edited reply created.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save edited reply');
    } finally {
      setSavingEditId(null);
    }
  };

  const formatTime = (value?: string | null) => {
    if (!value) return 'Just now';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Just now';
    return d.toLocaleString();
  };

  const buildThreads = (): Thread[] => {
    const grouped: Record<string, Reply[]> = {};

    for (const reply of replies) {
      if (!grouped[reply.notification_id]) grouped[reply.notification_id] = [];
      grouped[reply.notification_id].push(reply);
    }

    return Object.entries(grouped)
      .map(([notification_id, threadReplies]) => ({
        notification_id,
        notification: notificationsById[notification_id],
        replies: threadReplies.sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
        ),
        latestAt: Math.max(
          ...threadReplies.map((r) => new Date(r.created_at || 0).getTime())
        ),
      }))
      .sort((a, b) => b.latestAt - a.latestAt);
  };

  const threads = buildThreads();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/pending')}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Reply Threads</Text>

        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={threads}
        keyExtractor={(item) => item.notification_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
        renderItem={({ item: thread }) => {
          const title =
            thread.notification?.title ||
            thread.notification?.sender ||
            thread.notification?.app_name ||
            'Conversation';

          const subtitle =
            thread.notification?.app_name || thread.notification?.sender || '';

          const hasHighlighted = thread.replies.some((r) => r.id === highlightId);
          const sentCount = thread.replies.filter((r) => r.delivered).length;
          const draftCount = thread.replies.filter((r) => !r.delivered).length;

          return (
            <View style={[styles.threadCard, hasHighlighted && styles.threadHighlight]}>
              <View style={styles.threadHeader}>
                <View style={styles.threadHeaderLeft}>
                  <Text style={styles.threadTitle}>{title}</Text>
                  {!!subtitle && <Text style={styles.threadSubtitle}>{subtitle}</Text>}
                </View>
                <Text style={styles.threadTime}>
                  {formatTime(new Date(thread.latestAt).toISOString())}
                </Text>
              </View>

              {!!thread.notification?.content && (
                <View style={styles.incomingWrap}>
                  <View style={styles.incomingBubble}>
                    <View style={styles.incomingTop}>
                      <View style={styles.incomingPill}>
                        <Ionicons name="person-outline" size={12} color="#93C5FD" />
                        <Text style={styles.incomingPillText}>Incoming</Text>
                      </View>
                    </View>

                    <Text style={styles.incomingText}>
                      {thread.notification.content}
                    </Text>
                  </View>
                </View>
              )}

              {thread.replies.map((reply) => {
                const isEditing = editingId === reply.id;
                const isSending = sendingId === reply.id;
                const isDeleting = deletingId === reply.id;
                const isSavingEdit = savingEditId === reply.id;
                const isDraft = !reply.delivered;
                const isManual = !reply.ai_generated && !reply.metadata?.edited;

                return (
                  <View
                    key={reply.id}
                    style={[
                      styles.replyBubble,
                      isDraft ? styles.replyDraftBubble : styles.replySentBubble,
                      reply.id === highlightId && styles.replyHighlight,
                    ]}
                  >
                    <View style={styles.bubbleTop}>
                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.statusBadge,
                            isDraft ? styles.badgeDraft : styles.badgeSent,
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {isDraft ? 'Draft' : 'Sent'}
                          </Text>
                        </View>

                        {reply.ai_generated && (
                          <View style={[styles.smallPill, styles.aiPill]}>
                            <Ionicons name="sparkles" size={12} color="#F59E0B" />
                            <Text style={styles.smallPillText}>AI</Text>
                          </View>
                        )}

                        {reply.metadata?.edited && (
                          <View style={[styles.smallPill, styles.editedPill]}>
                            <Text style={styles.smallPillText}>edited</Text>
                          </View>
                        )}

                        {isManual && (
                          <View style={[styles.smallPill, styles.manualPill]}>
                            <Text style={styles.smallPillText}>manual</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.timeText}>
                        {reply.delivered
                          ? formatTime(reply.delivered_at)
                          : formatTime(reply.created_at)}
                      </Text>
                    </View>

                    {isEditing ? (
                      <View style={styles.editWrap}>
                        <TextInput
                          style={styles.editInput}
                          multiline
                          value={editedContent}
                          onChangeText={setEditedContent}
                          placeholder="Edit your reply..."
                          placeholderTextColor="#777"
                        />

                        <View style={styles.editActions}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.saveButton]}
                            onPress={() => handleSaveEdit(reply, false)}
                            disabled={isSavingEdit}
                            activeOpacity={0.8}
                          >
                            {isSavingEdit ? (
                              <ActivityIndicator size="small" color="#0B0F14" />
                            ) : (
                              <>
                                <Ionicons
                                  name="save-outline"
                                  size={15}
                                  color="#0B0F14"
                                />
                                <Text style={styles.saveButtonText}>Save Draft</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionButton, styles.sendButton]}
                            onPress={() => handleSaveEdit(reply, true)}
                            disabled={isSavingEdit}
                            activeOpacity={0.8}
                          >
                            {isSavingEdit ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="rocket" size={15} color="#fff" />
                                <Text style={styles.sendButtonText}>Save + Send</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionButton, styles.cancelButton]}
                            onPress={cancelEditing}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="close" size={15} color="#fff" />
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.replyText}>{reply.content}</Text>

                        <View style={styles.actionRow}>
                          {isDraft && (
                            <TouchableOpacity
                              style={[styles.actionButton, styles.editButton]}
                              onPress={() => startEditing(reply)}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name="create-outline"
                                size={15}
                                color="#fff"
                              />
                              <Text style={styles.editButtonText}>Edit</Text>
                            </TouchableOpacity>
                          )}

                          {isDraft && (
                            <TouchableOpacity
                              style={[styles.actionButton, styles.sendButton]}
                              onPress={() => {
                                console.log("SEND BUTTON PRESSED", reply.id);
                                handleSendNow(reply.id);
                              }}
                              disabled={isSending}
                              activeOpacity={0.8}
                            >
                              {isSending ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <Ionicons name="send" size={15} color="#fff" />
                                  <Text style={styles.sendButtonText}>Send Now</Text>
                                  
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={[styles.actionButton, styles.deleteButton]}
                            onPress={() => handleDelete(reply.id)}
                            disabled={isDeleting}
                            activeOpacity={0.8}
                          >
                            {isDeleting ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="trash" size={15} color="#fff" />
                                <Text style={styles.deleteButtonText}>Delete</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        {reply.delivered && (
                          <View style={styles.deliveryRow}>
                            <Ionicons
                              name="paper-plane-outline"
                              size={16}
                              color="#A5B4FC"
                            />
                            <View>
                              <Text style={styles.deliveryText}>Sent successfully</Text>
                              <Text style={styles.deliverySubtext}>
                                {reply.metadata?.to
                                  ? `Sent to ${reply.metadata.to}`
                                  : 'Destination confirmed'}
                              </Text>
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })}

              <View style={styles.threadFooter}>
                <Text style={styles.threadFooterText}>
                  {thread.replies.length} replies
                </Text>
                <Text style={styles.threadFooterDot}>•</Text>
                <Text style={styles.threadFooterText}>
                  {sentCount} sent
                </Text>
                <Text style={styles.threadFooterDot}>•</Text>
                <Text style={styles.threadFooterText}>
                  {draftCount} draft
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={64}
              color="#555"
            />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Generate an AI reply from Pending to start a thread.
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
    backgroundColor: '#0B0F14',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2430',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  threadCard: {
    backgroundColor: '#141922',
    borderWidth: 1,
    borderColor: '#222938',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  threadHighlight: {
    shadowColor: '#818CF8',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  threadHeaderLeft: {
    flex: 1,
  },
  threadTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  threadSubtitle: {
    color: '#8B949E',
    fontSize: 12,
    marginTop: 2,
  },
  threadTime: {
    color: '#8B949E',
    fontSize: 11,
  },
  incomingWrap: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  incomingBubble: {
    maxWidth: '88%',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#243041',
    borderRadius: 16,
    padding: 12,
  },
  incomingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  incomingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#172554',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  incomingPillText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '700',
  },
  incomingText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 21,
  },
  replyBubble: {
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
  },
  replyDraftBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#13201B',
    borderColor: '#2F855A',
  },
  replySentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#171A34',
    borderColor: '#4F46E5',
    opacity: 0.9,
  },
  replyHighlight: {
    shadowColor: '#818CF8',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  bubbleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeDraft: {
    backgroundColor: '#14532D',
  },
  badgeSent: {
    backgroundColor: '#3730A3',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  smallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aiPill: {
    backgroundColor: '#3A2A11',
  },
  editedPill: {
    backgroundColor: '#1F2937',
  },
  manualPill: {
    backgroundColor: '#164E63',
  },
  smallPillText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '600',
  },
  timeText: {
    color: '#8B949E',
    fontSize: 12,
  },
  replyText: {
    color: '#F3F4F6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  editWrap: {
    marginTop: 4,
  },
  editInput: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    color: '#fff',
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actionButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    backgroundColor: '#334155',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#F59E0B',
  },
  saveButtonText: {
    color: '#0B0F14',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelButton: {
    backgroundColor: '#475569',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  sendButton: {
    backgroundColor: '#4F46E5',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteButton: {
    backgroundColor: '#991B1B',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  deliveryText: {
    color: '#C7D2FE',
    fontSize: 13,
    fontWeight: '700',
  },
  deliverySubtext: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  threadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 12,
  },
  threadFooterText: {
    color: '#7C8595',
    fontSize: 11,
    fontWeight: '600',
  },
  threadFooterDot: {
    color: '#4B5563',
    fontSize: 11,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 90,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
