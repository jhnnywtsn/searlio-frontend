const { withAndroidManifest, withMainActivity, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withNotificationListener(config) {
  // Add service to AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    
    // Add BIND_NOTIFICATION_LISTENER_SERVICE permission
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    
    const hasPermission = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE'
    );
    
    if (!hasPermission) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE' },
      });
    }

    // Add the NotificationListenerService
    const application = manifest.application?.[0];
    if (application) {
      if (!application.service) {
        application.service = [];
      }

      const hasService = application.service.some(
        (s) => s.$?.['android:name'] === '.NotificationListener'
      );

      if (!hasService) {
        application.service.push({
          $: {
            'android:name': '.NotificationListener',
            'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: { 'android:name': 'android.service.notification.NotificationListenerService' },
                },
              ],
            },
          ],
        });
      }
    }

    return config;
  });

  return config;
}

module.exports = withNotificationListener;
