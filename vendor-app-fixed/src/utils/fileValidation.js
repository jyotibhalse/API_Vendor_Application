export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export function validateImageFile(file) {
  if (!file) {
    return { valid: false, message: "No image selected." };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      message: `Each image must be ${MAX_IMAGE_SIZE_MB} MB or smaller.`,
    };
  }

  if (file.type && !file.type.startsWith("image/")) {
    return { valid: false, message: "Only image files can be uploaded." };
  }

  return { valid: true, message: "" };
}
