/**
 * Vercel Serverless Function: POST /api/screen/upload
 * 
 * 注意：Vercel Serverless Functions 是无状态的，每次请求都是独立的实例。
 * 因此，内存存储不能跨请求共享。
 * 
 * 解决方案：使用 Vercel KV（Redis）存储最新帧。
 * 如果没有配置 KV，则返回错误提示。
 * 
 * 对于投屏分析，建议使用浏览器屏幕共享模式（不需要后端存储）。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel Serverless 无状态，无法存储帧
  // 建议使用浏览器屏幕共享模式
  return res.status(503).json({ 
    error: "Screen relay requires a persistent server. Please use browser screen share mode instead.",
    suggestion: "Use the 'Screen Share' sub-mode in the live analysis tab."
  });
}
