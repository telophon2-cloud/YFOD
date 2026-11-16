import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const uploadId = formData.get("uploadId");
    const index = Number(formData.get("index"));
    const total = Number(formData.get("total"));
    const title = (formData.get("title") || "Без названия").toString().slice(0, 100);
    const author = (formData.get("author") || "Аноним").toString().slice(0, 50);
    const mimeType = (formData.get("mimeType") || "video/mp4").toString();
    const totalSize = Number(formData.get("totalSize") || 0);
    const chunkFile = formData.get("chunk");

    if (!uploadId || !chunkFile) {
      return new Response("Неверные данные", { status: 400 });
    }

    const tempStore = getStore("yfod-temp");
    const chunkBuffer = await chunkFile.arrayBuffer();
    await tempStore.set(`${uploadId}_${index}`, chunkBuffer);

    if (index === total - 1) {
      const parts = [];
      let fullLength = 0;

      for (let i = 0; i < total; i++) {
        const partBuf = await tempStore.get(`${uploadId}_${i}`, { type: "arrayBuffer" });
        if (!partBuf) {
          return new Response(`Не найдена часть ${i}`, { status: 500 });
        }
        parts.push(new Uint8Array(partBuf));
        fullLength += partBuf.byteLength;
        await tempStore.delete(`${uploadId}_${i}`);
      }

      const merged = new Uint8Array(fullLength);
      let offset = 0;
      for (const p of parts) {
        merged.set(p, offset);
        offset += p.byteLength;
      }

      const videoStore = getStore("yfod-videos");
      const metaStore = getStore("yfod-meta");

      await videoStore.set(uploadId, merged.buffer, {
        metadata: { contentType: mimeType }
      });

      const ext = mimeType.indexOf("webm") !== -1 ? "WEBM" : "MP4";
      await metaStore.setJSON(uploadId, {
        id: uploadId,
        title,
        author,
        format: ext,
        mimeType,
        sizeMB: ((totalSize || fullLength) / (1024 * 1024)).toFixed(2),
        date: new Date().toLocaleDateString("ru-RU"),
        views: 0
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Ошибка сервера: " + err.message, { status: 500 });
  }
};
