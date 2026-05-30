require("dotenv").config();

const express = require("express");
const axios = require("axios");

const helmet = require("helmet");

const rateLimit = require("express-rate-limit");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;


const DOWNLOAD_DIR = path.join(__dirname, process.env.DOWNLOAD_DIR || "downloads");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

function extractVideoId(input) {
  try {
    let rawUrl = input.trim();
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      rawUrl = "https://" + rawUrl;
    }
    const url = new URL(rawUrl);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "").slice(0, 20);
    }

    if (url.pathname.includes("/shorts/")) {
      const parts = url.pathname.split("/");
      const idx = parts.indexOf("shorts");
      return parts[idx + 1]?.slice(0, 20);
    }

    const v = url.searchParams.get("v");
    if (v) return v.slice(0, 20);

    return null;
  } catch {
    return null;
  }
}



function safeFilename(name) {
  return String(name || "youtube-short")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "youtube-short";
}

function decodeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

app.post("/api/metadata", async (req, res) => {
  const videoId = extractVideoId(req.body.url || "");
  if (!videoId) return res.status(400).json({ error: "Invalid YouTube link" });

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  try {
    const { data } = await axios.get(videoUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });

    const titleMatch = data.match(/<meta name="title" content="([^"]+)">/) || data.match(/<title>(.*?) - YouTube<\/title>/);
    const descMatch = data.match(/<meta name="description" content="([^"]+)">/);
    const authorMatch = data.match(/<link itemprop="name" content="([^"]+)">/);
    const thumbMatch = data.match(/<meta property="og:image" content="([^"]+)">/);

    res.json({
      videoId,
      title: titleMatch ? decodeHtml(titleMatch[1]) : "Unknown Title",
      description: descMatch ? decodeHtml(descMatch[1]) : "",
      channelTitle: authorMatch ? decodeHtml(authorMatch[1]) : "Unknown Channel",
      publishedAt: "",
      thumbnail: thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch metadata fast. Video might be unavailable.",
      details: err.message
    });
  }
});

app.post("/api/download", async (req, res) => {
  const videoId = extractVideoId(req.body.url || "");
  const title = safeFilename(req.body.title || videoId);

  if (!videoId) return res.status(400).json({ error: "Invalid YouTube link" });

  const outputTemplate = path.join(DOWNLOAD_DIR, `${Date.now()}-${title}.%(ext)s`);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const ffmpegPath = require("ffmpeg-static");

  const args = [
    "-f",
    "bv*[height<=2160]+ba/b[height<=2160]/best",
    "--merge-output-format",
    "mp4",
    "--ffmpeg-location",
    ffmpegPath,
    "-o",
    outputTemplate,
    videoUrl
  ];

  const ytDlpPath = path.join(__dirname, "yt-dlp");
  execFile(ytDlpPath, args, { timeout: 10 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: "Download failed. Make sure yt-dlp is installed and the video is permitted/available.",
        details: stderr || error.message
      });
    }

    const downloadedFiles = fs.readdirSync(DOWNLOAD_DIR)
      .filter(file => file.includes(`${title}`))
      .map(file => ({
        file,
        time: fs.statSync(path.join(DOWNLOAD_DIR, file)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    if (!downloadedFiles.length) {
      return res.status(500).json({ error: "File downloaded but could not be found." });
    }

    res.json({
      ok: true,
      file: downloadedFiles[0].file,
      downloadUrl: `/file/${encodeURIComponent(downloadedFiles[0].file)}`
    });
  });
});

app.get("/file/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(DOWNLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

  res.download(filePath);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Private tool running on http://localhost:${PORT}`);
});
