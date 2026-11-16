import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const viewId = url.searchParams.get("view");
  const metaStore = getStore("yfod-meta");

  if (viewId) {
    const item = await metaStore.get(viewId, { type: "json" });
    if (item) {
      item.views = (item.views || 0) + 1;
      await metaStore.setJSON(viewId, item);
      return new Response(JSON.stringify(item), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }

  const { blobs } = await metaStore.list();
  const list = [];
  for (const blob of blobs) {
    const data = await metaStore.get(blob.key, { type: "json" });
    if (data) list.push(data);
  }
  list.sort((a, b) => b.id.localeCompare(a.id));

  return new Response(JSON.stringify(list), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
