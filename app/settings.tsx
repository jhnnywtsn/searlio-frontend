import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";



const STORAGE_KEY = "searlio_settings";
const TONE_STYLES = ["casual", "direct", "friendly", "professional"] as const;
const REPLY_LENGTHS = ["short", "medium"] as const;
const EMOJI_OPTIONS = ["none", "minimal", "natural"] as const;
const CHANNEL_OPTIONS = ["sms", "textnow", "whatsapp"] as const;

export default function SettingsScreen() {
const [accountEmail, setAccountEmail] = useState("");
  const [settings, setSettings] = useState({
    accountMode: "leads",
    autoSend: false,
    highPriorityOnly: true,
    skipSignal: false,
    skipTelegram: false,
    // 🔥 NEW — Tone Memory
    toneStyle: "casual",        // casual | professional | direct | friendly
    replyLength: "short",       // short | medium
    emojiUse: "minimal",        // none | minimal | natural
    personalSignature: "",

    preferredChannel: "sms",
    allowWebsiteLeads: true,
    allowTexts: true,
    allowEmail: true,
    allowCalls: true,
    allowOther: false,
  });
  
  const router = useRouter();
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  
  
  
  useEffect(() => {
    checkSubscription();
  }, []);

  // Load
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    })();
  }, []);

  useEffect(() => {
    loadAccountEmail();
  }, []);
  
  const loadAccountEmail = async () => {
    const saved = await AsyncStorage.getItem("account_email");
  
    if (saved) {
      setAccountEmail(saved);
    }
  };

  const saveAccountEmail = async () => {
    await AsyncStorage.setItem(
      "account_email",
      accountEmail
    );
  
    checkSubscription(accountEmail);
  };

  const checkSubscription = async (emailParam?: string) => {
    try {
      const emailToUse =
        emailParam || accountEmail;
  
      if (!emailToUse) return;
  
      const res = await fetch(
        `${BACKEND_URL}/api/subscription/status?email=${encodeURIComponent(emailToUse)}`
      );
  
      const data = await res.json();
  
      setSubscriptionStatus(data);
  
    } catch (err) {
      console.log("Subscription check failed", err);
    }
  };

  const startTrial = async () => {
    try {
      if (!accountEmail) {
        alert("Please enter and save your email first.");
        return;
      }
  
      const res = await fetch(
        `${BACKEND_URL}/api/subscription/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: accountEmail,
          }),
        }
      );
  
      const data = await res.json();
  
      if (data?.url) {
        Linking.openURL(data.url);
      } else {
        alert("Could not start checkout.");
      }
    } catch (err) {
      console.log("Start trial failed", err);
      alert("Start trial failed.");
    }
  };
  

  // Save
  const update = async (key: string, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push("/")}
      >
          <Ionicons
            name="home-outline"
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>
        {settings.accountMode === "leads"
          ? "Lead Command Center"
          : "Notification Inbox"}
      </Text>
      <Text style={styles.pageSub}>
        {settings.accountMode === "leads"
          ? "Prioritize, route, and respond to high-value leads."
          : "Focus on what matters and filter the noise."}
      </Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>How do you use Searlio?</Text>
      
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              settings.accountMode === "leads" && styles.modeButtonActive,
            ]}
            onPress={() => update("accountMode", "leads")}
          >
            <Ionicons name="flash" size={20} color="#22C55E" />
            <Text style={styles.modeTitle}>Leads</Text>
            <Text style={styles.modeSub}>Speed-to-lead and auto-replies</Text>
          </TouchableOpacity>
      
          <TouchableOpacity
            style={[
              styles.modeButton,
              settings.accountMode === "inbox" && styles.modeButtonActive,
            ]}
            onPress={() => update("accountMode", "inbox")}
          >
            <Ionicons name="notifications" size={20} color="#60A5FA" />
            <Text style={styles.modeTitle}>Inbox</Text>
            <Text style={styles.modeSub}>Unified notifications and replies</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* -------------------- */}
      {/* AUTO SEND */}
      {/* -------------------- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Automation</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Auto-send website leads</Text>
            <Text style={styles.sub}>
              Only applies to high-value website leads
            </Text>
          </View>

          <Switch
            value={settings.autoSend}
            onValueChange={(v) => update("autoSend", v)}
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>High priority only</Text>
            <Text style={styles.sub}>
              Filter to important leads/messages
            </Text>
          </View>

          <Switch
            value={settings.highPriorityOnly}
            onValueChange={(v) => update("highPriorityOnly", v)}
          />
        </View>
      </View>
    {settings.accountMode === "leads" && (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>What Gets Into Pending</Text>
        leadsOnly: false,
        <SettingToggle
          label="Agent Mode: Leads Only"
          value={settings.leadsOnly}
          onValueChange={(v) =>
            updateSetting("leadsOnly", v)
          }
        />
        <SettingToggle
          label="Skip Signal"
          sub="Hide Signal messages from Pending"
          value={settings.skipSignal}
          onValueChange={(v: boolean) => update("skipSignal", v)}
        />

        <SettingToggle
          label="Skip Telegram"
          sub="Hide Telegram messages from Pending"
          value={settings.skipTelegram}
          onValueChange={(v:boolean)=>update("skipTelegram",v)}
        />
      {settings.accountMode === "leads" && (
        <SettingToggle
          label="Website leads"
          sub="Always show business leads"
          value={settings.allowWebsiteLeads}
          onValueChange={(v: boolean) => update("allowWebsiteLeads", v)}
        />
      )}
      
        <SettingToggle
          label="Text messages"
          sub="SMS, WhatsApp, Signal, etc"
          value={settings.allowTexts}
          onValueChange={(v: boolean) => update("allowTexts", v)}
        />
      
        <SettingToggle
          label="Email"
          sub="Gmail, Outlook, etc"
          value={settings.allowEmail}
          onValueChange={(v: boolean) => update("allowEmail", v)}
        />
      
        <SettingToggle
          label="Calls / Voice"
          sub="Phone calls or voice apps"
          value={settings.allowCalls}
          onValueChange={(v: boolean) => update("allowCalls", v)}
        />
      
        <SettingToggle
          label="Other apps"
          sub="Everything else"
          value={settings.allowOther}
          onValueChange={(v: boolean) => update("allowOther", v)}
        />
      </View>
    )}

     <View style={styles.subscriptionHeader}>
       <Ionicons
         name={
           subscriptionStatus?.allowed
             ? "checkmark-circle"
             : "lock-closed"
         }
         size={22}
         color={
           subscriptionStatus?.allowed
             ? "#22C55E"
             : "#EF4444"
         }
       />
     
       <Text style={styles.subscriptionTitle}>
         {subscriptionStatus?.allowed
           ? "Searlio Pro Active"
           : "Free Plan"}
       </Text>
     </View>
     
     <Text style={styles.subscriptionSub}>
       {subscriptionStatus?.allowed
         ? "AI replies and automation unlocked"
         : "Upgrade to unlock advanced automation"}
     </Text>
     
     <View style={styles.subscriptionBadge}>
       <Text style={styles.subscriptionBadgeText}>
         {subscriptionStatus?.plan || "Free"}
       </Text>
     </View>

      <Text style={styles.cardTitle}>
        Account Email
      </Text>
      
      <TextInput
        value={accountEmail}
        onChangeText={setAccountEmail}
        placeholder="you@example.com"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />
      
      <TouchableOpacity
        style={styles.saveButton}
        onPress={saveAccountEmail}
      >
        <Text style={styles.saveButtonText}>
          Save Email
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (subscriptionStatus?.allowed) {
            Linking.openURL(
              `${BACKEND_URL}/api/subscription/customer-portal?email=${encodeURIComponent(accountEmail)}`
            );
          } else {
            startTrial();
          }
        }}
      >
        <Text style={styles.primaryButtonText}>
          {subscriptionStatus?.allowed
            ? "Manage Subscription"
            : "Start 7-Day Free Trial"}
        </Text>
      </TouchableOpacity>
      <View style={styles.proFeatures}>
        <View style={styles.featureRow}>
          <Ionicons name="sparkles" size={16} color="#22C55E" />
          <Text style={styles.featureText}>
            AI-generated replies
          </Text>
        </View>
      
        <View style={styles.featureRow}>
          <Ionicons name="flash" size={16} color="#22C55E" />
          <Text style={styles.featureText}>
            Auto-send high-value leads
          </Text>
        </View>
      
        <View style={styles.featureRow}>
          <Ionicons name="mic" size={16} color="#22C55E" />
          <Text style={styles.featureText}>
            Voice reply assistant
          </Text>
        </View>
      
        <View style={styles.featureRow}>
          <Ionicons name="filter" size={16} color="#22C55E" />
          <Text style={styles.featureText}>
            Advanced notification filtering
          </Text>
        </View>
      </View>
      {/* -------------------- */}
      {/* TONE MEMORY */}
      {/* -------------------- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reply Style</Text>

        {/* Tone Style */}
        <Text style={styles.label}>Tone</Text>
        <View style={styles.optionRow}>
          {TONE_STYLES.map((t) => (
            <Option
              key={t}
              label={t}
              active={settings.toneStyle === t}
              onPress={() => update("toneStyle", t)}
            />
          ))}
        </View>

        {/* Length */}
        <Text style={styles.label}>Reply Length</Text>
        <View style={styles.optionRow}>
          {REPLY_LENGTHS.map((l) => (
            <Option
              key={l}
              label={l}
              active={settings.replyLength === l}
              onPress={() => update("replyLength", l)}
            />
          ))}
        </View>

        {/* Emoji */}
        <Text style={styles.label}>Emoji Use</Text>
        <View style={styles.optionRow}>
          {EMOJI_OPTIONS.map((e) => (
            <Option
              key={e}
              label={e}
              active={settings.emojiUse === e}
              onPress={() => update("emojiUse", e)}
            />
          ))}
        </View>
        <Text style={styles.label}>Preferred Channel</Text>

        <View style={styles.optionRow}>
          {CHANNEL_OPTIONS.map((channel) => (
            <Option
              key={channel}
              label={channel}
              active={settings.preferredChannel === channel}
              onPress={() => update("preferredChannel", channel)}
            />
          ))}
        </View>
        {/* Signature */}
        <Text style={styles.label}>Personal Style Notes</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Keep it short, no fluff, sounds like me"
          placeholderTextColor="#64748B"
          value={settings.personalSignature}
          onChangeText={(t) => update("personalSignature", t)}
          multiline
        />
      </View>
    </ScrollView>
  );
}

function SettingToggle({ label, sub, value, onValueChange }: any) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>

      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

/* -------------------------------- */
/* OPTION COMPONENT */
/* -------------------------------- */

function Option({ label, active, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.option, active && styles.optionActive]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* -------------------------------- */
/* STYLES */
/* -------------------------------- */

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0B0F14",
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#0F1720",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontWeight: "900",
    marginBottom: 14,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  label: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 13,
  },
  sub: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 10,
    flexWrap: "wrap",
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#1F2937",
  },
  optionActive: {
     backgroundColor: "#1D4ED8",
  },
  optionText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "700",
  },
  optionTextActive: {
    color: "#fff",
  },
  input: {
    backgroundColor: "#0B1120",
    borderRadius: 12,
    padding: 10,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#263244",
    marginTop: 6,
    minHeight: 50,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  
  cardText: {
    color: "#D1D5DB",
    fontSize: 15,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#1F2937",
    color: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    marginBottom: 12,
  },
  
  saveButton: {
    backgroundColor: "#22C55E",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  subscriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  
  subscriptionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  
  subscriptionSub: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 14,
  },
  
  subscriptionBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  
  subscriptionBadgeText: {
    color: "#CBD5E1",
    fontWeight: "700",
    fontSize: 12,
  },
  proFeatures: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  
  featureText: {
    color: "#CBD5E1",
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
  },
  
  modeButton: {
    flex: 1,
    backgroundColor: "#0B1120",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  
  modeButtonActive: {
    borderColor: "#22C55E",
    backgroundColor: "#102018",
  },
  
  modeTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    marginTop: 8,
  },
  
  modeSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  pageSub: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 18,
    marginTop: -8,
  },
});
