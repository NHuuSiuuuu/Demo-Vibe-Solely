const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

function getImageSearchError(file) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return 'Chỉ chấp nhận ảnh JPEG hoặc PNG.';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'Ảnh không được vượt quá 8 MB.';
  }

  return '';
}

export { MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES, getImageSearchError };
