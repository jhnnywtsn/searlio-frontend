import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics"; // New import

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type NotificationItem = {
  id: string;
  title?: string;
  sender?: string;
  content?: string;
  message?: string;
  body?: string;
  app_name?: string;
  app_package?: string;
  category?: string;
  priority?: string;
  status?: string;
  source?: string;
  created_at?: string;
  contact_phone?: string;
  contact_whatsapp?: string;
  phone?: string;
  extra_data?: any;
};

export default function AgentScreen() {
  const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
  };
  const params = useLocalSearchParams();
  const demoMode = String(params.demo || "") === "true";

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [history, setHistory] = useState<number[]>([]);
  const current = items[index] || null;

  const customerName =
    current?.sender || current?.title || current?.app_name || "Customer";

  const messageText =
    current?.content ||
    current?.message ||
    current?.body ||
    current?.title ||
    "No message content.";

  const sourceName =
    current?.app_name || current?.app_package || current?.source || "Notification";

  const isHigh =
    current?.priority === "high" ||
    current?.source === "website" ||
    current?.app_package === "com.searlio.website.leads";

  const progressText = current ? `${items.length} left` : "All clear";

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    setDraft("");
  }, [current?.id]);

  useEffect(() => {
    if (!current || !sessionActive) return;

    const timer = setTimeout(() => {
      Speech.stop();
      Speech.speak(`${customerName}. ${messageText}`, {
        rate: 0.92,
        pitch: 1.0,
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [current?.id, sessionActive]);

  async function loadQueue() {
    try {
      setLoading(true);

      if (demoMode) {
        setItems([
          {
            id: "demo-1",
            app_name: "Website Lead",
            app_package: "com.searlio.website.leads",
            source: "website",
            priority: "high",
            sender: "Amanda Lee",
            title: "New website lead",
            content: "Hi, I need an estimate today. Can someone come by this afternoon?",
            contact_phone: "+18135551212",
            created_at: new Date().toISOString(),
          },
          {
            id: "demo-2",
            app_name: "Messages",
            app_package: "com.google.android.apps.messaging",
            priority: "normal",
            sender: "Mike Davis",
            title: "Mike Davis",
            content: "Can we reschedule for tomorrow morning?",
            contact_phone: "+18135551213",
            created_at: new Date().toISOString(),
          },
          {
            id: "demo-3",
            app_name: "Gmail",
            app_package: "com.google.android.gm",
            category: "email",
            sender: "customer@example.com",
            title: "Service question",
            content: "Do you offer weekly service plans?",
            created_at: new Date().toISOString(),
          },
        ]);
        setIndex(0);
        return;
      }

      if (!BACKEND_URL) return;

      const savedSettings = await AsyncStorage.getItem("searlio_settings");
      const settings = savedSettings ? JSON.parse(savedSettings) : {};

      const res = await fetch(`${BACKEND_URL}/api/notifications`);
      const data = await res.json();

      const pending = Array.isArray(data)
        ? data.filter((n) => {
            const status = String(n.status || "").toLowerCase();
            const app = `${n.app_package || ""} ${n.app_name || ""}`.toLowerCase();

            if (["delivered", "replied", "completed", "sent"].includes(status)) {
              return false;
            }

            if (settings.skipTelegram && app.includes("telegram")) return false;

            if (
              settings.skipSignal &&
              (app.includes("signal") || app.includes("thoughtcrime"))
            ) {
              return false;
            }
            if (settings.leadsOnly) {
              const text = `${n.title || ""} ${n.content || ""}`.toLowerCase();

              const isLead =
                n.source === "website" ||
                text.includes("quote") ||
                text.includes("estimate") ||
                text.includes("pricing") ||
                text.includes("available") ||
                text.includes("service");

              if (!isLead) return false;
            }
            const title = String(n.title || "").toLowerCase();
            const content = String(n.content || n.message || n.body || "").toLowerCase();
            
            const isJunkSummary =
              title.includes("new messages") ||
              content.includes("new messages") ||
              title.includes("syncing") ||
              content.includes("syncing new email") ||
              title.includes("new email") ||
              content.includes("new email") ||
              title.includes("checking for mail") ||
              content.includes("checking for mail");
            
            if (isJunkSummary) return false;
            const cleanContent = String(
              n.content ||
              n.message ||
              n.body ||
              ""
            ).trim();
            
            if (!cleanContent) return false;
            return true;
          })
        : [];

      const sorted = pending.sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      });

      setItems(sorted);
      setIndex(0);
    } catch (err) {
      console.log("Agent queue load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function removeCurrent() {
    if (!current?.id) return;
    const currentId = current.id;
    setItems((prev) => prev.filter((item) => item.id !== currentId));
    setIndex(0);
    setHistory([]);
    setDraft("");
  }

  function nextItem() {
    Speech.stop();
    setDraft("");

    if (index < items.length - 1) {
      setHistory((prev) => [...prev, index]);
      setIndex(index + 1);
    }
  }

  function previousItem() {
    Speech.stop();
    setDraft("");

    setHistory((prev) => {
      if (prev.length === 0) return prev;

      const lastIndex = prev[prev.length - 1];
      setIndex(lastIndex);

      return prev.slice(0, -1);
    });
  }

  async function skipItem() {
    nextItem();
  }

  async function readCurrent() {
    if (!current) return;

    Speech.stop();
    Speech.speak(`${isHigh ? "High priority. " : ""}${customerName}. ${messageText}`, {
      rate: 0.92,
      pitch: 1.0,
    });
  }

  async function generateReply() {
    if (!current?.id) return;

    if (demoMode) {
      const fakeReply =
        current.sender === "Amanda Lee"
          ? "Absolutely. We can come by this afternoon. What time works best for you?"
          : current.sender === "Mike Davis"
          ? "Tomorrow morning works. What time would you prefer?"
          : "Yes, we do offer recurring service plans.";

      setDraft(fakeReply);
      Speech.stop();
      Speech.speak(`Draft reply. ${fakeReply}`, { rate: 0.92, pitch: 1.0 });
      return;
    }

    if (!BACKEND_URL) return;

    try {
      setGenerating(true);
      const accountEmail =
        (await AsyncStorage.getItem("account_email")) || "";
      
      const subRes = await fetch(
        `${BACKEND_URL}/api/subscription/status?email=${encodeURIComponent(accountEmail)}`
      );
      
      const subData = await subRes.json();
      console.log("ACCOUNT EMAIL:", accountEmail);
      console.log("SUB STATUS:", subData);
      if (!subData?.allowed) {
        console.log("BLOCKING AI: subscription required");
      
        showAlert(
          "Searlio Pro required",
          "Start your 7-day free trial from Settings."
        );
      
        return;
      }
      const res = await fetch(`${BACKEND_URL}/api/llm/generate-reply/${current.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toneStyle: "casual",
          replyLength: "short",
          emojiUse: "minimal",
          voice_instruction: `Customer message: ${messageText}`,
        }),
      });

      const raw = await res.text();
      let data: any = {};

      try {
        data = JSON.parse(raw);
      } catch {
        console.log("Agent response was not JSON:", raw);
        return;
      }

      const text =
        data?.content || data?.reply || data?.reply_text || data?.message || "";

      if (text) {
        setDraft(text);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // Haptic feedback
        Alert.alert("Reply Ready", "AI drafted your response."); // Alert message
        setTimeout(() => {
          Speech.stop();
          Speech.speak(`Draft reply. ${text}`, { rate: 0.92, pitch: 1.0 });
        }, 250);
      }
    } catch (err) {
      console.log("Agent generate error:", err);
    } finally {
      setGenerating(false);
    }
  }

  function extractPhone(n: NotificationItem | null) {
    if (!n) return "";

    const raw =
      n.contact_phone ||
      n.contact_whatsapp ||
      n.phone ||
      n.extra_data?.phone ||
      n.extra_data?.contact_phone ||
      n.sender ||
      n.title ||
      "";

    const digits = String(raw).replace(/\D/g, "");

    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

    return "";
  }

  async function openOriginalApp() {
    if (demoMode) {
      Speech.speak("Demo mode. Original app opening is disabled.");
      return;
    }

    const app = `${current?.app_package || ""} ${current?.app_name || ""}`.toLowerCase();

    try {
      if (app.includes("whatsapp")) return Linking.openURL("whatsapp://");
      if (app.includes("telegram")) return Linking.openURL("tg://");
      if (app.includes("signal") || app.includes("thoughtcrime")) return Linking.openURL("sgnl://");
      if (app.includes("gmail") || app.includes("google.android.gm")) return Linking.openURL("googlegmail://");
      if (app.includes("messages") || app.includes("messaging") || app.includes("mms")) return Linking.openURL("sms:");
      if (app.includes("googlevoice")) return Linking.openURL("https://voice.google.com/");

      Speech.speak("Reply copied. Open the original app manually.");
    } catch (err) {
      console.log("Open app failed:", err);
      Speech.speak("Reply copied. Open the original app manually.");
    }
  }

  async function sendReply() {
    if (!draft.trim() || !current?.id) return;

    const currentId = current.id;
    const textToSend = draft.trim();
    const to = extractPhone(current);

    try {
      setSending(true);

      if (demoMode) {
        Speech.stop();
        Speech.speak("Demo send complete.", {
          onDone: removeCurrent,
        });
        return;
      }

      if (!to) {
        await Clipboard.setStringAsync(textToSend);
        await openOriginalApp();
        removeCurrent();
        return;
      }

      const res = await fetch(`${BACKEND_URL}/api/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          body: textToSend,
          app_package: current?.app_package || "",
          channel: "",
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        await Clipboard.setStringAsync(textToSend);
        await openOriginalApp();
        Speech.speak("Send failed. I copied the reply.");
        return;
      }

      await fetch(`${BACKEND_URL}/api/notifications/${currentId}/complete`, {
        method: "POST",
      }).catch(() => {});

      Speech.stop();
      Speech.speak("Sent.", {
        onDone: removeCurrent,
      });
    } catch (err) {
      console.log("Agent send error:", err);
      await Clipboard.setStringAsync(textToSend);
      await openOriginalApp();
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
        <Text style={styles.loadingText}>Loading Agent Mode...</Text>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={52} color="#22c55e" />
        <Text style={styles.emptyTitle}>All clear</Text>
        <Text style={styles.emptySub}>No pending items right now.</Text>

        <TouchableOpacity style={styles.secondaryButton} onPress={loadQueue}>
          <Text style={styles.secondaryButtonText}>Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View>
          <Text style={styles.headerTitle}>Searlio Agent</Text>
          <Text style={styles.headerSub}>{progressText}</Text>
        </View>

        <TouchableOpacity onPress={() => setSessionActive((v) => !v)}>
          <Ionicons
            name={sessionActive ? "pause-circle" : "play-circle"}
            size={28}
            color={sessionActive ? "#22C55E" : "#CBD5E1"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, isHigh && styles.highCard]}>
          <View style={styles.cardTop}>
            {isHigh && (
              <View style={styles.urgentBanner}>
                <Ionicons name="flash" size={14} color="#fff" />
                <Text style={styles.urgentBannerText}>URGENT LEAD</Text>
              </View>
            )}
            <View>
              <Text style={styles.source}>{sourceName}</Text>
              <Text style={styles.customer}>{customerName}</Text>
            </View>

            {isHigh && (
              <View style={styles.priorityPill}>
                <Text style={styles.priorityText}>HIGH</Text>
              </View>
            )}
          </View>

          <Text style={styles.message}>{messageText}</Text>
        </View>

        {draft ? (
          <View style={styles.replyCard}>
            <Text style={styles.replyLabel}>Draft Reply</Text>
            <Text style={styles.replyText}>{draft}</Text>
          </View>
        ) : (
          <View style={styles.replyEmpty}>
            <Text style={styles.replyEmptyText}>No draft yet.</Text>
          </View>
        )}

        <View style={styles.bigGrid}>
          <AgentButton icon="volume-high" label="Read" onPress={readCurrent} />

          <AgentButton
            icon="sparkles"
            label={generating ? <ActivityIndicator size="small" color="#10B981" /> : "Reply"}
            onPress={generateReply}
            disabled={generating}
          />

          <AgentButton
            icon="flash"
            label="Read + Reply"
            onPress={() => {
              readCurrent();
              setTimeout(generateReply, 1800);
            }}
          />

          <AgentButton
            icon="send"
            label={sending ? "Sending..." : "Send"}
            onPress={sendReply}
            disabled={sending || !draft.trim()}
            primary
          />

          <AgentButton icon="play-skip-forward" label="Next" onPress={nextItem} />
          <AgentButton icon="play-skip-back" label="Back" onPress={previousItem} />
          <AgentButton icon="time-outline" label="Later" onPress={skipItem} />
          <AgentButton
            icon="checkmark-circle"
            label="Complete"
            onPress={removeCurrent}
          />
        </View>

        {!demoMode && (
          <TouchableOpacity
            style={styles.openConversationButton}
            onPress={() =>
              router.push({
                pathname: "/conversation/[id]",
                params: { id: current.id },
              })
            }
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#CBD5E1" />
            <Text style={styles.openConversationText}>Open full conversation</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function AgentButton({
  icon,
  label,
  onPress,
  disabled,
  primary,
}: {
  icon: any;
  label: string | JSX.Element; // Allow for ActivityIndicator
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.agentButton,
        primary && styles.agentButtonPrimary,
        disabled && { opacity: 0.45 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={24} color={primary ? "#08111f" : "#E5E7EB"} />
      <Text style={[styles.agentButtonText, primary && styles.agentButtonPrimaryText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#020617" },
  center: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { color: "#94A3B8", marginTop: 12 },
  emptyTitle: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 12 },
  emptySub: { color: "#94A3B8", marginTop: 8, marginBottom: 22 },
  header: {
    paddingTop: Platform.OS === "ios" ? 58 : 36,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  headerSub: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  highCard: { borderColor: "#EF4444", backgroundColor: "#1B1015" },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  source: { color: "#94A3B8", fontSize: 13, marginBottom: 4 },
  customer: { color: "#F8FAFC", fontSize: 26, fontWeight: "900" },
  priorityPill: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  priorityText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  message: {
    color: "#F8FAFC",
    fontSize: 24,
    lineHeight: 34,
    fontWeight: "700",
  },
  replyCard: {
    marginTop: 16,
    backgroundColor: "#052E1A",
    borderColor: "#22C55E",
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  replyLabel: {
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  replyText: { color: "#F0FDF4", fontSize: 20, lineHeight: 29, fontWeight: "700" },
  replyEmpty: {
    marginTop: 16,
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  replyEmptyText: { color: "#64748B", fontSize: 16 },
  bigGrid: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  agentButton: {
    width: "48%",
    minHeight: 92,
    backgroundColor: "#111827",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  agentButtonPrimary: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  agentButtonText: { color: "#E5E7EB", fontSize: 16, fontWeight: "800" },
  agentButtonPrimaryText: { color: "#08111f" },
  openConversationButton: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  openConversationText: { color: "#CBD5E1", fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 10,
  },
  secondaryButtonText: { color: "#E5E7EB", fontWeight: "800" },
  urgentBanner: {
    backgroundColor: "#DC2626",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 14,
  },

  urgentBannerText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
