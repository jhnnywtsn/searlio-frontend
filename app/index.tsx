import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await AsyncStorage.getItem("onboarding_complete");

      if (!completed) {
        router.replace("/onboarding");
      }
    };

    checkOnboarding();
  }, []);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Searlio</Text>
      <Text style={styles.sub}>Choose a mode</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/agent?demo=true")}
      >
        <Text style={styles.buttonText}>Try Live Demo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/agent")}
      >
        <Text style={styles.buttonText}>AI Assistant</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/pending")}
      >
        <Text style={styles.buttonText}>Open Inbox</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/settings")}
      >
        <Text style={styles.buttonText}>
          Choose Leads or Inbox Mode
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/voice")}
      >
        <Text style={styles.buttonText}>Voice Assistant</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/replies")}
      >
        <Text style={styles.buttonText}>Sent Replies</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/settings")}
      >
        <Text style={styles.buttonText}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#050816",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  title: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 10,
  },

  sub: {
    color: "#94A3B8",
    fontSize: 16,
    marginBottom: 30,
  },

  button: {
    width: "100%",
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 14,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
