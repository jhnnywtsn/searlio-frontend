// app/conversation/thread.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { demo } = useLocalSearchParams<{ demo?: string }>();
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ThreadScreen() {
  const { sender } = useLocalSearchParams<{ sender: string }>();
  const scrollRef = useRef<ScrollView | null>(null);
  const generatingRef = useRef(false);

  const [timeline, setTimeline] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [autoReadDone, setAutoReadDone] = useState(false);
  const canDirectSend =
    messages?.some((m: any) => {
      const raw =
        m.contact_whatsapp ||
        m.contact_phone ||
        m.sender ||
        m.title ||
        "";

        return raw.replace(/\D/g, "").length >= 10;
      }) || false;
  const displayName = useMemo(() => {
    return decodeURIComponent(String(sender || "Conversation"));
  }, [sender]);

  useEffect(() => {
    loadThread();
  }, [sender]);

  async function loadThread() {
    if (!BACKEND_URL || !sender) return;

    try {
      setLoading(true);

      const nRes = await fetch(`${BACKEND_URL}/api/notifications?limit=200`);
      const allNotifications = await nRes.json();

      const rRes = await fetch(`${BACKEND_URL}/api/replies?limit=200`);
      const allReplies = await rRes.json();

      const filteredMessages = Array.isArray(allNotifications)
        ? allNotifications.filter((n: any) => {
            const key = n.sender || n.title || n.app_package || n.app_name;
            return key === sender;
          })
        : [];

      setMessages(filteredMessages);

      const threadItems: any[] = [];

      filteredMessages.forEach((msg: any) => {
        threadItems.push({
          ...msg,
          type: "incoming",
          timeline_time: msg.created_at,
        });

        const relatedReplies = Array.isArray(allReplies)
          ? allReplies.filter((r: any) => r.notification_id === msg.id)
          : [];

        relatedReplies.forEach((reply: any) => {
          threadItems.push({
            ...reply,
            type: "reply",
            timeline_time: reply.created_at,
          });
        });
      });

      threadItems.sort(
        (a: any, b: any) =>
          new Date(`${a.timeline_time || ""}Z`).getTime() -
          new Date(`${b.timeline_time || ""}Z`).getTime()
      );

      setTimeline(threadItems);
    } catch (err) {
      console.log("Thread load error:", err);
      console.log("Error", "Could not load this thread.");
    } finally {
      setLoading(false);
    }
  }

  async function generateReply() {
    if (!BACKEND_URL || messages.length === 0) return;

    const latest = [...messages].sort((a, b) => {
      const aTime = new Date(`${a.created_at || ""}Z`).getTime();
      const bTime = new Date(`${b.created_at || ""}Z`).getTime();
      return bTime - aTime;
  })[0];

    if (generating || draft.trim().length > 0 || generatingRef.current) {
      console.log("Thread generate blocked");
      return;
    }

    generatingRef.current = true;

    try {
      setGenerating(true);

      const savedSettings = await AsyncStorage.getItem("searlio_settings");
      const toneSettings = savedSettings ? JSON.parse(savedSettings) : {};

      const res = await fetch(`${BACKEND_URL}/api/llm/generate-reply/${latest.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toneStyle: toneSettings.toneStyle || "casual",
          replyLength: toneSettings.replyLength || "short",
          emojiUse: toneSettings.emojiUse || "minimal",
          personalSignature: toneSettings.personalSignature || "",
        }),
      });
      
      const data = await res.json();

      

      const text =
        data?.content ||
        data?.reply?.content ||
        data?.reply_text ||
        data?.message ||
        "";

      if (text) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDraft(text);
      }
    } catch (err) {
      console.log("Thread generate error:", err);
      console.log("Error", "Could not generate AI reply.");
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  async function sendReply() {
    const textToSend = draft.trim();
    if (!canDirectSend) {
      if (!textToSend) return;

      await Clipboard.setStringAsync(textToSend);
      await openOriginalApp();

      return;
  }
    if (!textToSend) {
      console.log("No reply text");
      return;
    }
  
    try {
      setSending(true);
  
      const savedSettings = await AsyncStorage.getItem("searlio_settings");
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      const preferredChannel = settings.preferredChannel || "sms";
  
      // 👇 get latest message in thread
      const latest = messages?.[0];
  
      const rawTo =
        latest?.contact_whatsapp ||
        latest?.contact_phone ||
        latest?.sender ||
        latest?.title ||
        "";

      const canDirectSend =
        messages.some((m: any) => {
          const raw =
            m.contact_whatsapp ||
            m.contact_phone ||
            m.sender ||
            m.title ||
            "";

         return raw.replace(/\D/g, "").length >= 10;
        });
  
      const to =
        rawTo && rawTo.replace(/\D/g, "") !== ""
          ? rawTo.replace(/\D/g, "")
          : "18503002751";
  
      // 🚨 fallback for SMS/TextNow
      if (preferredChannel === "sms" || preferredChannel === "textnow") {
        console.log("Thread → non-whatsapp fallback");
  
        await Clipboard.setStringAsync(textToSend);
        await openOriginalApp();
  
        return;
      }
  
      // ✅ WhatsApp send
      const sendRes = await fetch(`${BACKEND_URL}/api/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          body: textToSend,
        }),
      });
  
      const sendData = await sendRes.json();
      console.log("THREAD SEND RESULT:", sendData);
  
      // ✅ UI feedback
      setReplies((prev) => [
        {
          id: "temp-" + Date.now(),
          content: textToSend,
          status: "delivered",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
  
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDraft("");
  
    } catch (err) {
      console.error("THREAD SEND ERROR:", err);
    } finally {
      setSending(false);
    }
  }
  /////////////////////////////////////////////////////////////////////
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  
  useEffect(() => {
    console.log("THREAD AUTO READ CHECK:", {
      demo,
      demoString: String(demo),
      autoReadDone,
      messageCount: messages.length,
      firstMessage: messages[0],
  });
    const isDemo = demo === "true" || demo === true || String(demo).includes("true");
    const demoFlag =
      demo === "true" ||
      (typeof window !== "undefined" &&
        window.sessionStorage.getItem("searlio_demo_autoread") === "true");

    if (!demoFlag) return;
  
    if (autoReadDone || messages.length === 0) return;
  
    const latest = [...messages].sort(
      (a, b) =>
        new Date(`${b.created_at || ""}Z`).getTime() -
        new Date(`${a.created_at || ""}Z`).getTime()
    )[0];
  
    const text =
      latest?.content ||
      latest?.message ||
      latest?.text ||
      latest?.title ||
      "";
    
    console.log("THREAD AUTO READ TEXT:", text);
    
    if (!text) return;
    
    setTimeout(() => {
      console.log("THREAD SPEAKING NOW:", text);
    
      setAutoReadDone(true);
    
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("searlio_demo_autoread");
      }
    
      Speech.stop();
      Speech.speak(text, {
        rate: 0.92,
        pitch: 1.0,
      });
    }, 700);
  },  [messages.length, autoReadDone, demo]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
  async function openOriginalApp() {
    const first = messages[0];
    const app = `${first?.app_package || ""} ${first?.app_name || ""}`.toLowerCase();

    try {
      if (app.includes("signal") || app.includes("thoughtcrime")) {
        await Linking.openURL("sgnl://");
        return;
      }

      if (app.includes("whatsapp")) {
        await Linking.openURL("whatsapp://");
        return;
      }

      if (app.includes("gmail") || app.includes("google.android.gm")) {
        await Linking.openURL("googlegmail://");
        return;
      }

      if (app.includes("telegram")) {
        await Linking.openURL("tg://");
        return;
      }

      control.log("Open App", "Open the original app manually.");
    } catch {
      control.log("Could not open app", "Open the original app manually.");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22C55E" size="large" />
        <Text style={styles.loadingText}>Loading thread...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.headerSub}>
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.openButton}
            onPress={() =>
            router.push({
            pathname: "/voice",
            params: {
            sender: String(sender || ""),
         },
       } as any)
     }
   >
  <Ionicons name="mic-outline" size={18} color="#22C55E" />
</TouchableOpacity>
        <TouchableOpacity style={styles.openButton} onPress={openOriginalApp}>
          <Ionicons name="open-outline" size={18} color="#CBD5E1" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={styles.dayDivider}>
          <Text style={styles.dayDividerText}>
            {timeline[0]?.timeline_time ? formatDayLabel(timeline[0].timeline_time) : "Thread"}
          </Text>
        </View>

        {timeline.map((item, index) => {
          const isReply = item.type === "reply";
          const text =
            item.content ||
            item.reply_text ||
            item.message ||
            "No message content.";

          return (
            <View
              key={`${item.type}-${item.id}-${index}`}
              style={isReply ? styles.rightBubble : styles.leftBubble}
            >
              {!isReply && index === 0 && (
                <Text style={styles.bubbleName}>
                  {item.sender || item.title || displayName}
                </Text>
              )}

              {isReply && (
                <Text style={styles.replyName}>
                  {item.status === "delivered" ? "Searlio Sent" : "Searlio AI"}
                </Text>
              )}

              <Text style={styles.messageText}>{text}</Text>

              <Text style={isReply ? styles.timeTextRight : styles.timeText}>
                {isReply && item.status === "delivered" ? "Delivered • " : ""}
                {formatTime(item.timeline_time)}
              </Text>
            </View>
          );
        })}

        {draft.trim().length > 0 && (
          <View style={styles.draftBubble}>
            <Text style={styles.replyName}>Draft Reply</Text>
            <Text style={styles.messageText}>{draft}</Text>
            <Text style={styles.timeTextRight}>Not sent yet</Text>
          </View>
        )}
        {generating && (
          <Text style={{ color: "#6366f1", marginTop: 6, fontSize: 12 }}>
            AI is typing...
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type or generate a reply..."
          placeholderTextColor="#64748B"
          multiline
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={generateReply}
            disabled={generating || draft.trim().length > 0}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.generateButtonText}>
                  {draft.trim().length > 0 ? "Reply Ready" : "Generate"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerButton}
            onPress={sendReply}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#0B0F14" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#0B0F14" />
                <Text style={styles.sendButtonText}>
                  {canDirectSend ? "Send Reply" : "Copy Reply"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.openFullButton}
          onPress={openOriginalApp}
        >
          <Ionicons name="open-outline" size={18} color="#CBD5E1" />
          <Text style={styles.openFullButtonText}>
            Open Original App
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function asDate(value?: string) {
  if (!value) return null;

  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value?: string) {
  const date = asDate(value);
  if (!date) return "";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayLabel(value?: string) {
  const date = asDate(value);
  if (!date) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0B0F14",
  },
  center: {
    flex: 1,
    backgroundColor: "#0B0F14",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#94A3B8",
    marginTop: 10,
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#0F172A",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#171B26",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "900",
  },
  headerSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  openButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
  },
  dayDivider: {
    alignSelf: "center",
    backgroundColor: "#1F2937",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  dayDividerText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "800",
  },
  leftBubble: {
    alignSelf: "flex-start",
    maxWidth: "78%",
    backgroundColor: "#1E293B",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rightBubble: {
    alignSelf: "flex-end",
    maxWidth: "78%",
    backgroundColor: "#064E3B",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  draftBubble: {
    alignSelf: "flex-end",
    maxWidth: "78%",
    backgroundColor: "#1E293B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4F46E5",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  bubbleName: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  replyName: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  messageText: {
    color: "#E5E7EB",
    fontSize: 15,
    lineHeight: 20,
  },
  timeText: {
    color: "#6B7280",
    fontSize: 10,
    marginTop: 6,
    alignSelf: "flex-end",
  },
  timeTextRight: {
    color: "#BBF7D0",
    fontSize: 10,
    marginTop: 6,
    alignSelf: "flex-end",
    opacity: 0.75,
  },
  footer: {
    backgroundColor: "#10141C",
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
    padding: 14,
  },
  input: {
    minHeight: 52,
    maxHeight: 120,
    color: "#fff",
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#263244",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  generateButton: {
    flex: 1,
    backgroundColor: "#4F46E5",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  generateButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  footerButton: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  footerButtonText: {
    color: "#0B0F14",
    fontWeight: "900",
  },
  openFullButton: {
    backgroundColor: "#1F2937",
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  openFullButtonText: {
    color: "#CBD5E1",
    fontWeight: "900",
  },
});

