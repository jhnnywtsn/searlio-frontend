package com.searlio.listener;

import android.os.Parcelable;
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
    @Override
    public void onListenerConnected() {
      super.onListenerConnected();
      Log.d("SearlioListener", "LISTENER CONNECTED");
    }
    private static final String TAG = "SearlioListener";

    // Use the backend that is currently receiving leads successfully
    private static final String BACKEND_URL = "https://searlio.com/api/notifications";
    // Alternative if confirmed working:
    // private static final String BACKEND_URL = "https://api.searlio.com/api/notifications";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String packageName = sbn.getPackageName();
            //if (packageName.equals("com.google.android.gm")) {
            //    return;
            //}
            if (shouldSkipPackage(packageName)) {
                return;
            }

            Notification notification = sbn.getNotification();
            Log.d(TAG, "Processing package: " + packageName);
            Bundle extras = notification.extras;
            
            if (extras != null) {
                for (String key : extras.keySet()) {
                    Object val = extras.get(key);
                    Log.d(TAG, "EXTRA: " + key + " = " + val);
                
                    if ("android.messages".equals(key)) {
                        Parcelable[] messages = extras.getParcelableArray(key);
                        if (messages != null) {
                            for (Parcelable p : messages) {
                                Bundle bundle = (Bundle) p;
                        
                                Log.d(TAG, "MSG TEXT: " + bundle.get("text"));
                                Log.d(TAG, "MSG SENDER: " + bundle.get("sender"));
                                Log.d(TAG, "MSG PERSON: " + bundle.get("person"));
                            }
                        }
                        if (messages != null) {
                            for (Parcelable p : messages) {
                                if (p instanceof Bundle) {
                                    Bundle b = (Bundle) p;
                                    Log.d(TAG, "MSG BUNDLE: " + b.toString());
                                }
                            }
                        }
                    }
                }
            }

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

            // ✅ ADD THIS BLOCK RIGHT HERE
            String titleLower = (title == null ? "" : title).toLowerCase();
            String contentLower = (content == null ? "" : content).toLowerCase();
            String combined = (titleLower + " " + contentLower).trim();

            // Skip junk / summaries (ALL apps, not just Signal)
            if (
                titleLower.equals("signal") ||
                titleLower.equals("whatsapp") ||
                titleLower.equals("telegram") ||
                combined.contains("most recent from") ||
                combined.matches(".*\\d+ messages? in \\d+ chats?.*") ||
                combined.matches(".*\\d+ messages? from .*")
            ) {
                return;
            }

            // Skip call/status spam
            if (
                combined.contains("missed video call") ||
                combined.contains("missed voice call") ||
                combined.contains("missed call") ||
                combined.contains("ringing") ||
                combined.contains("calling")
            ) {
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

            // --- Phone extraction ---
            String phone = "";

            // 1. Check explicit extras some SMS apps populate
            if (extras != null) {
                String address = extras.getString("address");
                String senderAddress = extras.getString("sender_address");
                if (address != null && !address.isEmpty()) phone = address;
                else if (senderAddress != null && !senderAddress.isEmpty()) phone = senderAddress;
            }

            // 2. Fallback: scan title then content for a phone number
            // 2. Fallback: scan title, content, notification key, shortcut id
            if (phone.isEmpty()) phone = extractPhoneFromText(title);
            if (phone.isEmpty()) phone = extractPhoneFromText(content);
            
            if (phone.isEmpty() && notification.getShortcutId() != null) {
                phone = extractPhoneFromText(notification.getShortcutId());
            }
            
            // Last resort only
            if (phone.isEmpty()) phone = extractPhoneFromText(sbn.getKey());

            // Normalize: strip everything except digits and leading +
            if (!phone.isEmpty()) {
                phone = phone.replaceAll("[^\\d+]", "");
                if (phone.startsWith("+")) {
                    // keep as-is (e.g. +18135551234)
                } else if (phone.length() == 10) {
                    phone = "1" + phone;
                }
            }

            if (phone.isEmpty()) {
            
                if ("JJ TextNow".equalsIgnoreCase(title)) {
                    phone = "+18138131282";
                }
            
                if ("Text Free".equalsIgnoreCase(title)) {
                    phone = "+18138131282";
                }
            }
            Log.d(TAG, "Phone: " + (phone.isEmpty() ? "(none)" : phone));

            sendToBackend(packageName, appName, title, content, category, priority, phone);

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }

    private boolean shouldSkipPackage(String packageName) {
        if (packageName == null) return true;

        //if (packageName.startsWith("android")) return true;
        if (packageName.startsWith("com.android.system")) return true;
        if (packageName.equals("com.google.android.apps.maps")) return true;
        if (packageName.equals("com.spotify.music")) return true;
        if (packageName.equals("com.sec.android.app.clockpackage")) return true;
        if (packageName.equals("com.android.vending")) return true;
        //if (packageName.equals("com.google.android.gm")) return true;
        if (packageName.equals("com.aol.mobile.aolapp")) return true;
        //if (packageName.equals("org.telegram.messenger")) return true;
        if (packageName.equals("com.google.android.googlequicksearchbox")) return true;
        //if (packageName.equals("com.snapchat.android")) return true;
        
        return false;
    }
    private String getCategory(String packageName) {
        if (packageName == null) return "other";

        
        if (packageName.equals("com.enflick.android.TextNow")) {
            return "text";
        }
    
        if (packageName.equals("com.pinger.textfree")) {
            return "text";
        }
    
        if (packageName.contains("messaging") ||
            packageName.contains("sms") ||
            packageName.contains("mms") ||
            packageName.contains("whatsapp") ||
            packageName.contains("signal") ||
            packageName.contains("telegram") ||
            packageName.contains("textnow") ||
            packageName.contains("textfree") ||
            packageName.contains("pinger") ||
            packageName.contains("voice")) {
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

    private String extractPhoneFromText(String text) {
        if (text == null) return "";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
            "(\\+?1?[\\s.-]?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4})"
        );
        java.util.regex.Matcher m = p.matcher(text);
        if (m.find()) {
            return m.group(1).replaceAll("[^\\d+]", "");
        }
        return "";
    }

    private void sendToBackend(
            String packageName,
            String appName,
            String title,
            String content,
            String category,
            String priority,
            String phone
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
                
                json.put("priority", priority);
                json.put("status", "pending");
                Log.d(TAG, "TITLE: " + title);
                Log.d(TAG, "CONTENT: " + content);
                Log.d(TAG, "EXTRACTED PHONE: " + phone);
                json.put("sender", phone.isEmpty() ? title : phone);
                json.put("phone", phone);
                json.put("contact_phone", phone);
                json.put("source", "android");
                json.put("can_reply", !phone.isEmpty());
                JSONObject extraData = new JSONObject();
                extraData.put("phone", phone);
                extraData.put("raw_title", title);
                extraData.put("raw_content", content);
                extraData.put("raw_app_name", appName);

                json.put("extra_data", extraData);

                json.put("category", category);
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
