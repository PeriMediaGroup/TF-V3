export default {
  expo: {
    name: 'TriggerFeed',
    slug: 'triggerfeed-v3',
    version: '1.0.0',
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
      permissions: [ 'CAMERA', 'RECORD_AUDIO' ]
    }
  }
};
