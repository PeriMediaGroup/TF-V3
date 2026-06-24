// plugins/removeForegroundServicePermission.js
const { withAndroidManifest } = require("expo/config-plugins");

const PERM = "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK";

/**
 * Config plugin to remove FOREGROUND_SERVICE_MEDIA_PLAYBACK
 * from the merged AndroidManifest.
 */
module.exports = function removeForegroundServicePermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    if (Array.isArray(manifest.usesPermissions)) {
      manifest.usesPermissions = manifest.usesPermissions.filter((item) => {
        const name = item?.$?.["android:name"];
        return name !== PERM;
      });
    }

    return config;
  });
};
