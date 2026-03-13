/**
 * Screen Relay Service
 * 
 * 接收本地Python截屏脚本上传的截图，存储在内存中，
 * 前端通过轮询获取最新截图，实现实时投屏监控。
 * 
 * API:
 *   POST /api/screen/upload   - 本地脚本上传截图（base64 JPEG）
 *   GET  /api/screen/latest    - 前端获取最新截图
 *   GET  /api/screen/stream    - SSE实时推送新截图通知
 *   POST /api/screen/stop      - 停止投屏会话
 */

import { Express, Request, Response } from "express";

interface ScreenFrame {
  imageBase64: string;  // data:image/jpeg;base64,... 格式
  timestamp: number;
  hash: string;
}

// 内存中存储最新一帧
let latestFrame: ScreenFrame | null = null;
let sessionActive = false;
let sseClients: Response[] = [];

function simpleHash(str: string): string {
  let hash = 0;
  const step = Math.max(1, Math.floor(str.length / 100));
  for (let i = 0; i < str.length; i += step) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

export function registerScreenRelayRoutes(app: Express) {
  // 上传截图（本地Python脚本调用）
  app.post("/api/screen/upload", (req: Request, res: Response) => {
    try {
      const { image } = req.body;
      if (!image || typeof image !== "string") {
        return res.status(400).json({ error: "Missing image field" });
      }

      // 确保是base64格式
      let imageBase64 = image;
      if (!image.startsWith("data:image/")) {
        imageBase64 = `data:image/jpeg;base64,${image}`;
      }

      const hash = simpleHash(imageBase64);

      // 如果和上一帧相同，跳过
      if (latestFrame && latestFrame.hash === hash) {
        return res.json({ status: "skipped", reason: "same_frame" });
      }

      latestFrame = {
        imageBase64,
        timestamp: Date.now(),
        hash,
      };
      sessionActive = true;

      // 通知所有SSE客户端
      for (const client of sseClients) {
        try {
          client.write(`data: ${JSON.stringify({ type: "new_frame", timestamp: latestFrame.timestamp, hash })}\n\n`);
        } catch {
          // client disconnected
        }
      }

      return res.json({ status: "ok", timestamp: latestFrame.timestamp });
    } catch (err) {
      console.error("[ScreenRelay] Upload error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // 获取最新截图
  app.get("/api/screen/latest", (req: Request, res: Response) => {
    if (!latestFrame) {
      return res.json({ status: "no_frame", active: sessionActive });
    }

    const sinceHash = req.query.since as string;
    if (sinceHash && sinceHash === latestFrame.hash) {
      return res.json({ status: "no_change", active: sessionActive, timestamp: latestFrame.timestamp });
    }

    return res.json({
      status: "ok",
      active: sessionActive,
      image: latestFrame.imageBase64,
      timestamp: latestFrame.timestamp,
      hash: latestFrame.hash,
    });
  });

  // SSE实时推送
  app.get("/api/screen/stream", (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 发送当前状态
    res.write(`data: ${JSON.stringify({ type: "connected", active: sessionActive })}\n\n`);

    sseClients.push(res);

    req.on("close", () => {
      sseClients = sseClients.filter((c) => c !== res);
    });
  });

  // 停止投屏会话
  app.post("/api/screen/stop", (_req: Request, res: Response) => {
    sessionActive = false;
    latestFrame = null;

    // 通知SSE客户端
    for (const client of sseClients) {
      try {
        client.write(`data: ${JSON.stringify({ type: "session_stopped" })}\n\n`);
      } catch {
        // ignore
      }
    }

    return res.json({ status: "ok" });
  });
}
