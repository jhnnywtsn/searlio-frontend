import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Switch,
  LayoutAnimation,
  UIManager,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInUp } from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";


const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Notification {
  id: string;
  title?: string;
  content: string;
  sender?: string;
  app_name?: string;
  app_package?: string;
  category?: string;
  created_at?: string;
  timestamp?: string;
  sent_at?: string;
  source?: string;
  status?: string;
}

export default function PendingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const routeFilter = String(params.route || "");
  const priorityFilter = String(params.priority || "");
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "leads">("all");
  const [draftReadyIds, setDraftReadyIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>({
    autoSend: false,
    highPriorityOnly: false,
    skipSignal: false,
  });
  const isLeadsMode = settings?.accountMode === "leads";
  const [sentFlashIds, setSentFlashIds] = useState<string[]>([]);
  const [undoItems, setUndoItems] = useState<Notification[]>([]);
  const [undoTimer, setUndoTimer] = useState<any>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  
  useEffect(() => {
    const ping = () => {
      fetch("https://searlio.com/health").catch(() => {});
    };

    ping();

    const interval = setInterval(ping, 300000);

    return () => clearInterval(interval);
  }, []);  
  const animateNext = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const lightTap = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
  };

  const successTap = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const warningTap = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  };

  const showToast = (message: string) => {
    setToast(message);

    setTimeout(() => {
      setToast(null);
    }, 1800);
  };

  const isWebsiteLead = (item: Notification) =>
    item.source === "website" ||
    item.source === "paid.searlio.com" ||
    item.source === "com.searlio.website.leads" ||
    item.app_name === "Website Lead" ||
    (item.title || "").toLowerCase().includes("lead");

  const isHighValueLead = (item: Notification) => {
    const text = (item.content || "").toLowerCase();

    return (
      text.length > 80 ||
      text.includes("quote") ||
      text.includes("price") ||
      text.includes("help") ||
      text.includes("service")
    );
  };

  const isAllowedBySettings = (item: Notification) => {
    const category = (item.category || "").toLowerCase();
    const app = `${item.app_name || ""} ${item.app_package || ""} ${
      item.source || ""
    }`.toLowerCase();

    const isText =
      category === "text" ||
      app.includes("sms") ||
      app.includes("whatsapp") ||
      app.includes("signal") ||
      app.includes("telegram") ||
      app.includes("textnow") ||
      app.includes("googlevoice");

    const isEmail =
      category === "email" ||
      category === "mail" ||
      app.includes("gmail") ||
      app.includes("google.android.gm") ||
      app.includes("outlook") ||
      app.includes("yahoo") ||
      app.includes("mail");

    const isCall =
      category === "call" ||
      category === "talk" ||
      category === "voice" ||
      app.includes("phone");

    if (isEmail) return settings.allowEmail !== false;
    if (isText) return settings.allowTexts !== false;
    if (isCall) return settings.allowCalls !== false;
    if (isWebsiteLead(item)) return settings.allowWebsiteLeads !== false;

    return settings.allowOther === true;
  };

  const getGroupKey = (item: Notification) =>
    item.sender || item.title || item.app_package || item.app_name || item.id;

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
      const withRoutes = await Promise.all(
              sorted.map(async (item: any) => {
                try {
                  const routeRes = await fetch(
                    `${BACKEND_URL}/api/notifications/${item.id}/route`
                  );
                  const routeData = await routeRes.json();
            
                  return {
                    ...item,
                    route_data: routeData,
                  };
                } catch {
                  return item;
                }
              })
            );      
      animateNext();
      setNotifications(withRoutes);
    } catch (err) {
      showToast("Could not load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  const newestId = notifications?.[0]?.id;
  useEffect(() => {
    loadSettings();
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;
  
    const url = new URL(window.location.href);
    const isDemo = url.searchParams.get("demo") === "true";
    if (!isDemo) return;
  
    const runDemo = async () => {
      try {
        const beforeRes = await fetch(`${BACKEND_URL}/api/notifications`);
        const beforeData = await beforeRes.json();
        const beforeIds = new Set(
          Array.isArray(beforeData) ? beforeData.map((n: Notification) => n.id) : []
        );
  
        await fetch(`${BACKEND_URL}/api/simulate/notification?category=text`, {
          method: "POST",
        });
  
        await new Promise((resolve) => setTimeout(resolve, 900));
  
        const afterRes = await fetch(`${BACKEND_URL}/api/notifications`);
        const afterData = await afterRes.json();
  
        const newestDemo = Array.isArray(afterData)
          ? afterData
              .filter((n: Notification) => !beforeIds.has(n.id))
              .sort(
                (a: Notification, b: Notification) =>
                  new Date(b.created_at || 0).getTime() -
                  new Date(a.created_at || 0).getTime()
              )[0]
          : null;
  
        await fetchNotifications();
  
        if (newestDemo?.id) {
          window.sessionStorage.setItem("searlio_demo_autoread", "true");
          router.replace({
            pathname: "/conversation/[id]",
            params: {
              id: newestDemo.id,
              demo: "true",
            },
        } as any);
        } else {
          showToast("Demo lead created — check the newest card 👇");
        }
      } catch (err) {
        console.log("demo error", err);
        showToast("Demo could not start");
      }
    };
  
    runDemo();
  }, []);
  
  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem("searlio_settings");
      if (saved) {
        setSettings((prev: any) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {
      console.log("settings load error", e);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    try {
      await AsyncStorage.setItem("searlio_settings", JSON.stringify(updated));
    } catch (e) {
      console.log("settings save error", e);
    }
  };


  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleDeleteNotification = async (item: Notification) => {
    await warningTap();

    const groupKey = getGroupKey(item);
    const removed = notifications.filter((n) => getGroupKey(n) === groupKey);

    animateNext();
    setNotifications((prev) => prev.filter((n) => getGroupKey(n) !== groupKey));
    setUndoItems(removed);

    if (undoTimer) clearTimeout(undoTimer);

    const timer = setTimeout(async () => {
      try {
        await fetch(`${BACKEND_URL}/api/notifications/delete-group`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_key: groupKey }),
        });

        setUndoItems([]);
        await successTap();
      } catch (err) {
        fetchNotifications();
      }
    }, 5000);

    setUndoTimer(timer);
  };

  const handleUndoDelete = async () => {
    if (!undoItems.length) return;

    if (undoTimer) {
      clearTimeout(undoTimer);
      setUndoTimer(null);
    }

    animateNext();
    setNotifications((prev) => [...undoItems, ...prev]);
    setUndoItems([]);
    await lightTap();
  };

  const handleClearPending = async () => {
    try {
      await warningTap();

      const confirmed =
        typeof window !== "undefined"
          ? window.confirm("Delete EVERYTHING? This cannot be undone.")
          : true;

      if (!confirmed) return;

      const res = await fetch(`${BACKEND_URL}/api/notifications/clear-all`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Clear all failed");
      }

      animateNext();
      setNotifications([]);
      await successTap();
    } catch (err: any) {
      showToast(err?.message || "Could not clear dashboard");
    }
  };

    const openRepliesTab = (replyId?: string) => {
    const path = replyId ? `/replies?highlight=${replyId}` : `/replies`;

    router.push(path as any);
  };

  const handleGenerateAIReply = async (id: string) => {
    await lightTap();
    setGeneratingAI(id);
  
    const item = notifications.find(
      (n) => n.id === id || n._id === id || n.notification_id === id
    );
    const isLead = !!(item && isWebsiteLead(item));
    const isHighValue = !!(item && isHighValueLead(item));
    const shouldAutoSend = !!(settings.autoSend && isLead);
  
    try {
      alert("GATE TEST");
      return;
      const realId = item?.id || item?._id || item?.notification_id;

      if (true) {
        alert("Start your free trial to unlock AI replies.");
        return;
      }

      const res = await fetch(`${BACKEND_URL}/api/llm/generate-reply/${realId}`,  {
        method: "POST",
      });
  
      if (!res.ok) throw new Error("AI failed");
  
      const data = await res.json();
      console.log("AI GENERATE RESPONSE:", data);
      
      const replyContent =
        data?.content ||
        data?.reply ||
        data?.data?.content;
      
      if (!replyContent) {
        throw new Error("AI generated no reply content");
      }
      
      const saveRes = await fetch(
        `${BACKEND_URL}/api/notifications/${id}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: replyContent,
            ai_generated: true,
            metadata: data?.metadata || {},
          }),
        }
      );
      
      if (!saveRes.ok) {
        throw new Error("Reply generated but failed to save");
      }
      
      const savedReply = await saveRes.json();
      const replyId = savedReply?.id || savedReply?.reply_id;
      
 //     router.push((replyId ? `/replies?highlight=${replyId}` : "/replies") as any);
      
      // mark draft ready
      setDraftReadyIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  
      // 🔥 AUTO SEND FLOW (only for high value leads)
      if (shouldAutoSend && replyId) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  
        // remove card immediately
        setNotifications((prev) => prev.filter((n) => n.id !== id));
  
        const approveRes = await fetch(
          `${BACKEND_URL}/api/replies/${replyId}/approve`,
          { method: "PATCH" }
        );
  
        if (!approveRes.ok) throw new Error("Approve failed");
  
        const sendRes = await fetch(
          `${BACKEND_URL}/api/replies/${replyId}/delivered`,
          { method: "PATCH" }
        );
  
        if (!sendRes.ok) throw new Error("Send failed");
  
        await successTap();
        showToast("⚡ Lead handled instantly");
  
        return;
      }
  
      // 🔥 NORMAL FLOW → go to replies
      await successTap();
      showToast("✨ AI reply ready");
  
      const url = replyId ? `/replies?highlight=${replyId}` : "/replies";
      router.push(url as any);
  
    } catch (err: any) {
      showToast(err?.message || "AI reply failed");
    } finally {
      setGeneratingAI(null);
    }
  };
  const visibleNotifications = notifications.filter((item) => {
    if (
      item.status === "delivered" ||
      item.status === "replied" ||
      item.status === "completed" ||
      item.status === "sent"
    ) {
      return false;
    }
    
    if (
      routeFilter &&
      item.route_data?.route !== routeFilter
    ) {
      return false;
    }

    if (
      priorityFilter &&
      item.route_data?.priority !== priorityFilter
    ) {
      return false;
    }

    // Global noise filter only. This should not override All / Leads.
    if (settings.skipSignal && item.source === "signal") {
      return false;
    }
    if (
      settings.skipTelegram &&
      (
        item.app_package === "org.telegram.messenger" ||
        item.source === "telegram"
      )
    ) {
      return false;
    }
    const title = String(item.title || "").toLowerCase();
    const content = String(
      item.content ||
      (item as any).message ||
      (item as any).body ||
      ""
    ).toLowerCase();
    
    const isJunkSummary =
      title.includes("new messages") ||
      content.includes("new messages") ||
      title.includes("syncing") ||
      content.includes("syncing new email") ||
      title.includes("new email") ||
      content.includes("new email") ||
      title.includes("checking for mail") ||
      content.includes("checking for mail");
    
    if (isJunkSummary) {
      return false;
    }
    const cleanContent = String(
      item.content ||
      (item as any).message ||
      (item as any).body ||
      ""
    ).trim();
    
    if (!cleanContent) {
      return false;
    }
    if (!isAllowedBySettings(item)) {
      return false;
    }
    return true;
  });

  const filteredNotifications =
    filter === "leads"
      ? visibleNotifications.filter((item) => {
          if (!isWebsiteLead(item)) return false;
          if (settings.highPriorityOnly) return isHighValueLead(item);
          return true;
        })
      : visibleNotifications;

  

  const getItemTime = (item: Notification) => {
    const value = item.created_at || item.timestamp || item.sent_at || "";
  
    if (!value) return 0;
  
    const normalized =
      value.endsWith("Z") || value.includes("+") ? value : `${value}Z`;
  
    const time = new Date(normalized).getTime();
  
    return Number.isNaN(time) ? 0 : time;
  };
  const groupedNotifications = Object.values(
    filteredNotifications.reduce((groups: Record<string, Notification>, item) => {
      const key = getGroupKey(item);
      const existing = groups[key];

      if (!existing) {
        groups[key] = {
          ...item,
          extra_count: 1,
        } as any;
        return groups;
      }

      const existingTime = new Date(existing.created_at || 0).getTime();
      const itemTime = new Date(item.created_at || 0).getTime();

      if (itemTime > existingTime) {
        groups[key] = {
          ...item,
          extra_count: ((existing as any).extra_count || 1) + 1,
        } as any;
      } else {
        (groups[key] as any).extra_count =
          ((groups[key] as any).extra_count || 1) + 1;
      }

      return groups;
    }, {})
  );
  const listData = [...groupedNotifications].sort((a, b) => {
    const aLead = isWebsiteLead(a);
    const bLead = isWebsiteLead(b);
    const aHigh = aLead && isHighValueLead(a);
    const bHigh = bLead && isHighValueLead(b);
    const aText = a.route_data?.route === "text_sms";
    const bText = b.route_data?.route === "text_sms";

    if (aHigh !== bHigh) return aHigh ? -1 : 1;
    if (aLead !== bLead) return aLead ? -1 : 1;
    if (aText !== bText) return aText ? -1 : 1;
    return getItemTime(b) - getItemTime(a);
  });
  

  const highValueCount = visibleNotifications.filter(
    (item) => isWebsiteLead(item) && isHighValueLead(item)
  ).length;

  const leadCount = visibleNotifications.filter(isWebsiteLead).length;

  const getCategoryColor = (item: any) => {
    if (item.route_data?.route === "text_sms") return "#22C55E";
    if (isWebsiteLead(item)) return "#EF4444";

    switch (item.category) {
      case "text":
        return "#22C55E";
      case "email":
        return "#6366F1";
      case "voice":
        return "#06B6D4";
      case "call":
      case "talk":
        return "#F59E0B";
      default:
        return "#94A3B8";
    }
  };

  const getCategoryIcon = (item: any) => {
    const category =
      item.route_data?.route === "text_sms" || item.sender === "Google Voice"
        ? "text"
        : item.category;
    switch (category) {
      case "text":
        return "chatbubble";
      case "email":
        return "mail";
      case "call":
      case "talk":
        return "call";
      default:
        return "notifications";
    }
  };
  const formatAppName = (item: Notification) => {
    if (item.sender === "Google Voice") {
      return "Google Voice";
    }

    if (item.app_package === "com.google.android.apps.googlevoice") {
      return "Google Voice";
    }

    if (item.app_package === "com.google.android.gm") {
      return item.route_data?.route === "text_sms" ? "SMS via Gmail" : "Gmail";
    }

    const raw = (
      item.app_name ||
      item.app_package ||
      item.source ||
      
      ""
    ).toLowerCase();


    if (raw.includes("googlevoice")) return "Google Voice";  
    if (raw.includes("telegram")) return "Telegram";
    if (raw.includes("whatsapp")) return "WhatsApp";
    if (raw.includes("signal") || raw.includes("thoughtcrime")) {
      return "Signal";
    }
    if (
      raw.includes("gmail") &&
      item.route_data?.route !== "text_sms"
    )
      return "Gmail";
    if (raw.includes("outlook")) return "Outlook";
    if (raw.includes("textnow")) return "TextNow";
    if (raw.includes("messaging")) return "Messages";
    if (raw.includes("facebook") || raw.includes("orca")) return "Messenger";
    if (raw.includes("website")) return "Website";
  
    return item.app_name || "Notification";
  };
  const formatDateTime = (value?: string) => {
    if (!value) return "";

    const normalized = value.endsWith("Z") ? value : `${value}Z`;
    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>
                {isLeadsMode
                  ? "Lead Command Center"
                  : "Notification Inbox"}
              </Text>
          
              <View
                style={[
                  styles.modePill,
                  isLeadsMode
                    ? styles.modePillLeads
                    : styles.modePillInbox,
                ]}
              >
                <Text style={styles.modePillText}>
                  {isLeadsMode
                    ? "LEADS MODE"
                    : "INBOX MODE"}
                </Text>
              </View>
            </View>
          
            <Text style={styles.headerSub}>
              {isLeadsMode
                ? "Prioritize and respond to high-value leads."
                : "Only what matters. Right when you need it."}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.settingsHeaderButton}
              onPress={() => router.push("/settings" as any)}
              activeOpacity={0.8}
            >
            <Ionicons name="settings-outline" size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voiceHeaderButton}
              onPress={() => router.push("/voice" as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="mic-outline" size={18} color="#22C55E" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearPending}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.topControls}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, filter === "all" && styles.activeFilter]}
            onPress={() => setFilter("all")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === "all" && styles.activeFilterText,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === "leads" && styles.activeFilter,
            ]}
            onPress={() => setFilter("leads")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === "leads" && styles.activeFilterText,
              ]}
            >
              Leads
            </Text>
          </TouchableOpacity>
        </View>

        
            
              
               
      </View>

      {undoItems.length > 0 && (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>
            {undoItems.length > 1
              ? `${undoItems.length} messages removed`
              : "Card removed"}
          </Text>

          <TouchableOpacity
            onPress={handleUndoDelete}
            style={styles.undoButton}
            activeOpacity={0.8}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {(routeFilter || priorityFilter) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: "#374151",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            marginHorizontal: 16,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "700",
            }}
          >
            FILTER:
            {" "}
            {routeFilter
              ? routeFilter.toUpperCase()
              : priorityFilter.toUpperCase()}
          </Text>
      
          <TouchableOpacity
            onPress={() => router.push("/pending")}
          >
            <Text
              style={{
                color: "#60A5FA",
                fontWeight: "700",
              }}
            >
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={visibleNotifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#22C55E"
          />
        }
        renderItem={({ item }) => {
          const color = getCategoryColor(item);
          const isGenerating = generatingAI === item.id;
          const isLead = isWebsiteLead(item);
          const isHighValue = isLead && isHighValueLead(item);
          const isDraftReady = draftReadyIds.includes(item.id);

          const appPackage = String(item.app_package || "").toLowerCase();
          const appName = String(item.app_name || "").toLowerCase();
          const category = String(item.category || "").toLowerCase();
          
          const isEmail =
            category === "email" ||
            appPackage.includes("gmail") ||
            appPackage.includes("outlook") ||
            appPackage.includes("mail") ||
            appName.includes("gmail") ||
            appName.includes("outlook") ||
            appName.includes("mail");
          
          const route =
            item.route_data?.route ||

            (isEmail ? "email_review" : "unknown");
            const routeColor =
              route === "website_lead_sms"
                ? "#ef4444"
                : route === "email_review"
                ? "#f59e0b"
                : route === "text_sms"
                ? "#22c55e"
                : "#22c55e";          
            const badgeLabel =
              route === "email_review"
                ? isLeadsMode
                  ? "NEEDS REVIEW"
                  : "UNREAD"
                : route === "text_sms"
                  ? "SEND SMS"
                  : isLeadsMode
                    ? "MANUAL ACTION"
                    : "NEW";
          return (
            <Swipeable
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.swipeDelete}
                  onPress={() => handleDeleteNotification(item)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash" size={22} color="#fff" />
                  <Text style={styles.swipeDeleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            >
              <TouchableOpacity
                style={[
                  styles.notificationItem,
                  { borderLeftColor: isLeadsMode ? color : "#1E293B",
                    borderLeftWidth: isLeadsMode ? 4 : 1, },
                  isLead && styles.leadItem,
                  isDraftReady && !settings.autoSend && styles.draftReadyItem,
                  item.id === newestId && styles.newCard,
                ]}
                onPress={() => {
                  if (route === "email_review") {
                    if (Platform.OS === "web") {
                      window.open("https://mail.google.com", "_blank");
                    } else {
                      Linking.openURL("googlegmail://").catch(() => {
                        Linking.openURL("https://mail.google.com");
                      });
                    }
                    return;
                  }
              
                  router.push(`/conversation/${item.id}` as any);
                }}
                activeOpacity={0.75}
              >
              
                  
                <View style={[styles.itemIcon, { backgroundColor: color + "20" }]}>
                  <Ionicons
                    name={getCategoryIcon(item) as any}
                    size={20}
                    color={color}
                  />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.titleRow}>
                     

                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title ||
                       item.sender ||
                       
                       "New Notification"}
                    </Text>
                    
                    <View
                      style={{
                        marginTop: 8,
                        alignSelf: "flex-start",
                        backgroundColor: `${routeColor}22`,
                        borderWidth: 1,
                        borderColor: routeColor,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          color: routeColor,
                          fontSize: 11,
                          fontWeight: "700",
                          letterSpacing: 0.5,
                        }}
                      >
                        {badgeLabel}
                      </Text>
                    </View>

                    {(item as any).extra_count > 1 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>
                          {(item as any).extra_count}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.itemMessage} numberOfLines={2}>
                    {(item.content || "")
                      .replace(/\n/g, " ")
                      .replace(/\s+/g, " ")
                      .trim()}
                  </Text>

                  

                  {(item as any).extra_count > 1 && (
                    <Text style={styles.threadCount}>
                      {(item as any).extra_count} message thread
                    </Text>
                  )}

                  <Text style={styles.itemDate}>
                    {formatDateTime(
                      item.created_at || item.timestamp || item.sent_at
                    )}
                  </Text>

                  <View style={styles.metaRow}>
                    {!isLead && (
                      <Text style={styles.itemApp}>
                      {formatAppName(item)}
                      </Text>
                    )}  

                    {isLead && <Text style={styles.leadBadge}>WEBSITE LEAD</Text>}
                    {isLeadsMode && isHighValue && (
                      <Text style={styles.highValueBadge}>
                        🔥 HIGH VALUE
                      </Text>
                    )}
                    {isDraftReady && !settings.autoSend && (
                      <Text style={styles.draftReadyBadge}>DRAFT READY</Text>
                    )}
                    {isLeadsMode &&
                      settings.autoSend &&
                      isLead && (
                        <Text style={styles.autoSendBadge}>
                        AUTO SEND ON
                        </Text>
                     )}
                    
                  </View>

                  {isLead && isDraftReady && !settings.autoSend &&  (
                    <TouchableOpacity
                      style={styles.openRepliesButton}
                      onPress={() => openRepliesTab()}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="open-outline" size={14} color="#C7D2FE" />
                      <Text style={styles.openRepliesText}>
                        {isLeadsMode ? "Open Replies" : "View Replies"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#475569"
                  style={styles.cardChevron}
                />
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.voiceCardButton}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      router.push({
                        pathname: "/voice",
                        params: {
                          notification_id: item.id,
                          sender: item.sender || item.title || item.app_name,
                          content: item.content,
                        },
                      } as any);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="mic-outline" size={16} color="#22C55E" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      handleDeleteNotification(item);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>

                  
                  <TouchableOpacity
                    style={styles.aiButton}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();

                      if (isWebsiteLead(item)) {
                       console.log("SPARKLE PRESSED:", item.id);
                       handleGenerateAIReply(item.id);
                      } else {
                        router.push({
                          pathname: "/conversation/[id]",
                          params: { id: item.id },
                        } as any);
                      }                   
                 }}
                    disabled={isGenerating}
                    activeOpacity={0.8}
                  >
                    <View style={styles.buttonInner}>
                      {sentIds.includes(item.id) ? (
                        <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                      ) : isGenerating ? (
                        <ActivityIndicator size="small" color="#10B981" />
                      ) : isWebsiteLead(item) ? (
                        <Ionicons name="sparkles" size={18} color="#10B981" />
                      ) : (
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#10B981" />
                      )}

                      <Text style={styles.aiText}>
                        {sentIds.includes(item.id)
                          ? "Sent"
                          : isGenerating
                          ? "..."
                          : isWebsiteLead(item)
                          ? settings.autoSend
                            ? "Send Now"
                            : "Reply"
                          : isLeadsMode
                            ? "Open"
                            : "View"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>



              </TouchableOpacity>
            </Swipeable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>
              {filter === "leads"
                ? settings.highPriorityOnly
                  ? "No high-value leads right now"
                  : "No website leads"
                : "No active conversations"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F14" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#94A3B8", marginTop: 12, fontSize: 14 },
  toast: {
      position: "absolute",
      top: 115,
      alignSelf: "center",
      backgroundColor: "#111827",
      borderColor: "#22C55E55",
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      zIndex: 999,
      elevation: 20,
      shadowColor: "#22C55E",
      shadowOpacity: 0.25,
      shadowRadius: 10,
    },

    toastText: {
      color: "#E5E7EB",
      fontSize: 13,
      fontWeight: "800",
    },
  reviewBadge: {
    backgroundColor: "#334155",
    color: "#CBD5E1",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  header: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F28",
    backgroundColor: "#0B0F14",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 24, color: "#fff", fontWeight: "900" },
  headerSub: { color: "#94A3B8", fontSize: 13, marginTop: 4 },

  voiceHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#13201B",
    borderWidth: 1,
    borderColor: "#22C55E55",
    alignItems: "center",
    justifyContent: "center",
  },
  clearButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#1F1F28",
    borderWidth: 1,
    borderColor: "#EF444440",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  topControls: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  filterRow: { flexDirection: "row", gap: 8 },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#1F1F28",
    borderWidth: 1,
    borderColor: "#2A2A36",
  },
  activeFilter: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  filterText: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },
  activeFilterText: { color: "#07130B" },

  autoSendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1F1F28",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2A2A36",
  },
  autoSendLabel: { color: "#fff", fontSize: 14, fontWeight: "800" },
  autoSendSub: { color: "#94A3B8", fontSize: 11, marginTop: 2 },

  settingsChips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  settingsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
  },
  settingsChipActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  settingsChipText: { color: "#CBD5E1", fontSize: 11, fontWeight: "800" },
  settingsChipTextActive: { color: "#07130B" },

  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  summaryHigh: { backgroundColor: "#3A1518", borderColor: "#7F1D1D" },
  summaryLead: { backgroundColor: "#13201B", borderColor: "#14532D" },
  summaryNumber: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  summaryLabel: { color: "#CFCFCF", fontSize: 12, fontWeight: "700" },

  undoBar: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#334155",
    zIndex: 999,
    elevation: 10,
  },
  undoText: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },
  undoButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  undoButtonText: { color: "#22C55E", fontSize: 12, fontWeight: "900" },

  listContent: { padding: 16, paddingBottom: 40 },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F1F28",
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 10,
    paddingRight: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2A2A36",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  leadItem: { backgroundColor: "#1A2A22" },
  highValueItem: {
    borderColor: "#EF4444",
    borderWidth: 1.5,
    shadowColor: "#EF4444",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  draftReadyItem: { borderColor: "#6366F1", borderWidth: 1.5 },
  sentFlashItem: {
    borderColor: "#22C55E",
    borderWidth: 2,
    backgroundColor: "#10281B",
    shadowColor: "#22C55E",
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },

  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  itemContent: { flex: 1, marginLeft: 12 },
  itemTitle: { color: "#fff", fontWeight: "800", fontSize: 15, flex: 1, marginLeft: -2 },
  itemMessage: {
    color: "#CBD5E1",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  itemDate: { fontSize: 12, color: "#94A3B8", marginTop: 5 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 7,
    flexWrap: "wrap",
  },
  itemApp: { color: "#64748B", fontSize: 11 },

  leadBadge: {
    backgroundColor: "#22C55E",
    color: "#07130B",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  highValueBadge: {
    backgroundColor: "#EF4444",
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  draftReadyBadge: {
    backgroundColor: "#6366F1",
    color: "#E0E7FF",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  autoSendBadge: {
    backgroundColor: "#F59E0B",
    color: "#111827",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },

  openRepliesButton: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  openRepliesText: { color: "#C7D2FE", fontSize: 12, fontWeight: "700" },

  actionButtons: { flexDirection: "row", gap: 6, marginLeft: 6 },
  voiceCardButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#13201B",
    borderWidth: 1,
    borderColor: "#22C55E55",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#2A1A1A",
    borderWidth: 1,
    borderColor: "#EF444440",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonInner: { alignItems: "center" },
  aiButton: {
    backgroundColor: "#10B98120",
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#10B98140",
  },
  aiText: {
    fontSize: 9,
    color: "#10B981",
    marginTop: 2,
    fontWeight: "800",
  },

  swipeDelete: {
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    width: 78,
    borderRadius: 16,
    marginBottom: 12,
  },
  swipeDeleteText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },

  emptyContainer: { alignItems: "center", marginTop: 80 },
  emptyText: {
    color: "#CBD5E1",
    fontSize: 18,
    marginTop: 12,
    fontWeight: "800",
  },
  emptySubtext: { color: "#64748B", fontSize: 14, marginTop: 4 },

  threadCount: { color: "#64748B", fontSize: 12, marginTop: 4, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: "auto",
  },
  reasonText: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  cardChevron: {
    marginLeft: 6,
    marginRight: 2,
  },
  countBadgeText: { color: "#CBD5E1", fontSize: 11, fontWeight: "900" },
  newCard: {
    backgroundColor: "#18242D",
    borderColor: "#22C55E33",
    borderWidth: 1,
    shadowColor: "#22C55E",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},

  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
},

  modePillLeads: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "#ef4444",
},

  modePillInbox: {
    backgroundColor: "rgba(34,197,94,0.14)",
    borderWidth: 1,
    borderColor: "#22c55e",
},

  modePillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
},
titleRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},

modePill: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
},

modePillLeads: {
  backgroundColor: "rgba(239,68,68,0.15)",
  borderWidth: 1,
  borderColor: "#ef4444",
},

modePillInbox: {
  backgroundColor: "rgba(34,197,94,0.15)",
  borderWidth: 1,
  borderColor: "#22c55e",
},

modePillText: {
  color: "#fff",
  fontSize: 10,
  fontWeight: "900",
  letterSpacing: 1,
},
});

