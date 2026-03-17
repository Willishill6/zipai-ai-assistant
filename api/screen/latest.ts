/**
 * Vercel Serverless Function: GET /api/screen/latest
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Vercel Serverless 无状态，无法存储帧
  return res.status(200).json({ 
    status: "no_frame", 
    active: false,
    message: "Screen relay not available on Vercel. Use browser screen share mode."
  });
}
