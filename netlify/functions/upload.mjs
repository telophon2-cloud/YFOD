import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(null, { status: 302, headers: { Location: "/" } });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("video");
    const title = (formData.get("title") || "Без названия").toString().slice(0, 100);
    const author = (formData.get("author") || "Аноним").toString().slice(0, 50);

    if (!file || typeof file === "string" || file.size === 0) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/?err=" + encodeURIComponent("Файл не выбран") }
      });
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/?err=" + encodeURIComponent("Файл превышает лимит 20 МБ") }
      });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const videoStore = getStore("yfod-videos");
    const metaStore = getStore("yfod-meta");

    const arrayBuffer = await file.arrayBuffer();

    await videoStore.set(id, arrayBuffer, {
      metadata: { contentType: "video/mp4" }
    });

    const meta = {
      id,
      title,
      author,
      sizeMB: (file.size / (1024 * 1024)).toFixed(1),
      date: new Date().toLocaleDateString("ru-RU"),
      views: 0
    };
    await metaStore.setJSON(id, meta);

    return new Response(null, {
      status: 302,
      headers: { Location: "/?watch=" + encodeURIComponent(id) }
    });
  } catch (err) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?err=" + encodeURIComponent("Ошибка загрузки: " + err.message) }
    });
  }
};
