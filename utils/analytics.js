import { Platform } from "react-native";
import Constants from "expo-constants";
import supabase from "../supabase/client";

const TABLE_NAME = "client_events";

const getAppInfo = () => {
  const expoConfig = Constants?.expoConfig || Constants?.manifest || {};
  return {
    appVersion: expoConfig.version || null,
    runtimeVersion:
      (expoConfig.runtimeVersion &&
        (typeof expoConfig.runtimeVersion === "string"
          ? expoConfig.runtimeVersion
          : expoConfig.runtimeVersion?.policy)) ||
      null,
  };
};

let hasWarnedPersist = false;
let persistHardDisabled = false;

const persistEvent = async (record) => {
  if (
    typeof supabase?.isConfigured === "function" &&
    supabase.isConfigured() &&
    !persistHardDisabled
  ) {
    try {
      const { error } = await supabase.from(TABLE_NAME).insert([record]);
      if (error) {
        const message = error?.message || String(error);
        if (
          message.toLowerCase().includes("does not exist") ||
          message.toLowerCase().includes("permission denied")
        ) {
          persistHardDisabled = true;
        }
        throw new Error(message);
      }
      return true;
    } catch (error) {
      if (__DEV__ && !hasWarnedPersist) {
        console.warn("[analytics] persist failed:", error?.message || error);
      }
      hasWarnedPersist = true;
    }
  }
  return false;
};

export async function logClientEvent(event, payload = {}, options = {}) {
  try {
    const timestamp = new Date().toISOString();
    const { appVersion, runtimeVersion } = getAppInfo();

    const record = {
      event,
      payload,
      platform: Platform.OS,
      created_at: timestamp,
      app_version: appVersion,
      runtime_version: runtimeVersion,
      ...options,
    };

    const persisted = await persistEvent(record);
    if (!persisted) {
      console.log(`[analytics] ${event}`, {
        platform: record.platform,
        payload: record.payload,
      });
    }
  } catch (error) {
    console.warn("[analytics] logging error:", error?.message || error);
  }
}

export const logPermissionEvent = (feature, stage, details = {}) =>
  logClientEvent(`permission.${feature}.${stage}`, details);

