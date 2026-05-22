import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Notification {
  id: string;
  app_name: string;
  title: string;
  content: string;
  sender: string | null;
  category: string;
  created_at: string;
  status?: string;
    route_data?: {
    route?: string;
    priority?: string;
  };
}

interface Reply {
  id: string;
  content: string;
  delivered?: boolean;
  status?: string;
}

type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "ready_to_send";

export default function VoiceScreen() {
  const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
  };
  const router = useRouter();
  const params = useLocalSearchParams();
  const contentToRead = String(params.content || "");
  useEffect(() => {
    if (!contentToRead) return;
  
    const timer = setTimeout(() => {
      Speech.stop();
      Speech.speak(contentToRead);
    }, 350);
  
    return () => clearTimeout(timer);
  }, [contentToRead]);
  const startingNotificationId =
    typeof params.notification_id === "string"
      ? params.notification_id
      : undefined;

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentReply, setCurrentReply] = useState<Reply | null>(null);
  const [transcription, setTranscription] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  
  
  const paramNotification =
    startingNotificationId && contentToRead
      ? {
          id: startingNotificationId,
          app_name: String(params.sender || "Notification"),
          title: String(params.sender || "Notification"),
          content: contentToRead,
          sender: String(params.sender || ""),
          category: "text",
          created_at: new Date().toISOString(),
          status: "pending",
        }
      : null;
  
  const currentNotification = paramNotification || notifications[currentIndex];
  

  

  const [hasAutoRead, setHasAutoRead] = useState(false);
  
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setPermissionGranted(status === "granted");

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    setIsSpeaking(true);
    setVoiceState("speaking");

    Speech.speak(text, {
      language: "en-US",
      pitch: 1,
      rate: 0.9,
      onDone: () => {
        setIsSpeaking(false);
        setVoiceState("idle");
        onDone?.();
      },
      onError: () => {
        setIsSpeaking(false);
        setVoiceState("idle");
      },
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
    setVoiceState("idle");
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications`);

      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }

      const data = await response.json();
      
      
      
           
      
      const pending = data.filter(
        (item: Notification) =>
          item.status !== "delivered" &&
          item.status !== "replied" &&
          item.status !== "completed" &&
          item.status !== "sent"
      );

      setNotifications(pending);

      if (startingNotificationId) {
        const foundIndex = pending.findIndex(
          (item: Notification) => item.id === startingNotificationId
        );

        setCurrentIndex(foundIndex >= 0 ? foundIndex : 0);
      } else {
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      showAlert("Error", "Failed to load voice queue");
    }
  }, [startingNotificationId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const readNotification = useCallback(() => {
    if (!currentNotification) {
      speak("No pending notifications.");
      return;
    }

    const message = `${currentNotification.sender || currentNotification.app_name} says: ${currentNotification.content}`;
    speak(message);
  }, [currentNotification, speak]);

  const readReply = useCallback(() => {
    if (!currentReply) {
      speak("No reply generated yet.");
      return;
    }

    speak(`Reply: ${currentReply.content}. Say send to confirm, or cancel to discard.`);
    setVoiceState("ready_to_send");
  }, [currentReply, speak]);

  
    
  const startRecording = async () => {
    if (!permissionGranted) {
      showAlert("Permission Required", "Microphone permission is required.");
      return;
    }

    try {
      stopSpeaking();
      setTranscription("");

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setVoiceState("listening");
    } catch (err) {
      console.error("Failed to start recording:", err);
      showAlert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setVoiceState("processing");

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        setVoiceState("idle");
        return;
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await processVoiceInput(base64);
      };

      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setVoiceState("idle");
    }
  };

  const processVoiceInput = async (audioBase64: string) => {
    if (!currentNotification) {
      setVoiceState("idle");
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/voice/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: audioBase64,
          audio_format: "m4a",
          notification_id: currentNotification.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Voice processing failed");
      }

      const result = await response.json();

      const spokenCommand = result.transcription || "";
      
      const commandRes = await fetch(
        `${BACKEND_URL}/api/voice/cadr-command`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            command: spokenCommand,
          }),
        }
      );
      
      const commandData = await commandRes.json();
      
      console.log("VOICE COMMAND:", commandData);

      if (commandData.action === "clear_filter") {
        speak(commandData.spoken || "Showing all notifications.");
 
         router.push("/pending");

         return;
      }
      
      if (commandData.action === "filter_pending") {
        speak(commandData.spoken || "Opening filtered queue.");
      
        router.push({
          pathname: "/pending",
          params: {
            route: commandData.route || "",
            priority: commandData.priority || "",
          },
        });
      
        return;
      }
      
      if (commandData.action === "next") {
        goToNext();
        return;
      }
      
      if (commandData.action === "read_current") {
        readNotification();
        return;
      }

      if (commandData.action === "queue_summary") {
        speak(commandData.spoken || "Queue summary unavailable.");
        return;
      }
      
      if (commandData.action === "urgent_summary") {
        speak(commandData.spoken || "No urgent items.");
      
        router.push({
          pathname: "/pending",
          params: {
            priority: "high",
          },
        });
      
        return;
      }

      const voiceRoute =
        (currentNotification as any)?.route_data?.route || "manual_review";

      console.log("VOICE CADR ROUTE:", voiceRoute);

      if (voiceRoute === "email_review") {
        speak("This message requires review before sending.");
      }

      if (voiceRoute === "website_lead_sms") {
        speak("High priority lead detected.");
      }
      if (voiceRoute === "text_sms") {
        speak("Ready to send text reply.");
      }
      setTranscription(result.transcription || "");

      switch (result.action) {
        case "reply_created":
          setCurrentReply(result.reply);
          speak(`Reply created: ${result.reply.content}. Say send to confirm.`);
          setVoiceState("ready_to_send");
          break;

        case "sent":
          speak("Reply sent successfully.");
          setCurrentReply(null);
          removeCurrentAndGoNext();
          break;

        case "cancelled":
          speak("Cancelled.");
          setCurrentReply(null);
          setVoiceState("idle");
          break;

        case "skipped":
          goToNext();
          break;

        default:
          setVoiceState("idle");
      }
    } catch (err) {
      console.error("Voice processing error:", err);
      speak("Sorry, I could not process that. Please try again.");
      setVoiceState("idle");
    }
  };

  const generateAIReply = async () => {
    if (!currentNotification) return;

    setVoiceState("processing");
    console.log("VOICE currentNotification:", currentNotification);
    console.log("VOICE generate id:", currentNotification?.id);
    console.log("VOICE BACKEND_URL:", BACKEND_URL);
    try {
      const accountEmail =
        (await AsyncStorage.getItem("account_email")) || "";
      
      const subRes = await fetch(
        `${BACKEND_URL}/api/subscription/status?email=${encodeURIComponent(accountEmail)}`
      );
      
      const subData = await subRes.json();
      
      if (!subData?.allowed) {
        showAlert(
          "Searlio Pro required",
          "Start your 7-day free trial from Settings."
        );
        return;
      }
      const response = await fetch(
        `${BACKEND_URL}/api/llm/generate-reply/${currentNotification.id}`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to generate reply");
      }

      const reply = await response.json();

      setCurrentReply(reply);
      speak(
        `AI generated reply: ${reply.content}. Say send to confirm, or dictate a different reply.`
      );
      setVoiceState("ready_to_send");
    } catch (err: any) {
      console.log("VOICE GENERATE ERROR:", err?.message || err);
      showAlert(
        "Voice Generate Failed",
        String(err?.message || err)
      );
      speak("Error generating reply.");
      setVoiceState("idle");
    }
  };

  const sendReply = async () => {
    if (!currentReply) return;

    try {
      const approveRes = await fetch(
        `${BACKEND_URL}/api/replies/${currentReply.id}/approve`,
        { method: "PATCH" }
      );

      if (!approveRes.ok) {
        throw new Error("Approve failed");
      }

      const deliveredRes = await fetch(
        `${BACKEND_URL}/api/replies/${currentReply.id}/delivered`,
        { method: "PATCH" }
      );

      if (!deliveredRes.ok) {
        throw new Error("Send failed");
      }

      speak("Reply completed.");
      setCurrentReply(null);
      removeCurrentAndGoNext();
    } catch (err) {
      speak("Reply update failed.");
    }
  };

  const removeCurrentAndGoNext = () => {
    if (!currentNotification) return;

    const currentId = currentNotification.id;

    const nextList = notifications.filter((item) => item.id !== currentId);
    setNotifications(nextList);

    if (nextList.length === 0) {
      setCurrentIndex(0);
      setVoiceState("idle");
      speak("No more pending notifications.");
      return;
    }

    const nextIndex = Math.min(currentIndex, nextList.length - 1);
    setCurrentIndex(nextIndex);
    setVoiceState("idle");

    setTimeout(() => {
      const next = nextList[nextIndex];
      if (next) {
        speak(`Next message from ${next.sender || next.app_name}: ${next.content}`);
      }
    }, 500);
  };

  const goToNext = () => {
    setCurrentReply(null);

    if (currentIndex < notifications.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setVoiceState("idle");

      setTimeout(() => {
        const next = notifications[nextIndex];
        if (next) {
          speak(`Next message from ${next.sender || next.app_name}: ${next.content}`);
        }
      }, 500);
    } else {
      speak("No more pending notifications.");
      setVoiceState("idle");
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      text: "#10B981",
      talk: "#3B82F6",
      email: "#F59E0B",
      voice: "#06B6D4",
      other: "#8B5CF6",
    };

    return colors[category] || "#8B5CF6";
  };

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      text: "chatbubbles",
      talk: "call",
      email: "mail",
      voice: "mic",
      other: "apps",
    };

    return icons[category] || "apps";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Voice Assistant</Text>
          {startingNotificationId && (
            <Text style={styles.headerSub}>Card voice mode</Text>
          )}
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchNotifications}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              voiceState === "listening" && styles.statusListening,
              voiceState === "processing" && styles.statusProcessing,
              voiceState === "speaking" && styles.statusSpeaking,
              voiceState === "ready_to_send" && styles.statusReady,
            ]}
          />

          <Text style={styles.statusText}>
            {
              voiceState === "idle"
                ? "Ready"
                : voiceState === "listening"
                ? "Listening..."
                : voiceState === "processing"
                ? "Processing..."
                : voiceState === "speaking"
                ? "Speaking..."
                : voiceState === "ready_to_send"
                ? "Ready to send"
                : ""
            }
          </Text>
                    
        </View>

        <Text style={styles.counter}>
          {notifications.length > 0
            ? `${currentIndex + 1} of ${notifications.length} pending`
            : "No pending notifications"}
        </Text>

        {currentNotification ? (
          <View
            style={[
              styles.notificationCard,
              {
                borderLeftColor: getCategoryColor(
                  currentNotification.category || "other"
                ),
              },
            ]}
          >
            <View style={styles.notificationHeader}>
              <View
                style={[
                  styles.categoryIcon,
                  {
                    backgroundColor:
                      getCategoryColor(currentNotification.category || "other") + "20",
                  },
                ]}
              >
                <Ionicons
                  name={getCategoryIcon(currentNotification.category || "other")}
                  size={24}
                  color={getCategoryColor(currentNotification.category || "other")}
                />
              </View>

              <View style={styles.notificationMeta}>
                <Text style={styles.senderText}>
                  {currentNotification.sender || currentNotification.title}
                </Text>
                <Text style={styles.appText}>{currentNotification.app_name}</Text>
              </View>

              <TouchableOpacity onPress={readNotification} style={styles.speakButton}>
                <Ionicons name="volume-high" size={22} color="#6366F1" />
              </TouchableOpacity>
            </View>

            <Text style={styles.contentText}>{currentNotification.content}</Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={styles.emptyText}>All caught up!</Text>
          </View>
        )}

        {currentReply && (
          <View style={styles.replyCard}>
            <View style={styles.replyHeader}>
              <Ionicons name="chatbox-ellipses" size={20} color="#10B981" />
              <Text style={styles.replyLabel}>Generated Reply</Text>

              <TouchableOpacity onPress={readReply} style={styles.speakButton}>
                <Ionicons name="volume-high" size={20} color="#10B981" />
              </TouchableOpacity>
            </View>

            <Text style={styles.replyText}>{currentReply.content}</Text>
          </View>
        )}

        {transcription && (
          <View style={styles.transcriptionCard}>
            <Text style={styles.transcriptionLabel}>You said:</Text>
            <Text style={styles.transcriptionText}>"{transcription}"</Text>
          </View>
        )}

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.readButton]}
            onPress={readNotification}
            disabled={!currentNotification || isSpeaking}
          >
            <Ionicons name="volume-high" size={20} color="#fff" />
            <Text style={styles.actionText}>Read</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.aiButton]}
            onPress={generateAIReply}
            disabled={!currentNotification || voiceState === "processing"}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.actionText}>AI Reply</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={goToNext}
            disabled={notifications.length === 0}
          >
            <Ionicons name="play-skip-forward" size={20} color="#fff" />
            <Text style={styles.actionText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {currentReply && (
          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={[styles.confirmButton, styles.cancelButton]}
              onPress={() => {
                setCurrentReply(null);
                setVoiceState("idle");
              }}
            >
              <Ionicons name="close" size={22} color="#EF4444" />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, styles.sendButton]}
              onPress={sendReply}
            >
              <Ionicons name="send" size={22} color="#fff" />
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.pttContainer}>
        <Text style={styles.pttHint}>
          {voiceState === "listening"
            ? "Release to process"
            : 'Hold to speak: "generate reply", "send", or "skip"'}
        </Text>

        <TouchableOpacity
          style={[
            styles.pttButton,
            voiceState === "listening" && styles.pttActive,
            voiceState === "processing" && styles.pttProcessing,
          ]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={voiceState === "processing" || !permissionGranted}
        >
          {voiceState === "processing" ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Ionicons
              name={voiceState === "listening" ? "mic" : "mic-outline"}
              size={40}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        {!permissionGranted && (
          <Text style={styles.permissionWarning}>Microphone permission required</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F14",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F28",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  headerSub: {
    color: "#22C55E",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "800",
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 200,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#666",
  },
  statusListening: {
    backgroundColor: "#EF4444",
  },
  statusProcessing: {
    backgroundColor: "#F59E0B",
  },
  statusSpeaking: {
    backgroundColor: "#6366F1",
  },
  statusReady: {
    backgroundColor: "#10B981",
  },
  statusText: {
    color: "#888",
    fontSize: 14,
  },
  counter: {
    textAlign: "center",
    color: "#666",
    fontSize: 13,
    marginBottom: 16,
  },
  notificationCard: {
    backgroundColor: "#1F1F28",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationMeta: {
    flex: 1,
    marginLeft: 12,
  },
  senderText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  appText: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  speakButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366F120",
    justifyContent: "center",
    alignItems: "center",
  },
  contentText: {
    color: "#ccc",
    fontSize: 16,
    lineHeight: 24,
  },
  emptyCard: {
    backgroundColor: "#1F1F28",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    color: "#10B981",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },
  replyCard: {
    backgroundColor: "#10B98115",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#10B98130",
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  replyLabel: {
    flex: 1,
    color: "#10B981",
    fontSize: 13,
    fontWeight: "700",
  },
  replyText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 22,
  },
  transcriptionCard: {
    backgroundColor: "#6366F115",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  transcriptionLabel: {
    color: "#6366F1",
    fontSize: 12,
    marginBottom: 4,
  },
  transcriptionText: {
    color: "#ccc",
    fontSize: 14,
    fontStyle: "italic",
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  readButton: {
    backgroundColor: "#6366F1",
  },
  aiButton: {
    backgroundColor: "#F59E0B",
  },
  skipButton: {
    backgroundColor: "#666",
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#EF444420",
    borderWidth: 1,
    borderColor: "#EF444450",
  },
  cancelText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
  },
  sendButton: {
    backgroundColor: "#10B981",
  },
  sendText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  pttContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: "#0F0F14",
    borderTopWidth: 1,
    borderTopColor: "#1F1F28",
  },
  pttHint: {
    color: "#777",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  pttButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pttActive: {
    backgroundColor: "#EF4444",
    transform: [{ scale: 1.1 }],
  },
  pttProcessing: {
    backgroundColor: "#F59E0B",
  },
  permissionWarning: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 8,
  },
});
