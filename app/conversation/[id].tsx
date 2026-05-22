// app/conversation/[id].tsx

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
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics"; // New import

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NotificationItem = {
  id: string;
  title?: string;
  sender?: string;
  content?: string;
  message?: string;
  app_name?: string;
  app_package?: string;
  category?: string;
  priority?: string;
  status?: string;
  source?: string;
  created_at?: string;
  contact_whatsapp?: string;
  contact_phone?: string;
  contact_id?: string;
  contact_display_name?: string;
};

type ReplyItem = {
  id: string;
  notification_id?: string;
  content?: string;
  reply_text?: string;
  message?: string;
  status?: string;
  created_at?: string;
};

export default function ConversationScreen() {

  const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };
  const { id } = useLocalSearchParams<{ id: string }>();

  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [voiceThinking, setVoiceThinking] = useState(false);
  const [threadMessages, setThreadMessages] = useState<NotificationItem[]>([]);
  const [routeData, setRouteData] = useState<any>(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const generatingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text || "");
  };

  
  const customerName =
      notification?.sender ||
      notification?.title ||
      notification?.app_name ||
      "Customer";
    
  const originalMessage =
      notification?.content ||
      notification?.message ||
      (notification as any)?.body ||
      "";
    
  const appKey = `${notification?.app_package || ""} ${notification?.app_name || ""} ${notification?.source || ""}`.toLowerCase();
   
   const isWebsiteLead =
     notification?.source === "website" ||
     notification?.source === "paid.searlio.com" ||
     notification?.source === "searlio.com" ||
     notification?.app_package === "com.searlio.website.leads" ||
     notification?.app_name === "Website Lead";
   
   const rawContact =
     notification?.contact_phone ||
     notification?.contact_whatsapp ||
     notification?.sender ||
     notification?.title ||
     "";
   
   
