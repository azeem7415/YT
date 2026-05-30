# Private YouTube Shorts Tool

Private tool for your own/permitted YouTube Shorts links.

## Features
- Password protected
- Fetches YouTube title, description, thumbnail
- Downloads permitted videos through server-side yt-dlp
- Copy title/description buttons
- Local downloads folder
- Rate limited and private-use oriented

## Install on Ubuntu VPS

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip ffmpeg
python3 -m pip install -U yt-dlp
```

Upload this folder to your server, then:

```bash
npm install
cp .env.example .env
nano .env
npm start
```

Open:

```text
http://YOUR_SERVER_IP:3000
```

## YouTube API Key
Create a YouTube Data API v3 key from Google Cloud Console and paste it in `.env`.

## Important
Use only for your own videos, videos you have permission to download, or content legally allowed for reuse.
Do not make this public as a general YouTube downloader.
