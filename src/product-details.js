export function normalizeProductDetails(product) {
  const variants = (product.variants || []).map(variant => ({
    ...variant,
    quantity: variant.quantity ?? variant.stock ?? 0
  }));
  return {
    ...product,
    productId: product.productId ?? product.id,
    matchedVariantId: product.matchedVariantId ?? variants[0]?.id,
    variants
  };
}
