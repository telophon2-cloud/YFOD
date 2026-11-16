import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) return new Response("No ID", { status: 400 });

  const videoStore = getStore("yfod-videos");
  const metaStore = getStore("yfod-meta");

  const meta = await metaStore.get(id, { type: "json" });
  const blob = await videoStore.get(id, { type: "arrayBuffer" });

  if (!blob) return new Response("Video not found", { status: 404 });

  const contentType = (meta && meta.mimeType) ? meta.mimeType : "video/mp4";
  const totalSize = blob.byteLength;
  const range = req.headers.get("range");

  const headers = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
    "Cache-Control": "no-cache"
  };

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts, 10) || 0;
    const end = parts ? parseInt(parts, 10) : totalSize - 1;
    const chunksize = end - start + 1;
    const chunk = blob.slice(start, end + 1);

    return new Response(chunk, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": chunksize.toString()
      }
    });
  }

  return new Response(blob, {
    status: 200,
    headers: {
      ...headers,
      "Content-Length": totalSize.toString()
    }
  });
};
