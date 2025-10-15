// utils/cloudinary.js

let hasLoggedCloudinaryConfig = false;

const getCloudinaryConfig = () => {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!hasLoggedCloudinaryConfig) {
    console.log("[cloudinary] EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME:", cloudName);
    console.log("[cloudinary] EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET:", uploadPreset);
    hasLoggedCloudinaryConfig = true;
  }

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary not configured: set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env"
    );
  }

  return { cloudName, uploadPreset };
};

const appendOptionalFields = (formData, { publicId, folder }) => {
  if (publicId) formData.append("public_id", publicId);
  if (folder) formData.append("folder", folder);
};

const buildEndpoint = (cloudName, type) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`;

const uploadViaFetch = async (endpoint, formData, type) => {
  const res = await fetch(endpoint, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Cloudinary ${type} upload failed`);
  }
  return data.secure_url;
};

export async function uploadImage(uri, publicId) {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER; // optional

  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "image/jpeg",
    name: "upload.jpg",
  });
  formData.append("upload_preset", uploadPreset);
  appendOptionalFields(formData, { publicId, folder });

  return uploadViaFetch(buildEndpoint(cloudName, "image"), formData, "image");
}

export async function uploadVideo(uri) {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER; // optional

  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "video/mp4",
    name: "upload.mp4",
  });
  formData.append("upload_preset", uploadPreset);
  appendOptionalFields(formData, { folder });

  return uploadViaFetch(buildEndpoint(cloudName, "video"), formData, "video");
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
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;

  const formData = new FormData();
  formData.append("file", { uri, type: "image/jpeg", name: "upload.jpg" });
  formData.append("upload_preset", uploadPreset);
  appendOptionalFields(formData, { publicId, folder });

  const res = await xhrUpload(buildEndpoint(cloudName, "image"), formData, onProgress);
  return res.secure_url;
}

export async function uploadVideoWithProgress(uri, onProgress) {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;

  const formData = new FormData();
  formData.append("file", { uri, type: "video/mp4", name: "upload.mp4" });
  formData.append("upload_preset", uploadPreset);
  appendOptionalFields(formData, { folder });

  const res = await xhrUpload(buildEndpoint(cloudName, "video"), formData, onProgress);
  return res.secure_url;
}
