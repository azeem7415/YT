#!/usr/bin/env bash
set -e

echo ">>> Downloading yt-dlp for Linux..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp
chmod a+rx ./yt-dlp
echo ">>> yt-dlp installed successfully!"
