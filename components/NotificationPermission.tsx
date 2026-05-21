// frontend/components/NotificationPermission.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SETTINGS_ACTION = "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS";

export default function NotificationPermission() {
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);

  const openNotificationSettings = async () => {
    if (Platform.OS !== "android") {
      Alert.alert(
        "Android Only",
        "Notification listening is only available on Android devices."
      );
      return;
    }

    try {
      setHasOpenedSettings(true);
      await Linking.sendIntent(SETTINGS_ACTION);
    } catch (err) {
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Ionicons name="compass-outline" size={34} color="#A5B4FC" />
      </View>

      <Text style={styles.eyebrow}>Searlio Setup</Text>

      <Text style={styles.title}>Enable Lead Capture</Text>

      <Text style={styles.description}>
        Allow Searlio to monitor notifications from apps like Gmail, Signal,
        WhatsApp, Facebook leads, and website forms so important messages can
        reach your dashboard.
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={openNotificationSettings}>
        <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Open Notification Access</Text>
      </TouchableOpacity>

      {hasOpenedSettings && (
        <View style={styles.returnBox}>
          <Ionicons name="information-circle-outline" size={18} color="#93C5FD" />
          <Text style={styles.returnText}>
            After enabling Searlio, return here and your notifications should begin flowing.
          </Text>
        </View>
      )}

      <View style={styles.stepsBox}>
        <Text style={styles.stepsTitle}>How to enable it</Text>

        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>Tap “Open Notification Access”</Text>
        </View>

        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>Find “Searlio” or “Notification Relay”</Text>
        </View>

        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>Toggle access ON</Text>
        </View>

        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>4</Text>
          <Text style={styles.stepText}>Confirm “Allow”</Text>
        </View>
      </View>

      <View style={styles.footerNote}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#34D399" />
        <Text style={styles.footerText}>
          Searlio only uses this access to detect important notifications and relay them to your workflow.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 22,
    margin: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(165,180,252,0.35)",
  },
  eyebrow: {
    color: "#A5B4FC",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
  },
  primaryButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  returnBox: {
    marginTop: 14,
    backgroundColor: "rgba(59,130,246,0.12)",
    borderColor: "rgba(147,197,253,0.25)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 8,
  },
  returnText: {
    color: "#DBEAFE",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  stepsBox: {
    marginTop: 22,
    backgroundColor: "#0B1120",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  stepsTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1F2937",
    color: "#A5B4FC",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "800",
  },
  stepText: {
    color: "#CBD5E1",
    fontSize: 14,
    flex: 1,
  },
  footerNote: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  footerText: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
});

