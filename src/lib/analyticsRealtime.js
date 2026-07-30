/** Patch seller analytics state from a realtime product engagement payload. */
export function applyAnalyticsUpdate(prev, product) {
  if (!prev || !product) return prev;

  const id = String(product.id || product._id);
  const views = Number(product.viewCount || 0);
  const clicks = Number(product.clickCount || 0);
  const category = product.category || "Other";
  const list = [...(prev.products || [])];
  const idx = list.findIndex((p) => String(p.id) === id);

  let oldViews = 0;
  let oldClicks = 0;

  if (idx >= 0) {
    oldViews = Number(list[idx].views || 0);
    oldClicks = Number(list[idx].clicks || 0);
    list[idx] = {
      ...list[idx],
      views,
      clicks,
      stock: product.currentStock ?? list[idx].stock,
    };
  } else {
    list.push({
      id,
      name: product.name,
      category,
      views,
      clicks,
      stock: product.currentStock || 0,
      unitPrice: product.unitPrice,
    });
  }

  list.sort((a, b) => b.clicks - a.clicks || b.views - a.views);

  const dViews = views - oldViews;
  const dClicks = clicks - oldClicks;

  const byCategoryMap = {};
  for (const c of prev.byCategory || []) {
    byCategoryMap[c.category] = { ...c };
  }
  if (!byCategoryMap[category]) {
    byCategoryMap[category] = { category, views: 0, clicks: 0, products: 0 };
  }
  byCategoryMap[category].views += dViews;
  byCategoryMap[category].clicks += dClicks;
  if (idx < 0) byCategoryMap[category].products += 1;

  return {
    products: list,
    byCategory: Object.values(byCategoryMap),
    totals: {
      ...(prev.totals || {}),
      views: Number(prev.totals?.views || 0) + dViews,
      clicks: Number(prev.totals?.clicks || 0) + dClicks,
      products: list.length,
      stock: prev.totals?.stock ?? list.reduce((s, p) => s + Number(p.stock || 0), 0),
    },
  };
}
