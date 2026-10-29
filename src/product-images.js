export const PRODUCT_IMAGE_STORAGE_KEY = 'letstockin:product-images';
const MAX_IMAGE_EDGE = 1400;
const JPEG_QUALITY = 0.78;

export function fitImageDimensions(width, height, maxEdge = MAX_IMAGE_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function readProductImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') return reject(new Error('That image could not be read.'));
      const image = new Image();
      image.onerror = () => reject(new Error('That image could not be read.'));
      image.onload = () => {
        try {
          const dimensions = fitImageDimensions(image.naturalWidth, image.naturalHeight);
          const canvas = document.createElement('canvas');
          canvas.width = dimensions.width; canvas.height = dimensions.height;
          const context = canvas.getContext('2d');
          if (!context) return reject(new Error('That image could not be prepared.'));
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(compressed.length < reader.result.length ? compressed : reader.result);
        } catch { reject(new Error('That image could not be prepared.')); }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function colorImageKey(productId, color) {
  return `${productId}:color:${String(color || '').trim().toLocaleLowerCase('en-US')}`;
}

export function loadProductImages() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PRODUCT_IMAGE_STORAGE_KEY) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

export function getProductColorImages(productId, variants, images = loadProductImages()) {
  return Object.fromEntries([...new Set((variants || []).map(variant => variant.color))]
    .map(color => [color, images[colorImageKey(productId, color)]])
    .filter(([, image]) => image));
}

export function getProductImage(productId, variants, images = loadProductImages()) {
  return images[productId] || Object.values(getProductColorImages(productId, variants, images))[0] || null;
}

export function saveProductColorImages(productId, groups) {
  const next = loadProductImages();
  const prefix = `${productId}:color:`;
  Object.keys(next).filter(key => key.startsWith(prefix)).forEach(key => delete next[key]);
  groups.forEach(group => {
    if (group.color?.trim() && group.image) next[colorImageKey(productId, group.color)] = group.image;
  });
  window.localStorage.setItem(PRODUCT_IMAGE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('letstockin:product-images-updated'));
}

export function deleteProductImages(productId) {
  const next = loadProductImages();
  const prefix = `${productId}:color:`;
  Object.keys(next).filter(key => key.startsWith(prefix)).forEach(key => delete next[key]);
  window.localStorage.setItem(PRODUCT_IMAGE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('letstockin:product-images-updated'));
}
