import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";

export default function OnboardingScreen() {
  const router = useRouter();

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem("onboarding_complete", "true");
      router.replace("/onboarding/permissions");
    } catch (err) {
      console.log("ONBOARDING ERROR:", err);
      router.push("/pending");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#050816" }}>
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingVertical: 40,
        }}
      >
        <StatusBar style="light" />

        <View style={{ marginTop: 60 }}>
          <Text
            style={{
              color: "white",
              fontSize: 42,
              fontWeight: "800",
              lineHeight: 48,
            }}
          >
            Only What Matters.
          </Text>

          <Text
            style={{
              color: "#9CA3AF",
              fontSize: 18,
              marginTop: 18,
              lineHeight: 28,
            }}
          >
            Searlio filters noise, highlights important notifications,
            and helps you respond instantly.
          </Text>

          <View style={{ marginTop: 50, gap: 16 }}>
            {[
              "Unified inbox",
              "AI reply suggestions",
              "Smart prioritization",
              "Texts, Gmail, Snapchat & more",
            ].map((item) => (
              <View
                key={item}
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: 18,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          <TouchableOpacity
            onPress={finishOnboarding}
            style={{
              backgroundColor: "#10B981",
              paddingVertical: 18,
              borderRadius: 20,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#04130C",
                fontSize: 18,
                fontWeight: "800",
              }}
            >
              Get Started
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color: "#6B7280",
              textAlign: "center",
              marginTop: 18,
              fontSize: 14,
            }}
          >
            Built for fast-moving conversations.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
