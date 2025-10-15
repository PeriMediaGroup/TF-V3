export default {
  expo: {
    name: "TriggerFeed",
    slug: "triggerfeed-v3",
    owner: "schroeder70",
    runtimeVersion: { policy: "appVersion" },
    updates: {
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/0988d9a8-92df-4221-b1dc-51d74f283b3d",
    },
    version: "1.2.22",
    orientation: "default",
    icon: "./assets/images/icon/icon.png",
    splash: {
      image: "./assets/images/icon/splash.png",
      resizeMode: "contain",
      backgroundColor: "#1c1c1c",
    },
    assetBundlePatterns: ["**/*"],

    plugins: [
      "expo-font",
      "expo-video",
      "expo-image-picker",
      [
        "expo-camera",
        {
          cameraPermission:
            "We use your camera so you can take photos and record videos for posts.",
          microphonePermission:
            "We use your microphone to capture audio when recording videos.",
          recordAudioPermission:
            "Audio recording is required for video posts.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "We need access to your media library so you can choose photos and videos for posts.",
          savePhotosPermission:
            "We need permission to save captured media to your library.",
          isAccessMediaLocationEnabled: true,
        },
      ],
    ],

    ios: {
      infoPlist: {
        NSCameraUsageDescription:
          "Camera access is required to take photos or record videos for posts.",
        NSMicrophoneUsageDescription:
          "Microphone access is required to record audio for videos.",
        NSPhotoLibraryUsageDescription:
          "We need access to your photo library to select and upload media.",
      },
    },

    android: {
      package: "com.perimediagroup.triggerfeed",
      versionCode: 22,
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon/adaptive-foreground.png",
        backgroundColor: "#2A3439",
        monochromeImage: "./assets/images/icon/adaptive-mono.png",
      },
    },

    extra: {
      eas: { projectId: "0988d9a8-92df-4221-b1dc-51d74f283b3d" },
      EXPO_PUBLIC_SUPABASE_URL:
        "https://usvcucujzfzazszcaonb.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME:
        process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
      EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET:
        process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      EXPO_PUBLIC_GIPHY_API_KEY:
        process.env.EXPO_PUBLIC_GIPHY_API_KEY,
    },
  },
};
