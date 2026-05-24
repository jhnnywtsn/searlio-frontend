import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await AsyncStorage.getItem("onboarding_complete");

      if (completed === "true") {
        router.replace("/pending");
      } else {
        router.replace("/onboarding");
      }
    };

    checkOnboarding();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#050816",
      }}
    >
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
}
