// utils/dateHelpers.js
import { Dimensions } from "react-native";

export const formatLocalDateTime = (timestamp) => {
  if (!timestamp || typeof timestamp !== "string") return "";
  let dateObj;

  if (timestamp.includes("Z")) {
    dateObj = new Date(timestamp);
  } else {
    const isoLike = timestamp.replace(" ", "T").split(".")[0] + "Z";
    dateObj = new Date(isoLike);
  }

  const isMobile = Dimensions.get("window").width <= 768;

  return dateObj.toLocaleString("en-US", {
    ...(isMobile
      ? { dateStyle: "short", timeStyle: "short" }
      : { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
  });
};