// (Stabilize cross-platform alerts and voice agent behavior)

  





  useEffect(() => {
    loadConversation();
  }, [id]);

  const routeBoxColor =
    routeData?.priority === "high"
      ? "#3b1117"
      : routeData?.priority === "medium"
      ? "#2f2411"
      : "#111827";

  const routeAccentColor =
    routeData?.priority === "high"
      ? "#f87171"
      : routeData?.priority === "medium"
      ? "#fbbf24"
      : "#93c5fd";

  async function loadConversation() {
    if (!BACKEND_URL || !id) return;

    try {
      setLoading(true);

      const nRes = await fetch(`${BACKEND_URL}/api/notifications/${id}`);
      const notificationData = await nRes.json();
      setNotification(notificationData);
      const allRes = await fetch(`${BACKEND_URL}/api/notifications`);
      const allNotifications = await allRes.json();

      const routeRes = await fetch(
        `${BACKEND_URL}/api/notifications/${id}/route`
      );

      const routeJson = await routeRes.json();

      setRouteData(routeJson);

      console.log("CADR ROUTE:", routeJson);

      const groupKey =
        notificationData.sender ||
        notificationData.title ||
        notificationData.app_package ||
        notificationData.app_name ||
        notificationData.id;

      const relatedMessages = Array.isArray(allNotifications)
        ? allNotifications
            .filter((n) => {
              const key =
                n.sender ||
                n.title ||
                n.app_package ||
                n.app_name ||
                n.id;

              return key === groupKey;
            })
            .sort(
              (a, b) =>
                new Date(a.created_at || 0).getTime() -
                new Date(b.created_at || 0).getTime()
            )
        : [notificationData];

      setThreadMessages(relatedMessages.length ? relatedMessages : [notificationData]);
      const rRes = await fetch(`${BACKEND_URL}/api/replies`);
      const allReplies = await rRes.json();

      const relatedReplies = Array.isArray(allReplies)
        ? allReplies.filter((r) => r.notification_id === id)
        : [];

      setReplies(relatedReplies);
    } catch (err) {
      console.log("Conversation load error:", err);
      console.log("Error", "Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }

  async function generateReply() {
    if (!BACKEND_URL || !id) return;

    if (generating || draft.trim().length > 0 || generatingRef.current) {
      console.log("Generate blocked");
      return;
    }

    generatingRef.current = true;

    try {
      setGenerating(true);

      const savedSettings = await AsyncStorage.getItem("searlio_settings");
      const toneSettings = savedSettings ? JSON.parse(savedSettings) : {};

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
      const res = await fetch(`${BACKEND_URL}/api/llm/generate-reply/${id}`, {
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
        scrollRef.current?.scrollToEnd({ animated: true });

        // Haptic feedback and alert
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Reply Ready", "AI drafted your response.");
      }
    } catch (err) {
      console.log("Generate reply error:", err);
      console.log("AI generate failed");
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  async function copyReply() {
    if (!replyToCopy) {
      console.log("No reply", "Generate or type a reply first.");
      return;
    }

    await Clipboard.setStringAsync(replyToCopy);
    console.log("Copied", "Reply copied.");
  }

  async function openOriginalApp() {
    const app = `${notification?.app_package || ""} ${notification?.app_name || ""}`.toLowerCase();

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

      console.log("Open Original App", "Open the original app manually and paste the copied reply.");
    } catch (err) {
      console.log("Could not open app", "Copy the reply, then open the original app manually.");
    }
  }
  const replyToCopy = draft.trim();
  const timelineItems = useMemo(() => {
    const incoming = threadMessages.map((msg) => ({
      id: `in-${msg.id}`,
      type: "incoming",
      text:
        msg.content ||
        msg.message ||
        (msg as any).body ||
        msg.title ||
        "No message content.",
      label: msg.sender || msg.title || customerName,
      created_at: msg.created_at,
    }));

    const sent = replies.map((reply) => ({
      id: `reply-${reply.id}`,
      type: reply.status === "delivered" ? "sent" : "ai",
      text: reply.content || reply.reply_text || reply.message || "",
      label: reply.status === "delivered" ? "Searlio Sent" : "Searlio AI",
      created_at: reply.created_at,
    }));

    const latestIncomingTime =
      incoming.length > 0
        ? incoming[incoming.length - 1].created_at
        : new Date().toISOString();
    
    const draftItem =
      draft.trim().length > 0
        ? [
            {
              id: "draft",
              type: "draft",
              text: draft.trim(),
              label: "Editable Draft",
              created_at: latestIncomingTime,
              sortOffset: 1,
            },
          ]
        : [];

    return [...incoming, ...sent, ...draftItem].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
    
      if (aTime !== bTime) return aTime - bTime;
    
      return ((a as any).sortOffset || 0) - ((b as any).sortOffset || 0);
    });
    }, [threadMessages, replies, draft, customerName]);
  
  async function copyAndOpenOriginalApp() {
    const textToCopy = replyToCopy;
  
    if (!textToCopy) {
      console.log("No reply to copy");
      return;
    }
  
    await Clipboard.setStringAsync(textToCopy);
  
    setReplies((prev) => [
      ...prev,
      {
        id: "local-" + Date.now(),
        content: textToCopy,
        status: "delivered",
        created_at:
          threadMessages[threadMessages.length - 1]?.created_at ||
          new Date().toISOString(),

        sortOffset: 2,
        },
      ]);
  
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDraft("");
  
    await openOriginalApp();
  }

  async function sendReply() {
    const textToSend = draft.trim();
  
    if (!textToSend || !notification?.id) {
      console.log("Missing reply text or notification ID.");
      return;
    }
  
    const possiblePhone =
      notification?.contact_phone ||
      notification?.contact_whatsapp ||
      (notification as any)?.phone ||
      (notification as any)?.extra_data?.phone ||
      notification?.sender ||
      notification?.title ||
      notification?.content ||
      "";

    const digits = possiblePhone.replace(/\D/g, "");

    const to =
      digits.length === 10
        ? `+1${digits}`
        : digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : "";

    if (!to) {
      await Clipboard.setStringAsync(textToSend);
      await openOriginalApp();
      return;
    }

    try {
      setSending(true);
      console.log("SEND DEBUG:", {
        possiblePhone,
        to,
        app_package: notification?.app_package,
        sender: notification?.sender,
        title: notification?.title,
        content: notification?.content,
        contact_phone: notification?.contact_phone,
        contact_whatsapp: notification?.contact_whatsapp,
        extra_data: (notification as any)?.extra_data,
      });

      const res = await fetch("https://searlio.com/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          body: textToSend,
          channel: "sms",
        }),
      });

      const data = await res.json();
      console.log("UNIVERSAL SEND RESULT:", JSON.stringify(data, null, 2));
      console.log("SEND TO:", to);

      if (!res.ok || data?.ok === false) {
        console.log("SEND FAILED / FALLBACK:", data);
        await Clipboard.setStringAsync(textToSend);
        await openOriginalApp();
        return;
      }

      setReplies((prev) => [
        ...prev,
        {
          id: "sent-" + Date.now(),
          content: textToSend,
          status: "delivered",
          created_at:
            threadMessages[threadMessages.length - 1]?.created_at ||
            new Date().toISOString(),
          sortOffset: 2,
        },
      ]);

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDraft("");

      // Success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Reply Sent", "Your message has been sent successfully.");
    } catch (err) {
      console.error("UNIVERSAL SEND ERROR:", err);
      await Clipboard.setStringAsync(textToSend);
      await openOriginalApp();
    } finally {
      setSending(false);
    }
  }

  const runVoiceAgent = async (transcript: string) => {
      if (!BACKEND_URL || !id) return;
    
      try {
        setVoiceThinking(true);
    
        const res = await fetch(`${BACKEND_URL}/api/llm/generate-reply/${id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toneStyle: "casual",
            replyLength: "short",
            emojiUse: "minimal",
            voice_instruction: transcript,
          }),
        });
    
        const data = await res.json();
    
        const text =
          data?.reply ||
          data?.reply_text ||
          data?.content ||
          data?.message ||
          "";
    
        if (text) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setDraft(text);
          scrollRef.current?.scrollToEnd({ animated: true });
        } else {
          console.log("Voice agent returned no reply:", data);
        }
      } catch (err) {
        console.log("Voice agent error:", err);
      } finally {
        setVoiceThinking(false);
      }
    };

  const startRecording = async () => {
    if (Platform.OS === "web") {
      showAlert(
        "Voice Agent",
        "Voice recording is available on the phone app. Use the AI Reply button on web."
      );
      return;
    }

   
     try {
       const permission = await Audio.requestPermissionsAsync();
   
       if (!permission.granted) {
         showAlert("Permission Required", "Microphone permission is required.");
         return;
       }
   
       await Audio.setAudioModeAsync({
         allowsRecordingIOS: true,
         playsInSilentModeIOS: true,
       });
   
       const result = await Audio.Recording.createAsync(
         Audio.RecordingOptionsPresets.HIGH_QUALITY
       );
   
       setRecording(result.recording);
       setRecordingActive(true);
     } catch (err) {
       console.log("Recording start error:", err);
     }
   };
   const stopRecording = async () => {
    if (Platform.OS === "web") {
      return;
    }

    try {
      if (!recording) return;

      setRecordingActive(false);
      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();
      console.log("VOICE RECORDING URI:", uri);

      setRecording(null);

      if (!uri) return;
      
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });
      
      const res = await fetch(`${BACKEND_URL}/api/voice/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_base64: base64Audio,
          audio_format: "m4a",
        }),
      });
      
      const data = await res.json();
      
      console.log("VOICE TRANSCRIBE:", data);
      
      const transcript =
        data?.text ||
        data?.transcript ||
        "";
      
      if (!transcript) {
        console.log("No transcript returned");
        return;

      }
      
      await runVoiceAgent(transcript);
    } catch (err) {
      console.log("Recording stop error:", err);
    }
  };

  const canDirectSend = !!(
    notification?.contact_phone ||
    notification?.contact_whatsapp
  );

  const appActionLabel = isWebsiteLead
    ? "Send Reply"
    : canDirectSend
    ? "Send SMS"
    : "Copy + Open";

  const appActionIcon = canDirectSend ? "send" : "copy-outline";

  const formatAppName = () => {
    const raw = (
      notification?.app_name ||
      notification?.app_package ||
      notification?.source ||
      ""
    ).toLowerCase();

    if (raw.includes("telegram")) return "Telegram";
    if (raw.includes("whatsapp")) return "WhatsApp";
    if (raw.includes("signal") || raw.includes("thoughtcrime")) {
      return "Signal";
    }
    if (raw.includes("gmail")) return "Gmail";
    if (raw.includes("outlook")) return "Outlook";
    if (raw.includes("textnow")) return "TextNow";
    if (raw.includes("messaging")) return "Messages";
    if (raw.includes("facebook") || raw.includes("orca")) return "Messenger";
    if (raw.includes("website")) return "Website Lead";

    return notification?.app_name || "Conversation";
  };

  const actionButtonColor =
    routeData?.route === "website_lead_sms"
      ? "#dc2626"
      : routeData?.route === "text_sms"
      ? "#22c55e"
      : routeData?.route === "email_review"
      ? "#2563eb"
      : "#4b5563";

  const handleRouteAction = async () => {
    const replyText = draft.trim();

    if (!replyText) {
      Alert.alert("No reply yet", "Generate or type a reply first.");
      return;
    }

    if (routeData?.route === "email_review") {
      await copyToClipboard(replyText);
      await Linking.openURL("mailto:");
      return;
    }

    if (routeData?.route === "text_sms" || routeData?.route === "website_lead_sms") {
      const phone =
        routeData?.phone ||
        notification?.contact_phone ||
        notification?.contact_whatsapp ||
        notification?.sender ||
        "";

      await copyToClipboard(replyText);

      if (phone) {
        await Linking.openURL(`sms:${phone}?body=${encodeURIComponent(replyText)}`);
        return;
      }

      await openOriginalApp();
      return;
    }

    await copyToClipboard(replyText);
    await openOriginalApp();
  }; 

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{customerName}</Text>
          <Text style={styles.headerSub}>
            {formatAppName()}
          </Text>
        </View>

        {notification?.priority === "high" && (
          <View style={styles.priorityPill}>
            <Text style={styles.priorityText}>HIGH VALUE</Text>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {timelineItems.map((item, index) => {
          const isIncoming = item.type === "incoming";
          const isDraft = item.type === "draft";
          const isSent = item.type === "sent";

          return (
            <View
              key={item.id}
              style={[
                isIncoming
                  ? styles.leftBubble
                  : isDraft
                  ? styles.draftBubble
                  : styles.rightBubble,
                isSent && styles.sentBubble,
              ]}
            >
              {index === 0 && isIncoming && (
                <Text style={styles.bubbleLabel}>{item.label}</Text>
              )}

              {!isIncoming && (
                <Text style={styles.bubbleLabelRight}>{item.label}</Text>
              )}

              <Text style={isIncoming ? styles.leftText : styles.rightText}>
                {item.text}
              </Text>

              <Text style={isIncoming ? styles.timeText : styles.timeTextRight}>
                {isDraft ? "Not sent yet" : formatDate(item.created_at)}
              </Text>
            </View>
          );
        })}

        {routeData && (
          <TouchableOpacity
            onPress={() => setShowRouteDetails(!showRouteDetails)}
            activeOpacity={0.9}
            style={{
              backgroundColor: routeBoxColor,
              borderLeftWidth: 4,
              borderLeftColor: routeAccentColor,
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {routeData.route.toUpperCase()} • {routeData.priority.toUpperCase()}
            </Text>

            {showRouteDetails && (
              <>
                <Text style={{ color: "#9ca3af", marginTop: 4 }}>
                  Route: {routeData.route}
                </Text>

                <Text style={{ color: "#9ca3af" }}>
                  Priority: {routeData.priority}
                </Text>

                <Text style={{ color: "#9ca3af" }}>
                  Can Send: {String(routeData.can_send)}
                </Text>

                <Text style={{ color: "#9ca3af" }}>
                  Reason: {routeData.reason}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {generating && (
          <View style={styles.aiTypingRow}>
            <Ionicons name="sparkles" size={12} color="#A5B4FC" />
            <Text style={styles.aiTypingText}>
              Searlio AI is drafting a reply...
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type or generate a reply..."
          placeholderTextColor="#64748b"
          multiline
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={generateReply}
            disabled={generating || draft.trim().length > 0}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#C7D2FE" />
                <Text style={styles.buttonText}>
                  {draft.trim().length > 0 ? "Reply Ready" : "Generate"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        
          <TouchableOpacity
            style={styles.aiButton}
            onPress={recordingActive ? stopRecording : startRecording}
            disabled={voiceThinking}
          >
            {voiceThinking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={recordingActive ? "stop-circle" : "mic-outline"}
                  size={18}
                  color="#C7D2FE"
                />
                <Text style={styles.buttonText}>
                  {recordingActive ? "Stop" : "Voice Agent"}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: actionButtonColor },
            ]}
            onPress={
              routeData?.route === "text_sms" || routeData?.route === "website_lead_sms"
                ? sendReply
                : handleRouteAction
            }
          >
            <Ionicons
              name={
                routeData?.route === "email_review"
                  ? "mail-outline"
                  : routeData?.route === "website_lead_sms"
                  ? "flash-outline"
                  : routeData?.route === "text_sms"
                  ? "send"
                  : "copy-outline"
              }
              size={18}
              color={canDirectSend ? "#08111f" : "#08111f"}
            />
            <Text style={styles.sendButtonText}>
              {routeData?.route === "email_review"
                ? "Review Email"
                : routeData?.route === "website_lead_sms"
                ? "Send Lead Reply"
                : routeData?.route === "text_sms"
                ? "Send SMS"
                : "Copy + Open"}
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.openAppButton} onPress={openOriginalApp}>
          <Ionicons name="open-outline" size={18} color="#CBD5E1" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatDate(value?: string) {
  if (!value) return "";

  try {
    const normalized = value.endsWith("Z") ? value : `${value}Z`;
    return new Date(normalized).toLocaleString();
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },
  center: {
    flex: 1,
    backgroundColor: "#0b0f14",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
  },
  header: {
    paddingTop: 46,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: "#10141c",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
  },
  headerSub: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 2,
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#3A1518",
    borderRadius: 999,
  },
  priorityHigh: {
    backgroundColor: "#7f1d1d",
  },
  priorityText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "800",
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    padding: 16,
    paddingBottom: 28,
  },
  metaCard: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  metaTitle: {
    color: "#fff",
    fontWeight: "800",
    marginBottom: 4,
  },
  metaText: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
  leftBubble: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    backgroundColor: "#17212B",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 14,
    marginBottom: 18,
  },
   rightBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: "#14532D",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 14,
    marginBottom: 18,
  },
  draftBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: "#17212B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#6366F1",
  },
  bubbleLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  bubbleLabelRight: {
    color: "#bbf7d0",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  leftText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 23,
  },
  rightText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 23,
  },
  timeText: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 8,
  },
  timeTextRight: {
    color: "#bbf7d0",
    fontSize: 11,
    marginTop: 8,
    opacity: 0.8,
  },
  composer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    backgroundColor: "#0F1720",
  },
  input: {
    minHeight: 52,
    maxHeight: 120,
    color: "#fff",
    backgroundColor: "#0b1120",
    borderWidth: 1,

    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  aiButton: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  sendButton: {
    flex: 1,
    backgroundColor: "#22c55e",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  copyButton: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#312e81",
  },
  openAppButton: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  buttonText: {
    color: "#C7D2FE",
    fontWeight: "800",
  },
  sendButtonText: {
    color: "#08111f",
    fontWeight: "900",
  },
  copyButtonText: {
    color: "#C7D2FE",
    fontWeight: "800",
  },
  openAppText: {
    color: "#CBD5E1",
    fontWeight: "800",
  },
  aiTypingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    opacity: 0.9,
  },

  aiTypingText: {
    color: "#A5B4FC",
    fontSize: 12,
  },
  replySectionLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 12,
    alignSelf: "center",
    letterSpacing: 0.2,
  },
  sentBubble: {
    opacity: 0.92,
    borderWidth: 1,
    borderColor: "#22C55E33",
  },
});
