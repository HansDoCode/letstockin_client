export function groupInventoryRows(rows) {
  const products = new Map();
  for (const row of rows) {
    const key = String(row.product_id);
    if (!products.has(key)) products.set(key, { product_id: row.product_id, name: row.name, variants: [] });
    products.get(key).variants.push(row);
  }
  return [...products.values()];
}
