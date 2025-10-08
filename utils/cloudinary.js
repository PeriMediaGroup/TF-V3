// utils/cloudinary.js

export async function uploadImage(uri, publicId) {
  const cloud = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.EXPO_PUBLIC_CLOUDINARY_PRESET; // unsigned preset for images
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER; // optional
  if (!cloud || !preset) {
    throw new Error("Cloudinary not configured: set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_PRESET in .env");
  }
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "image/jpeg",
    name: "upload.jpg",
  });
  formData.append("upload_preset", preset);
  if (publicId) formData.append("public_id", publicId);
  if (folder) formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    { method: "POST", body: formData }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Cloudinary image upload failed");
  return data.secure_url;
}

export async function uploadVideo(uri) {
  const cloud = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.EXPO_PUBLIC_CLOUDINARY_VIDEO_PRESET || process.env.EXPO_PUBLIC_CLOUDINARY_PRESET; // unsigned preset for video
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER; // optional
  if (!cloud || !preset) {
    throw new Error("Cloudinary not configured: set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_PRESET in .env");
  }
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "video/mp4",
    name: "upload.mp4",
  });
  formData.append("upload_preset", preset);
  if (folder) formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/video/upload`,
    { method: "POST", body: formData }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Cloudinary video upload failed");
  return data.secure_url;
}

// Progress-enabled uploads using XMLHttpRequest
const xhrUpload = (url, formData, onProgress) =>
  new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) resolve(json);
          else reject(new Error(json?.error?.message || `Upload failed (${xhr.status})`));
        } catch (e) {
          reject(new Error("Invalid response from Cloudinary"));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      if (xhr.upload && typeof onProgress === "function") {
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        };
      }
      xhr.send(formData);
    } catch (err) {
      reject(err);
    }
  });

export async function uploadImageWithProgress(uri, onProgress, publicId) {
  const cloud = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.EXPO_PUBLIC_CLOUDINARY_PRESET;
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;
  if (!cloud || !preset) throw new Error("Cloudinary not configured");
  const formData = new FormData();
  formData.append("file", { uri, type: "image/jpeg", name: "upload.jpg" });
  formData.append("upload_preset", preset);
  if (publicId) formData.append("public_id", publicId);
  if (folder) formData.append("folder", folder);
  const res = await xhrUpload(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, formData, onProgress);
  return res.secure_url;
}

export async function uploadVideoWithProgress(uri, onProgress) {
  const cloud = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.EXPO_PUBLIC_CLOUDINARY_VIDEO_PRESET || process.env.EXPO_PUBLIC_CLOUDINARY_PRESET;
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;
  if (!cloud || !preset) throw new Error("Cloudinary not configured");
  const formData = new FormData();
  formData.append("file", { uri, type: "video/mp4", name: "upload.mp4" });
  formData.append("upload_preset", preset);
  if (folder) formData.append("folder", folder);
  const res = await xhrUpload(`https://api.cloudinary.com/v1_1/${cloud}/video/upload`, formData, onProgress);
  return res.secure_url;
}
