import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const index = Number(url.searchParams.get("index"));
    const total = Number(url.searchParams.get("total"));
    const totalSize = Number(url.searchParams.get("size"));
    const title = (url.searchParams.get("title") || "Без названия").slice(0, 100);
    const author = (url.searchParams.get("author") || "Аноним").slice(0, 50);

    if (!id || Number.isNaN(index) || Number.isNaN(total)) {
      return new Response("Bad params", { status: 400 });
    }

    if (totalSize > 20 * 1024 * 1024) {
      return new Response("Max 20 MB", { status: 413 });
    }

    const chunkStore = getStore("yfod-chunks");
    const chunkBuffer = await req.arrayBuffer();
    await chunkStore.set(`${id}_${index}`, chunkBuffer);

    if (index === total - 1) {
      const parts = [];
      let combinedLength = 0;

      for (let i = 0; i < total; i++) {
        const part = await chunkStore.get(`${id}_${i}`, { type: "arrayBuffer" });
        if (!part) {
          return new Response(`Missing chunk ${i}`, { status: 500 });
        }
        parts.push(new Uint8Array(part));
        combinedLength += part.byteLength;
      }

      const fullVideo = new Uint8Array(combinedLength);
      let offset = 0;
      for (const p of parts) {
        fullVideo.set(p, offset);
        offset += p.byteLength;
      }

      const videoStore = getStore("yfod-videos");
      const metaStore = getStore("yfod-meta");

      await videoStore.set(id, fullVideo.buffer, {
        metadata: { contentType: "video/mp4" }
      });

      await metaStore.setJSON(id, {
        id,
        title,
        author,
        sizeMB: (combinedLength / (1024 * 1024)).toFixed(2),
        date: new Date().toLocaleDateString("ru-RU"),
        views: 0
      });

      for (let i = 0; i < total; i++) {
        await chunkStore.delete(`${id}_${i}`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
};
