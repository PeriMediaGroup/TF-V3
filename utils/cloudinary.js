// utils/cloudinary.js
// Centralised Cloudinary upload helpers with retry + progress support.

let hasLoggedCloudinaryConfig = false;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const DEFAULT_MAX_ATTEMPTS = parsePositiveInt(
  process.env.EXPO_PUBLIC_UPLOAD_MAX_RETRIES,
  3
);
const DEFAULT_RETRY_DELAY_MS = parsePositiveInt(
  process.env.EXPO_PUBLIC_UPLOAD_RETRY_DELAY_MS,
  800
);

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class UploadError extends Error {
  constructor(message, { attempt, label, cause } = {}) {
    super(message);
    this.name = "UploadError";
    if (typeof attempt === "number") this.attempt = attempt;
    if (label) this.label = label;
    if (cause) this.cause = cause;
  }
}

const withRetry = async (
  task,
  {
    label = "Upload",
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_RETRY_DELAY_MS,
    onRetry,
  } = {}
) => {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;

      if (typeof onRetry === "function") {
        try {
          onRetry(attempt, error);
        } catch (callbackError) {
          console.warn("[cloudinary] retry callback failed", callbackError);
        }
      }

      const base =
        typeof baseDelayMs === "function"
          ? baseDelayMs(attempt, error)
          : baseDelayMs * Math.pow(2, attempt - 1);
      const delay = Math.max(50, Number(base) || DEFAULT_RETRY_DELAY_MS);
      await sleep(delay + Math.floor(Math.random() * 150));
    }
  }

  const message = lastError?.message
    ? `${label} failed after ${maxAttempts} attempts: ${lastError.message}`
    : `${label} failed after ${maxAttempts} attempts`;
  throw new UploadError(message, { attempt: maxAttempts, label, cause: lastError });
};

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

const createFormDataFactory = ({
  uri,
  mimeType,
  fileName,
  uploadPreset,
  publicId,
  folder,
}) => () => {
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: mimeType,
    name: fileName,
  });
  formData.append("upload_preset", uploadPreset);
  appendOptionalFields(formData, { publicId, folder });
  return formData;
};

const performFetchUpload = async (endpoint, formData, resourceType) => {
  const res = await fetch(endpoint, { method: "POST", body: formData });
  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    throw new Error(`Cloudinary ${resourceType} upload returned invalid JSON`);
  }

  if (!res.ok) {
    const message =
      data?.error?.message || `Cloudinary ${resourceType} upload failed`;
    throw new Error(message);
  }

  if (!data?.secure_url) {
    throw new Error(`Cloudinary ${resourceType} upload missing secure_url`);
  }

  return data.secure_url;
};

const performXhrUpload = (endpoint, formData, resourceType, onProgress) =>
  new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) {
            if (!json?.secure_url) {
              reject(
                new Error(
                  `Cloudinary ${resourceType} upload missing secure_url`
                )
              );
              return;
            }
            resolve(json.secure_url);
          } else {
            reject(
              new Error(
                json?.error?.message ||
                  `Cloudinary ${resourceType} upload failed (${xhr.status})`
              )
            );
          }
        } catch (parseError) {
          reject(
            new Error(
              `Cloudinary ${resourceType} upload returned invalid JSON response`
            )
          );
        }
      };
      xhr.onerror = () =>
        reject(new Error(`Network error during ${resourceType} upload`));
      if (xhr.upload && typeof onProgress === "function") {
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(pct);
        };
      }
      xhr.send(formData);
    } catch (err) {
      reject(err);
    }
  });

const uploadWithStrategy = async ({
  endpoint,
  resourceType,
  formDataFactory,
  strategy = "fetch",
  onProgress,
  maxAttempts,
}) =>
  withRetry(
    async (attempt) => {
      if (attempt > 1 && typeof onProgress === "function") {
        onProgress(0);
      }

      const formData = formDataFactory();

      if (strategy === "xhr") {
        return performXhrUpload(endpoint, formData, resourceType, onProgress);
      }

      return performFetchUpload(endpoint, formData, resourceType);
    },
    {
      label: `Cloudinary ${resourceType} upload`,
      maxAttempts,
      onRetry: (attempt, error) => {
        console.warn(
          `[cloudinary] retrying ${resourceType} upload after attempt ${attempt} failed:`,
          error?.message || error
        );
      },
    }
  );

export async function uploadImage(uri, publicId, options = {}) {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const formDataFactory = createFormDataFactory({
    uri,
    mimeType: "image/jpeg",
    fileName: "upload.jpg",
    uploadPreset,
    publicId,
    folder,
  });

  return uploadWithStrategy({
    endpoint: buildEndpoint(cloudName, "image"),
    resourceType: "image",
    formDataFactory,
    strategy: "fetch",
    maxAttempts,
  });
}

export async function uploadVideo(uri, options = {}) {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const formDataFactory = createFormDataFactory({
    uri,
    mimeType: "video/mp4",
    fileName: "upload.mp4",
    uploadPreset,
    folder,
  });

  return uploadWithStrategy({
    endpoint: buildEndpoint(cloudName, "video"),
    resourceType: "video",
    formDataFactory,
    strategy: "fetch",
    maxAttempts,
  });
}

export async function uploadImageWithProgress(
  uri,
  onProgress,
  publicId,
  options = {}
) {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const formDataFactory = createFormDataFactory({
    uri,
    mimeType: "image/jpeg",
    fileName: "upload.jpg",
    uploadPreset,
    publicId,
    folder,
  });

  return uploadWithStrategy({
    endpoint: buildEndpoint(cloudName, "image"),
    resourceType: "image",
    formDataFactory,
    strategy: "xhr",
    onProgress,
    maxAttempts,
  });
}

export async function uploadVideoWithProgress(
  uri,
  onProgress,
  options = {}
) {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const formDataFactory = createFormDataFactory({
    uri,
    mimeType: "video/mp4",
    fileName: "upload.mp4",
    uploadPreset,
    folder,
  });

  return uploadWithStrategy({
    endpoint: buildEndpoint(cloudName, "video"),
    resourceType: "video",
    formDataFactory,
    strategy: "xhr",
    onProgress,
    maxAttempts,
  });
}

