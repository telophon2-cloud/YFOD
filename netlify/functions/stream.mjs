import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) return new Response("No ID", { status: 400 });

  const videoStore = getStore("yfod-videos");
  const blob = await videoStore.get(id, { type: "arrayBuffer" });

  if (!blob) return new Response("Not found", { status: 404 });

  const totalSize = blob.byteLength;
  const range = req.headers.get("range");

  const headers = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline"
  };

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    const chunk = blob.slice(start, end + 1);

    return new Response(chunk, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": chunk.byteLength.toString()
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
