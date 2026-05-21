# Native Android Notification Listener

This module captures ALL notifications from your Android device and sends them to your backend.

## Setup Instructions

### Step 1: Update app.json

Add the plugin to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "./plugins/notification-listener"
    ]
  }
}
```

### Step 2: Update Backend URL

Edit `plugins/notification-listener/android/NotificationListener.java`:

```java
private static final String BACKEND_URL = "https://serotonia-xsphere.com/api/notifications";
```

### Step 3: Build the App

You MUST use EAS Build (not Expo Go) for native code:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build for Android
eas build --platform android --profile development
```

### Step 4: Install APK

1. Download the APK from EAS dashboard
2. Install on your Android device
3. Open the app

### Step 5: Grant Permission

1. Go to Settings on your phone
2. Search for "Notification access" or "Special app access"
3. Find "Notification Relay"
4. Toggle ON
5. Confirm "Allow"

## How It Works

```
Any App Notification
        ↓
Android NotificationListenerService
        ↓
Captures: package, title, content
        ↓
POST to /api/notifications
        ↓
Your Backend categorizes & stores
        ↓
AI generates reply
```

## Filtering Notifications

Edit `NotificationListener.java` to filter what gets captured:

```java
// Skip specific apps
if (packageName.equals("com.spotify.music")) return;

// Only capture messaging apps
String[] allowedApps = {"com.whatsapp", "org.telegram.messenger"};
if (!Arrays.asList(allowedApps).contains(packageName)) return;
```

## Troubleshooting

**Notifications not appearing?**
- Check if permission is granted in Settings
- Check if backend URL is correct
- Check backend logs for incoming requests

**App crashes?**
- Run `eas build` with `--profile development` for debug logs
- Check `adb logcat | grep NotificationListener`

## Security Note

This service has access to ALL your notifications. Only use on your personal device!
