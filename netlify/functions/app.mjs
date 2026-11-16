import { getStore } from "@netlify/blobs";
import fs from "node:fs";
import path from "node:path";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async (req) => {
  const url = new URL(req.url);
  const watchId = url.searchParams.get("watch");
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();

  const metaStore = getStore("yfod-meta");
  const { blobs } = await metaStore.list();

  const videos = [];
  for (const blob of blobs) {
    const data = await metaStore.get(blob.key, { type: "json" });
    if (data) videos.push(data);
  }
  videos.sort((a, b) => b.id.localeCompare(a.id));

  let playerHtml = "";
  if (watchId) {
    const current = videos.find((v) => v.id === watchId);
    if (current) {
      current.views = (current.views || 0) + 1;
      await metaStore.setJSON(watchId, current);

      playerHtml = `
      <h2>Просмотр: ${escapeHtml(current.title)}</h2>
      <table border="1" cellpadding="4" cellspacing="0" bgcolor="#000000">
        <tr>
          <td>
            <video width="480" height="360" controls controlsList="nodownload" preload="metadata">
              <source src="/stream?id=${encodeURIComponent(current.id)}" type="video/mp4">
              Ваш браузер не поддерживает HTML5 video.
            </video>
          </td>
        </tr>
      </table>
      <p>
        <b>Автор:</b> ${escapeHtml(current.author)} |
        <b>Просмотров:</b> ${current.views} |
        <b>Дата:</b> ${escapeHtml(current.date)} |
        <b>Размер:</b> ${escapeHtml(current.sizeMB)} МБ
      </p>
      <p><a href="/">[ Закрыть плеер ]</a></p>
      <hr>`;
    }
  }

  const filtered = query
    ? videos.filter((v) => v.title.toLowerCase().includes(query))
    : videos;

  let listHtml = "<p>Видео пока нет.</p>";
  if (filtered.length > 0) {
    listHtml = `<table width="100%" border="1" cellpadding="6" cellspacing="0">
      <tr bgcolor="#EEEEEE">
        <th align="left">Формат</th>
        <th align="left">Название</th>
        <th align="left">Автор</th>
        <th align="left">Просмотры</th>
        <th align="left">Дата</th>
        <th align="left">Размер</th>
      </tr>`;

    for (const v of filtered) {
      listHtml += `
      <tr>
        <td><b>[MP4]</b></td>
        <td><a href="/?watch=${encodeURIComponent(v.id)}"><b>${escapeHtml(v.title)}</b></a></td>
        <td>${escapeHtml(v.author)}</td>
        <td>${v.views}</td>
        <td>${escapeHtml(v.date)}</td>
        <td>${escapeHtml(v.sizeMB)} МБ</td>
      </tr>`;
    }
    listHtml += `</table>`;
  }

  const templatePath = path.resolve("public/index.html");
  let html = fs.readFileSync(templatePath, "utf-8");
  html = html.replace("{{PLAYER_BLOCK}}", playerHtml);
  html = html.replace("{{VIDEO_LIST}}", listHtml);

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
};
