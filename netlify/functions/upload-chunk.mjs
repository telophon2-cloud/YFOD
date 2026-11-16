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
    const title = (url.searchParams.get("title") || "Без названия").slice(0, 100);
    const author = (url.searchParams.get("author") || "Аноним").slice(0, 50);
    const totalSizeBytes = Number(url.searchParams.get("size") || 0);

    if (!id || Number.isNaN(index) || Number.isNaN(total)) {
      return new Response("Bad parameters", { status: 400 });
    }

    if (totalSizeBytes > 20 * 1024 * 1024) {
      return new Response("File exceeds 20 MB", { status: 413 });
    }

    const chunkStore = getStore("yfod-chunks");
    const arrayBuffer = await req.arrayBuffer();

    // Сохраняем кусок файла во временное хранилище
    await chunkStore.set(`${id}_${index}`, arrayBuffer);

    // Если это последний кусок — склеиваем файл и записываем метаданные
    if (index === total - 1) {
      const chunks = [];
      let fullLength = 0;

      for (let i = 0; i < total; i++) {
        const part = await chunkStore.get(`${id}_${i}`, { type: "arrayBuffer" });
        if (!part) {
          return new Response(`Missing chunk ${i}`, { status: 500 });
        }
        chunks.push(new Uint8Array(part));
        fullLength += part.byteLength;
      }

      const fullVideo = new Uint8Array(fullLength);
      let offset = 0;
      for (const c of chunks) {
        fullVideo.set(c, offset);
        offset += c.byteLength;
      }

      const videoStore = getStore("yfod-videos");
      await videoStore.set(id, fullVideo.buffer, {
        metadata: { contentType: "video/mp4" }
      });

      // Удаляем временные куски
      for (let i = 0; i < total; i++) {
        await chunkStore.delete(`${id}_${i}`);
      }

      const metaStore = getStore("yfod-meta");
      await metaStore.setJSON(id, {
        id,
        title,
        author,
        sizeMB: (fullLength / (1024 * 1024)).toFixed(1),
        date: new Date().toLocaleDateString("ru-RU"),
        views: 0
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
};
