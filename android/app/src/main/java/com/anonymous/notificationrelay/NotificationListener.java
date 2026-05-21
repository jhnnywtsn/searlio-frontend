package com.anonymous.notificationrelay;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class NotificationListener extends NotificationListenerService {
    private static final String TAG = "SearlioListener";

    // Use the backend that is currently receiving leads successfully
    private static final String BACKEND_URL = "https://searlio-py.onrender.com/api/notifications";
    // Alternative if confirmed working:
    // private static final String BACKEND_URL = "https://api.searlio.com/api/notifications";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String packageName = sbn.getPackageName();

            if (shouldSkipPackage(packageName)) {
                return;
            }

            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;

            String title = "";
            String content = "";
            String appName = packageName;

            if (extras != null) {
                CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
                CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
                CharSequence subTextCs = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);

                if (titleCs != null) title = titleCs.toString();
                if (textCs != null) content = textCs.toString();
                if (subTextCs != null) appName = subTextCs.toString();
            }

            if (title.trim().isEmpty() && content.trim().isEmpty()) {
                return;
            }

            String category = getCategory(packageName);
            String priority = getPriority(packageName, title, content);

            Log.d(TAG, "Captured notification");
            Log.d(TAG, "Package: " + packageName);
            Log.d(TAG, "Title: " + title);
            Log.d(TAG, "Content: " + content);
            Log.d(TAG, "Category: " + category);
            Log.d(TAG, "Priority: " + priority);

            sendToBackend(packageName, appName, title, content, category, priority);

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }

    private boolean shouldSkipPackage(String packageName) {
        if (packageName == null) return true;

        if (packageName.startsWith("android")) return true;
        if (packageName.startsWith("com.android.system")) return true;
        if (packageName.equals("com.google.android.apps.maps")) return true;
        if (packageName.equals("com.spotify.music")) return true;
        if (packageName.equals("com.sec.android.app.clockpackage")) return true;
        if (packageName.equals("com.android.vending")) return true;

        return false;
    }

    private String getCategory(String packageName) {
        if (packageName == null) return "other";

        if (packageName.contains("messaging") ||
            packageName.contains("sms") ||
            packageName.contains("mms") ||
            packageName.contains("whatsapp") ||
            packageName.contains("signal") ||
            packageName.contains("telegram")) {
            return "text";
        }

        if (packageName.contains("gmail") ||
            packageName.contains("email") ||
            packageName.contains("outlook")) {
            return "email";
        }

        if (packageName.contains("dialer") ||
            packageName.contains("phone")) {
            return "talk";
        }

        return "other";
    }

    private String getPriority(String packageName, String title, String content) {
        String combined = ((packageName == null ? "" : packageName) + " " +
                (title == null ? "" : title) + " " +
                (content == null ? "" : content)).toLowerCase();

        if (combined.contains("lead") ||
            combined.contains("new customer") ||
            combined.contains("quote") ||
            combined.contains("estimate") ||
            combined.contains("appointment") ||
            combined.contains("urgent") ||
            combined.contains("thumbtack") ||
            combined.contains("angi") ||
            combined.contains("homeadvisor") ||
            combined.contains("facebook")) {
            return "high";
        }

        return "normal";
    }

    private void sendToBackend(
            String packageName,
            String appName,
            String title,
            String content,
            String category,
            String priority
    ) {
        new Thread(() -> {
            try {
                URL url = new URL(BACKEND_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();

                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.setDoOutput(true);

                JSONObject json = new JSONObject();

                json.put("source", "android_notification_listener");
                json.put("app_package", packageName);
                json.put("app_name", appName);
                json.put("title", title);
                json.put("content", content);
                json.put("message", content);
                json.put("sender", title);
                json.put("category", category);
                json.put("priority", priority);
                json.put("status", "pending");

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Sent to Searlio. Response: " + responseCode);

                conn.disconnect();

            } catch (Exception e) {
                Log.e(TAG, "Error sending to Searlio backend", e);
            }
        }).start();
    }
}
