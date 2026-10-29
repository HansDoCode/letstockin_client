export const PRODUCT_IMAGE_STORAGE_KEY = 'letstockin:product-images';

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
