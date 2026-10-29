export const PRODUCT_IMAGE_STORAGE_KEY = 'letstockin:product-images';
const MAX_IMAGE_EDGE = 1400;
const JPEG_QUALITY = 0.78;
const BACKGROUND_TOLERANCE = 18;

export function fitImageDimensions(width, height, maxEdge = MAX_IMAGE_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// shortcut: removes only edge-connected near-solid backgrounds; textured backgrounds need segmentation.
export function removeSolidEdgeBackground(data, width, height, tolerance = BACKGROUND_TOLERANCE) {
  const total = width * height;
  if (!width || !height || data.length < total * 4) return 0;
  const corners = [0, width - 1, (height - 1) * width, total - 1];
  const reference = corners[0] * 4;
  if (corners.some(index => data[index * 4 + 3] < 255)) return 0;
  if (corners.slice(1).some(index => Math.max(
    Math.abs(data[index * 4] - data[reference]),
    Math.abs(data[index * 4 + 1] - data[reference + 1]),
    Math.abs(data[index * 4 + 2] - data[reference + 2])
  ) > tolerance)) return 0;
  const matchesBackground = index => {
    const offset = index * 4;
    return data[offset + 3] > 0 && Math.max(
      Math.abs(data[offset] - data[reference]),
      Math.abs(data[offset + 1] - data[reference + 1]),
      Math.abs(data[offset + 2] - data[reference + 2])
    ) <= tolerance;
  };
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0; let tail = 0; let removed = 0;
  const enqueue = index => {
    if (visited[index] || !matchesBackground(index)) return;
    visited[index] = 1; queue[tail++] = index;
  };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    data[index * 4 + 3] = 0;
    removed += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  return removed;
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
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const removed = removeSolidEdgeBackground(pixels.data, canvas.width, canvas.height);
          if (removed) context.putImageData(pixels, 0, 0);
          let hasTransparency = removed > 0;
          if (!hasTransparency) {
            for (let index = 3; index < pixels.data.length; index += 4) {
              if (pixels.data[index] < 255) { hasTransparency = true; break; }
            }
          }
          if (hasTransparency) {
            const webp = canvas.toDataURL('image/webp', JPEG_QUALITY);
            return resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
          }
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
