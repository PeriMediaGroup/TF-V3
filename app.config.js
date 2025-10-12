export default {
  expo: {
    name: 'TriggerFeed',
    slug: 'triggerfeed-v3',
    owner: 'schroeder70',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      url: 'https://u.expo.dev/0988d9a8-92df-4221-b1dc-51d74f283b3d'
    },
    version: '1.1.2',
    orientation: 'default',
    icon: './assets/images/icon/icon.png',
    splash: {
      image: './assets/images/icon/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1c1c1c'
    },
    assetBundlePatterns: ['**/*'],
    plugins: [
      'expo-video',
      'expo-font',
      [
        'expo-camera',
        {
          cameraPermission: 'We use the camera to let you record videos for posts.',
          microphonePermission: 'We use the microphone to capture audio for your videos.'
        }
      ]
    ],
    ios: {
      infoPlist: {
        NSCameraUsageDescription: 'Camera access is required to record videos for posts.',
        NSMicrophoneUsageDescription: 'Microphone access is required to record audio for videos.'
      }
    },
    android: {
      package: 'com.perimediagroup.triggerfeed',
      versionCode: 12,
      permissions: ['CAMERA', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'],
      adaptiveIcon: {
        foregroundImage: './assets/images/icon/adaptive-foreground.png',
        backgroundColor: '#2A3439',
        monochromeImage: './assets/images/icon/adaptive-mono.png'
      }
    },
    extra: {
      eas: {
        projectId: '0988d9a8-92df-4221-b1dc-51d74f283b3d'
      },
      EXPO_PUBLIC_SUPABASE_URL: "https://your-supabase-url.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
      EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: "triggerfeed_unsigned",
      EXPO_PUBLIC_GIPHY_API_KEY: process.env.EXPO_PUBLIC_GIPHY_API_KEY
    }
  }
};
