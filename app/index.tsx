import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Index() {
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

      <TouchableOpacity style={styles.button} onPress={() => router.push("/agent")}>
        <Text style={styles.buttonText}>AI Assistant</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/pending")}
      >
        <Text style={styles.buttonText}>
          Open Inbox
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/settings")}
      >
        <Text style={styles.buttonText}>
          Choose Leads or Inbox Mode
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => router.push("/voice")}>
        <Text style={styles.buttonText}>Voice Assistant</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => router.push("/replies")}>
        <Text style={styles.buttonText}> Sent Replies</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => router.push("/settings")}>
        <Text style={styles.buttonText}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "900",
    marginBottom: 6,
  },
  sub: {
    color: "#94A3B8",
    fontSize: 16,
    marginBottom: 28,
  },
  primary: {
    backgroundColor: "#22C55E",
    paddingVertical: 17,
    borderRadius: 18,
    width: "100%",
    alignItems: "center",
    marginBottom: 14,
  },
  primaryText: {
    color: "#08111f",
    fontSize: 18,
    fontWeight: "900",
  },
  button: {
    backgroundColor: "#111827",
    paddingVertical: 15,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  buttonText: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "800",
  },
});
