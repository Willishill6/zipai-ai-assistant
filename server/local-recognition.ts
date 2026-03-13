import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export type LocalRecognitionResult = {
  handTiles: string[];
  myExposedGroups: Array<{ tiles: string[]; type: string }>;
  opponentExposedGroups: Array<{ tiles: string[]; type: string }>;
  discardedTiles: string[];
  remainingTiles: number;
  myCurrentHuxi: number;
  opponentCurrentHuxi: number;
  actionButtons: string;
  isDealer: boolean;
  debug?: {
    boxCount?: number;
    unresolvedCount?: number;
    unresolved?: Array<{
      box: [number, number, number, number];
      color: string;
      ocr: string[];
    }>;
  };
};

type PythonRecognizerPayload =
  | {
      ok: true;
      recognition: LocalRecognitionResult;
    }
  | {
      ok: false;
      error?: string;
      tesseractConfigured?: boolean;
    };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PYTHON_SCRIPT = path.join(__dirname, "local-recognizer.py");
const HEALTHCHECK_CACHE_MS = 30_000;
const HEALTHCHECK_TIMEOUT_MS = 3_000;
const RECOGNITION_TIMEOUT_MS = 8_000;

let supportCache:
  | {
      checkedAt: number;
      value: boolean;
    }
  | undefined;

export function normalizeOcrText(text: string): string {
  return text.replace(/\s+/g, "");
}

export function findKnownScreenshotFixture(): null {
  return null;
}

function stripDataUrlPrefix(imageBase64: string): {
  base64: string;
  extension: string;
} {
  const match = imageBase64.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return { base64: imageBase64, extension: "png" };
  }

  const [, rawExtension, base64] = match;
  const extension = rawExtension.toLowerCase() === "jpeg" ? "jpg" : rawExtension;
  return { base64, extension };
}

function parseRecognizerPayload(stdout: string): PythonRecognizerPayload | null {
  const lines = stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith("{")) continue;

    try {
      return JSON.parse(line) as PythonRecognizerPayload;
    } catch {
      continue;
    }
  }

  return null;
}

function runPythonRecognizer(
  args: string[],
  timeoutMs: number
): Promise<PythonRecognizerPayload | null> {
  return new Promise((resolve, reject) => {
    const child = spawn("python", ["-X", "utf8", PYTHON_SCRIPT, ...args], {
      cwd: path.dirname(PYTHON_SCRIPT),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", code => {
      clearTimeout(timeout);

      if (timedOut) {
        resolve(null);
        return;
      }

      const payload = parseRecognizerPayload(stdout);
      if (payload) {
        if (stderr.trim()) {
          console.warn("[LocalRecognition] python stderr:", stderr.trim());
        }
        resolve(payload);
        return;
      }

      if (code === 0) {
        resolve(null);
        return;
      }

      reject(
        new Error(
          `[LocalRecognition] recognizer exited with code ${code ?? "unknown"}${stderr.trim() ? `: ${stderr.trim()}` : ""}`
        )
      );
    });
  });
}

export async function hasLocalRecognitionSupport(): Promise<boolean> {
  const now = Date.now();
  if (supportCache && now - supportCache.checkedAt < HEALTHCHECK_CACHE_MS) {
    return supportCache.value;
  }

  try {
    const payload = await runPythonRecognizer(
      ["--healthcheck"],
      HEALTHCHECK_TIMEOUT_MS
    );
    const value = Boolean(payload?.ok);
    supportCache = { checkedAt: now, value };
    return value;
  } catch (error) {
    console.warn("[LocalRecognition] healthcheck failed:", error);
    supportCache = { checkedAt: now, value: false };
    return false;
  }
}

export async function tryRecognizeLocally(
  imageBase64: string
): Promise<LocalRecognitionResult | null> {
  const { base64, extension } = stripDataUrlPrefix(imageBase64);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zipai-local-"));
  const tempImagePath = path.join(
    tempDir,
    `upload-${randomUUID()}.${extension || "png"}`
  );

  try {
    await fs.writeFile(tempImagePath, Buffer.from(base64, "base64"));
    const payload = await runPythonRecognizer(
      [tempImagePath],
      RECOGNITION_TIMEOUT_MS
    );

    if (!payload?.ok) {
      if (payload?.error) {
        console.warn("[LocalRecognition] recognizer returned error:", payload.error);
      }
      return null;
    }

    if (!payload.recognition.handTiles?.length) {
      return null;
    }

    return payload.recognition;
  } catch (error) {
    console.warn("[LocalRecognition] local recognition failed:", error);
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
