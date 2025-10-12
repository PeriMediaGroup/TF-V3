const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-dev-launcher",
  "node_modules",
  "expo-dev-menu"
);

try {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log("[postinstall] Removed duplicate expo-dev-menu from expo-dev-launcher.");
  }
} catch (err) {
  console.warn("[postinstall] Failed to clean duplicate expo-dev-menu:", err.message);
}
