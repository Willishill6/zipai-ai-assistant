import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import TileEditor from "@/components/TileEditor";
import {
  Camera,
  Upload,
  Brain,
  Volume2,
  VolumeX,
  Loader2,
  Sparkles,
  Target,
  Lightbulb,
  AlertTriangle,
  MonitorPlay,
  Square,
  Play,
  Pause,
  Radio,
  Zap,
  Eye,
  Timer,
  Shield,
  ShieldAlert,
  Ghost,
  ChevronDown,
  ChevronUp,
  Swords,
  MapPin,
  Clipboard,
  ClipboardCheck,
  Scissors,
  Download,
  Terminal,
  Wifi,
} from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";

// === Types ===
type TileGroup = {
  tiles: string[];
  type: string;
  huxi: number;
};

type GhostOption = {
  replaceTile: string;
  formedGroup: string;
  groupType: string;
  huxiGain: number;
  isOptimal: boolean;
};

type GhostCardAnalysis = {
  hasGhost: boolean;
  currentUsage: string;
  allOptions: GhostOption[];
  bestOption: string;
};

type TileSafety = {
  tile: string;
  safetyLevel: string;
  safetyEmoji: string;
  reason: string;
};

type DefenseAnalysis = {
  riskLevel: string;
  isDefenseMode: boolean;
  defenseReason: string;
  tilesSafety: TileSafety[];
  dianpaoWarning: string;
};

type TileEfficiency = {
  tile: string;
  jinzhangCount: number;
  isWaste: boolean;
  wasteReason: string;
};

type CombinationPlan = {
  planName: string;
  groups: TileGroup[];
  totalHuxi: number;
  remainingLoose: number;
  tilesNeeded: number;
  stepsToTing: number;
  looseRelation: string;
  tingWidth: string;
  isOptimal: boolean;
  reason: string;
};

type TingTile = {
  tile: string;
  maxHuxi: number;
  planDesc: string;
};

type TingAnalysisItem = {
  discard: string;
  tingTiles: TingTile[];
  tingWidth: number;
  tingCount: number;
  maxHuxi: number;
};

type AnalysisResult = {
  handTiles: string[];
  myExposedGroups: TileGroup[];
  opponentExposedGroups: TileGroup[];
  discardedTiles: string[];
  combinationPlans: CombinationPlan[];
  handGroups: TileGroup[];
  ghostCardAnalysis: GhostCardAnalysis;
  tingAnalysis?: TingAnalysisItem[];
  huxiBreakdown: string;
  currentHuxi: number;
  potentialHuxi: number;
  opponentEstimatedHuxi: number;
  remainingTiles: number;
  defenseAnalysis: DefenseAnalysis;
  gamePhase: string;
  strategyMode: string;
  tileEfficiency: TileEfficiency[];
  kanLockAnalysis: string;
  lockedKan?: { tiles: string[]; huxi: number; description: string }[];
  kanHuxi?: number;
  actionButtons: string;
  recommendedAction: string;
  recommendedTile: string;
  discardPriority: string[];
  forwardPlan: string;
  aiSuggestion: string;
  analysisReasoning: string;
  // backward compat
  exposedTiles?: TileGroup[];
  ghostCards?: string[];
};

// === Tile helpers ===
const isBigTile = (tile: string) => "壹贰叁肆伍陆柒捌玖拾".includes(tile);
const isRedTile = (tile: string) => "二七十贰柒拾".includes(tile);
const isGhost = (tile: string) => tile === "鬼" || tile.includes("鬼") || tile.includes("飞飞");

// Safety level colors
const safetyColors: Record<string, { bg: string; border: string; text: string }> = {
  "安全": { bg: "oklch(0.92 0.05 145)", border: "oklch(0.7 0.15 145)", text: "oklch(0.4 0.15 145)" },
  "较安全": { bg: "oklch(0.95 0.03 85)", border: "oklch(0.75 0.1 85)", text: "oklch(0.45 0.1 85)" },
  "有风险": { bg: "oklch(0.95 0.04 55)", border: "oklch(0.75 0.15 55)", text: "oklch(0.45 0.15 55)" },
  "危险": { bg: "oklch(0.93 0.05 25)", border: "oklch(0.65 0.2 25)", text: "oklch(0.4 0.2 25)" },
};

// Risk level badge styles
const riskBadgeStyles: Record<string, { bg: string; text: string }> = {
  "低风险": { bg: "oklch(0.92 0.05 145)", text: "oklch(0.4 0.15 145)" },
  "中风险": { bg: "oklch(0.95 0.04 85)", text: "oklch(0.45 0.1 85)" },
  "高风险": { bg: "oklch(0.93 0.05 25)", text: "oklch(0.4 0.2 25)" },
  "极高风险": { bg: "oklch(0.9 0.08 25)", text: "oklch(0.35 0.25 25)" },
};

export default function Home() {
  const { user } = useAuth();

  // Mode
  const [mode, setMode] = useState<"upload" | "live">("live");

  // Dealer/non-dealer selection (庄家21张/闲家20张)
  const [isDealer, setIsDealer] = useState(false);
  const expectedTileCount = isDealer ? 21 : 20;

  // Upload mode state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live mode state
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const [captureInterval, setCaptureInterval] = useState(1);
  const [blankFrameWarning, setBlankFrameWarning] = useState(false);
  const [livePreview, setLivePreview] = useState<string | null>(null);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string | null>(null);

  // Clipboard auto-poll mode state (default to clipboard mode as recommended)
  const [clipboardMode, setClipboardMode] = useState(false);
  const [clipboardListening, setClipboardListening] = useState(false);
  const [clipboardAutoPolling, setClipboardAutoPolling] = useState(false);
  const [clipboardPermission, setClipboardPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const clipboardPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastClipboardHashRef = useRef<string>('');

  // Screen capture helper mode (Python script uploads screenshots)
  type LiveSubMode = 'clipboard' | 'screenShare' | 'captureHelper';
  const [liveSubMode, setLiveSubMode] = useState<LiveSubMode>('captureHelper');
  const [helperConnected, setHelperConnected] = useState(false);
  const [helperPolling, setHelperPolling] = useState(false);
  const helperPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHelperHashRef = useRef<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastImageHashRef = useRef<string>("");
  const isAnalyzingRef = useRef(false);

  // Voice
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const lastSpokenRef = useRef<string>("");

  // Result
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapsible sections
  const [showGhostDetails, setShowGhostDetails] = useState(true);
  const [showDefenseDetails, setShowDefenseDetails] = useState(true);

  const handleAnalysisSuccess = (data: any) => {
    // Normalize backward compat
    if (!data.myExposedGroups && data.exposedTiles) {
      data.myExposedGroups = data.exposedTiles;
    }
    if (!data.opponentExposedGroups) data.opponentExposedGroups = [];
    if (!data.discardedTiles) data.discardedTiles = [];
    if (!data.ghostCardAnalysis) {
      data.ghostCardAnalysis = { hasGhost: false, currentUsage: "无鬼牌", allOptions: [], bestOption: "无" };
    }
    if (!data.defenseAnalysis) {
      data.defenseAnalysis = { riskLevel: "未知", isDefenseMode: false, defenseReason: "", tilesSafety: [], dianpaoWarning: "" };
    }
    if (!data.gamePhase) data.gamePhase = "未知";
    if (!data.strategyMode) data.strategyMode = "未知";
    if (!data.tileEfficiency) data.tileEfficiency = [];
    if (!data.kanLockAnalysis) data.kanLockAnalysis = "";
    if (!data.combinationPlans) data.combinationPlans = [];
    if (!data.discardPriority) data.discardPriority = [];
    if (!data.forwardPlan) data.forwardPlan = "";

    setResult(data);
    setIsAnalyzing(false);
    setIsReanalyzing(false);
    isAnalyzingRef.current = false;
    setAnalysisCount((c) => c + 1);
    setLastAnalysisTime(new Date().toLocaleTimeString("zh-CN"));
    setError(null);

    // Voice announce
    if (voiceEnabled && data.aiSuggestion && data.aiSuggestion !== lastSpokenRef.current) {
      lastSpokenRef.current = data.aiSuggestion;
      let voiceText = data.aiSuggestion;
      if (data.defenseAnalysis?.dianpaoWarning) {
        voiceText = "警告！" + data.defenseAnalysis.dianpaoWarning + "。" + voiceText;
      }
      speakText(voiceText);
    }
  };

  const handleAnalysisError = (err: any) => {
    setIsAnalyzing(false);
    setIsReanalyzing(false);
    isAnalyzingRef.current = false;
    setError(err.message || "分析失败");
  };

  const quickAnalyzeMutation = trpc.analysis.quickAnalyze.useMutation({
    onSuccess: handleAnalysisSuccess,
    onError: handleAnalysisError,
  });

  const analyzeMutation = trpc.analysis.analyze.useMutation({
    onSuccess: handleAnalysisSuccess,
    onError: handleAnalysisError,
  });

  const reanalyzeMutation = trpc.analysis.reanalyze.useMutation({
    onSuccess: handleAnalysisSuccess,
    onError: handleAnalysisError,
  });

  // Handle tile correction
  const handleTilesChanged = useCallback((newTiles: string[]) => {
    if (!result) return;
    setIsReanalyzing(true);
    reanalyzeMutation.mutate({
      handTiles: newTiles,
      myExposedGroups: result.myExposedGroups?.map(g => ({ tiles: g.tiles, type: g.type })),
      opponentExposedGroups: result.opponentExposedGroups?.map(g => ({ tiles: g.tiles, type: g.type })),
      discardedTiles: result.discardedTiles,
      remainingTiles: result.remainingTiles,
      myCurrentHuxi: 0, // hand huxi will be recalculated by engine
      opponentCurrentHuxi: result.opponentEstimatedHuxi,
    });
  }, [result, reanalyzeMutation]);

  // ===== Screen Sharing =====
  const isInIframe = window.self !== window.top;

  const startScreenShare = async () => {
    // 检测是否在iframe中（如Manus预览面板）
    if (isInIframe) {
      setError("投屏功能需要在新窗口中打开。请点击右上角的 ↗ 按钮在新标签页中打开本网站，然后再使用投屏功能。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsStreaming(true);
      stream.getVideoTracks()[0].addEventListener("ended", () => stopScreenShare());
    } catch (err: any) {
      console.error("Screen share failed:", err);
      if (err?.message?.includes("permission") || err?.message?.includes("disallowed")) {
        setError("浏览器禁止了屏幕共享权限。请尝试：1) 点击右上角 ↗ 在新窗口打开本网站；2) 或检查浏览器地址栏左侧的权限设置。");
      } else if (err?.name === "NotAllowedError") {
        setError("您取消了屏幕共享。请重新点击“开始投屏”并选择要共享的窗口。");
      } else {
        setError("无法启动屏幕共享：" + (err?.message || "未知错误") + "。请尝试在新窗口中打开本网站。");
      }
    }
  };

  const stopScreenShare = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
    stopAutoAnalysis();
  };

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    
    // 检测空白/纯黑帧（傲软投屏等硬件加速窗口可能被捕获为黑色）
    try {
      const sampleData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100)).data;
      let nonBlackPixels = 0;
      for (let i = 0; i < sampleData.length; i += 16) { // 每4个像素采样一次
        if (sampleData[i] > 10 || sampleData[i + 1] > 10 || sampleData[i + 2] > 10) {
          nonBlackPixels++;
        }
      }
      const totalSampled = Math.floor(sampleData.length / 16);
      if (nonBlackPixels < totalSampled * 0.05) {
        // 超过95%的像素是黑色，可能是空白帧
        setBlankFrameWarning(true);
        return null;
      } else {
        setBlankFrameWarning(false);
      }
    } catch (e) {
      // 忽略采样错误
    }
    
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const getSimpleHash = useCallback((imageData: string): string => {
    let hash = 0;
    const step = Math.max(1, Math.floor(imageData.length / 200));
    for (let i = 0; i < imageData.length; i += step) {
      hash = ((hash << 5) - hash + imageData.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }, []);

  const startAutoAnalysis = () => {
    if (!isStreaming) return;
    setIsAutoAnalyzing(true);
    triggerAnalysis();
    intervalRef.current = setInterval(() => triggerAnalysis(), captureInterval * 1000);
  };

  const stopAutoAnalysis = () => {
    setIsAutoAnalyzing(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const triggerAnalysis = useCallback(() => {
    if (isAnalyzingRef.current) return;
    const frame = captureFrame();
    if (!frame) return;
    const hash = getSimpleHash(frame);
    if (hash === lastImageHashRef.current) return;
    lastImageHashRef.current = hash;
    setLivePreview(frame);
    setIsAnalyzing(true);
    isAnalyzingRef.current = true;
    quickAnalyzeMutation.mutate({ imageBase64: frame, expectedTileCount });
  }, [captureFrame, getSimpleHash, quickAnalyzeMutation]);

  useEffect(() => {
    return () => stopScreenShare();
  }, []);

  // Clipboard paste listener (always active in clipboard mode)
  useEffect(() => {
    if (!clipboardMode) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            if (!base64) return;
            const hash = getSimpleHash(base64);
            lastClipboardHashRef.current = hash;
            setLivePreview(base64);
            if (!isAnalyzingRef.current) {
              setIsAnalyzing(true);
              isAnalyzingRef.current = true;
              quickAnalyzeMutation.mutate({ imageBase64: base64, expectedTileCount });
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [clipboardMode, quickAnalyzeMutation, getSimpleHash]);

  // Auto clipboard polling - reads clipboard every 1s to detect new screenshots
  const readClipboardImage = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        return new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string || null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // Permission denied or no image in clipboard
    }
    return null;
  }, []);

  const startClipboardPolling = useCallback(async () => {
    // First, try to read clipboard to request permission
    try {
      await navigator.clipboard.read();
      setClipboardPermission('granted');
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setClipboardPermission('denied');
        // Fall back to paste-only mode
        setClipboardListening(true);
        return;
      }
    }
    setClipboardAutoPolling(true);
    // Poll every 1 second
    clipboardPollRef.current = setInterval(async () => {
      if (isAnalyzingRef.current) return;
      const base64 = await readClipboardImage();
      if (!base64) return;
      const hash = getSimpleHash(base64);
      if (hash === lastClipboardHashRef.current) return;
      lastClipboardHashRef.current = hash;
      setLivePreview(base64);
      setIsAnalyzing(true);
      isAnalyzingRef.current = true;
      quickAnalyzeMutation.mutate({ imageBase64: base64, expectedTileCount });
    }, 1000);
  }, [readClipboardImage, getSimpleHash, quickAnalyzeMutation]);

  const stopClipboardPolling = useCallback(() => {
    setClipboardAutoPolling(false);
    if (clipboardPollRef.current) {
      clearInterval(clipboardPollRef.current);
      clipboardPollRef.current = null;
    }
  }, []);

  // ===== Screen Capture Helper Mode (Python script) =====
  const startHelperPolling = useCallback(() => {
    setHelperPolling(true);
    setHelperConnected(false);
    // Poll /api/screen/latest every 800ms
    helperPollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/screen/latest?since=${lastHelperHashRef.current}`);
        const data = await resp.json();
        if (data.status === 'ok' && data.image) {
          setHelperConnected(true);
          lastHelperHashRef.current = data.hash;
          setLivePreview(data.image);
          // Auto-analyze if not already analyzing
          if (!isAnalyzingRef.current) {
            isAnalyzingRef.current = true;
            setIsAnalyzing(true);
            try {
              const result = await quickAnalyzeMutation.mutateAsync({ imageBase64: data.image, expectedTileCount });
              handleAnalysisSuccess(result);
              setAnalysisCount(c => c + 1);
              setLastAnalysisTime(new Date().toLocaleTimeString());
            } catch (err: any) {
              console.error('Helper auto-analysis error:', err);
            } finally {
              setIsAnalyzing(false);
              isAnalyzingRef.current = false;
            }
          }
        } else if (data.status === 'no_frame') {
          setHelperConnected(false);
        } else if (data.active) {
          setHelperConnected(true);
        }
      } catch {
        // server not reachable
      }
    }, 800);
  }, [quickAnalyzeMutation]);

  const stopHelperPolling = useCallback(() => {
    setHelperPolling(false);
    setHelperConnected(false);
    if (helperPollRef.current) {
      clearInterval(helperPollRef.current);
      helperPollRef.current = null;
    }
    lastHelperHashRef.current = '';
    // Notify server to stop
    fetch('/api/screen/stop', { method: 'POST' }).catch(() => {});
  }, []);

  // Cleanup all polling on unmount
  useEffect(() => {
    return () => {
      if (clipboardPollRef.current) {
        clearInterval(clipboardPollRef.current);
      }
      if (helperPollRef.current) {
        clearInterval(helperPollRef.current);
      }
    };
  }, []);

  // Upload handlers
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleManualAnalyze = () => {
    const img = mode === "upload" ? imagePreview : livePreview || captureFrame();
    if (!img) return;
    if (mode === "live" && !livePreview) setLivePreview(img);
    setIsAnalyzing(true);
    isAnalyzingRef.current = true;
    if (mode === "live") {
      quickAnalyzeMutation.mutate({ imageBase64: img, expectedTileCount });
    } else {
      analyzeMutation.mutate({ imageBase64: img, expectedTileCount });
    }
  };

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setResult(null);
    setError(null);
  };

  // === Render helpers ===
  const renderTile = (tile: string, index: number, highlight?: boolean) => (
    <span
      key={index}
      className={`px-2 py-1 rounded text-sm font-bold border inline-block ${highlight ? "ring-2 ring-offset-1" : ""}`}
      style={{
        borderColor: isGhost(tile) ? "oklch(0.65 0.15 350)" : isBigTile(tile) ? "oklch(0.7 0.1 240)" : "oklch(0.8 0.05 195)",
        background: isGhost(tile) ? "oklch(0.85 0.1 350 / 30%)" : isBigTile(tile) ? "oklch(0.92 0.02 240)" : "white",
        color: isRedTile(tile) ? "oklch(0.5 0.2 25)" : isGhost(tile) ? "oklch(0.45 0.2 350)" : "inherit",
        ...(highlight ? { ringColor: "oklch(0.75 0.15 195)" } : {}),
      }}
    >
      {tile}
    </span>
  );

  const renderTileGroup = (group: TileGroup, index: number, label?: string) => (
    <div key={index} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "oklch(0.97 0.005 240)" }}>
      <div className="flex gap-1">
        {group.tiles.map((tile, j) => renderTile(tile, j))}
      </div>
      <span className="text-xs text-muted-foreground">{group.type}</span>
      {label && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "oklch(0.94 0.02 240)", color: "oklch(0.5 0.05 240)" }}>{label}</span>}
      <span
        className="text-xs font-bold ml-auto"
        style={{ color: group.huxi > 0 ? "oklch(0.55 0.2 145)" : "oklch(0.6 0 0)" }}
      >
        {group.huxi > 0 ? `+${group.huxi}胡` : "0胡"}
      </span>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Brain className="h-7 w-7" style={{ color: "oklch(0.75 0.15 195)" }} />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">AI 牌局分析</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setVoiceEnabled(!voiceEnabled)} className="gap-2">
            {voiceEnabled ? (
              <Volume2 className="h-4 w-4" style={{ color: "oklch(0.75 0.15 195)" }} />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs">{voiceEnabled ? "语音开" : "语音关"}</span>
          </Button>
        </div>
        <p className="mono-label">REAL-TIME ANALYSIS ENGINE // V10.0 — 手牌修正+回溯搜索引擎 · 提/坎锁定 · 穷举所有拆法→最优打法</p>
      </div>

      {/* Mode Switcher + Dealer Toggle */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <button
          onClick={() => { setMode("live"); handleReset(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === "live" ? "text-white shadow-lg" : "wireframe-card"}`}
          style={mode === "live" ? { background: "oklch(0.45 0.15 240)" } : {}}
        >
          <MonitorPlay className="h-4 w-4" />
          实时投屏分析
        </button>
        <button
          onClick={() => { setMode("upload"); stopScreenShare(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === "upload" ? "text-white shadow-lg" : "wireframe-card"}`}
          style={mode === "upload" ? { background: "oklch(0.45 0.15 240)" } : {}}
        >
          <Upload className="h-4 w-4" />
          截图上传
        </button>

        {/* Dealer/Non-dealer toggle */}
        <div className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg" style={{ background: "oklch(0.95 0.02 200)", border: "1px solid oklch(0.85 0.05 200)" }}>
          <button
            onClick={() => setIsDealer(false)}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              !isDealer ? "text-white shadow" : "opacity-50"
            }`}
            style={!isDealer ? { background: "oklch(0.55 0.15 195)" } : {}}
          >
            闲家20张
          </button>
          <button
            onClick={() => setIsDealer(true)}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              isDealer ? "text-white shadow" : "opacity-50"
            }`}
            style={isDealer ? { background: "oklch(0.5 0.15 25)" } : {}}
          >
            庄家21张
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Input Area (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          {mode === "live" ? (
            <>
              {/* Sub-mode switcher: clipboard / capture helper / screen share */}
              <div className="flex gap-2 mb-3 flex-wrap">
                <button
                  onClick={() => { setLiveSubMode('clipboard'); setClipboardMode(true); stopScreenShare(); stopHelperPolling(); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${liveSubMode === 'clipboard' ? "text-white" : "wireframe-card"}`}
                  style={liveSubMode === 'clipboard' ? { background: "oklch(0.45 0.15 195)" } : {}}
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  快捷截图
                </button>
                <button
                  onClick={() => { setLiveSubMode('captureHelper'); setClipboardMode(false); stopScreenShare(); stopClipboardPolling(); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${liveSubMode === 'captureHelper' ? "text-white" : "wireframe-card"}`}
                  style={liveSubMode === 'captureHelper' ? { background: "oklch(0.45 0.15 145)" } : {}}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  截屏助手（推荐）
                </button>
                <button
                  onClick={() => { setLiveSubMode('screenShare'); setClipboardMode(false); stopClipboardPolling(); stopHelperPolling(); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${liveSubMode === 'screenShare' ? "text-white" : "wireframe-card"}`}
                  style={liveSubMode === 'screenShare' ? { background: "oklch(0.45 0.15 240)" } : {}}
                >
                  <MonitorPlay className="h-3.5 w-3.5" />
                  屏幕共享
                </button>
              </div>

              {liveSubMode === 'clipboard' ? (
                /* ===== Clipboard Auto-Monitor Mode ===== */
                <>
                  <div className="wireframe-card rounded-xl p-4 glow-cyan">
                    <div className="flex items-center justify-between mb-3">
                      <div className="mono-label flex items-center gap-2">
                        {clipboardAutoPolling && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "oklch(0.65 0.2 145)" }} />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "oklch(0.55 0.2 145)" }} />
                          </span>
                        )}
                        [ LIVE ] 实时截图监控
                      </div>
                      {clipboardAutoPolling && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.5 0.15 145)" }}>
                          <Radio className="h-3.5 w-3.5 animate-pulse" />
                          自动监控中·每1s
                        </div>
                      )}
                    </div>

                    <div className="relative rounded-lg overflow-hidden border bg-black/5 min-h-[200px]" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                      {livePreview ? (
                        <img src={livePreview} alt="截图" className="w-full h-auto max-h-[350px] object-contain" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                          <Scissors className="h-12 w-12 mb-3" style={{ color: "oklch(0.75 0.15 195 / 40%)" }} />
                          <p className="text-sm font-medium mb-2">实时截图监控</p>
                          <p className="text-xs text-muted-foreground text-center max-w-sm">点击下方按钮开始，截图后 AI 自动检测并分析</p>
                        </div>
                      )}
                      {clipboardAutoPolling && !livePreview && (
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "oklch(0.45 0.15 145 / 85%)" }}>
                          <Eye className="h-3 w-3" />
                          等待截图...
                        </div>
                      )}
                      {isAnalyzing && (
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "oklch(0.45 0.15 240 / 85%)" }}>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          AI 分析中
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Auto-Monitor Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!clipboardAutoPolling ? (
                      <Button onClick={startClipboardPolling} className="flex-1 h-11 text-sm font-semibold gap-2" style={{ background: "oklch(0.45 0.15 145)" }}>
                        <Play className="h-4 w-4" />
                        开始实时监控
                      </Button>
                    ) : (
                      <Button onClick={stopClipboardPolling} variant="outline" className="flex-1 h-11 text-sm font-semibold gap-2">
                        <Pause className="h-4 w-4" />
                        停止监控
                      </Button>
                    )}
                    <Button onClick={handleManualAnalyze} disabled={!livePreview || isAnalyzing} variant="outline" className="h-11 gap-1.5">
                      <Zap className="h-4 w-4" />
                      重新分析
                    </Button>
                  </div>

                  {/* Permission denied fallback notice */}
                  {clipboardPermission === 'denied' && (
                    <div className="wireframe-card rounded-xl p-3" style={{ background: "oklch(0.97 0.03 55)", borderColor: "oklch(0.85 0.08 55)" }}>
                      <div className="flex items-start gap-2 text-xs" style={{ color: "oklch(0.4 0.1 55)" }}>
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>浏览器拒绝了剪贴板自动读取权限</strong>。请使用手动方式：截图后按 <kbd className="px-1 py-0.5 rounded font-mono border" style={{ background: "oklch(0.95 0.01 240)", borderColor: "oklch(0.85 0.03 240)" }}>Ctrl+V</kbd> 粘贴到此页面，AI 会自动分析。
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Usage Guide */}
                  <div className="wireframe-card rounded-xl p-3">
                    <div className="mono-label mb-2">[ GUIDE ] 使用方法</div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "oklch(0.55 0.15 195)" }}>1</span>
                        <span>点击「<strong>开始实时监控</strong>」，允许浏览器读取剪贴板</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "oklch(0.55 0.15 195)" }}>2</span>
                        <span>用 <strong>Win+Shift+S</strong> 或 <strong>QQ截图</strong> 截取游戏画面（截图自动进入剪贴板）</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "oklch(0.55 0.15 195)" }}>3</span>
                        <span>AI 每秒自动检测剪贴板新截图并分析，<strong>无需切换窗口</strong></span>
                      </div>
                    </div>
                    <div className="mt-2 px-2 py-1.5 rounded text-xs" style={{ background: "oklch(0.95 0.02 195)", color: "oklch(0.4 0.1 195)" }}>
                      💡 如果浏览器拒绝权限，也可以截图后按 Ctrl+V 手动粘贴
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span>已分析 <strong className="text-foreground">{analysisCount}</strong> 次</span>
                      {lastAnalysisTime && <span>上次: {lastAnalysisTime}</span>}
                    </div>
                  </div>
                </>
              ) : liveSubMode === 'captureHelper' ? (
                /* ===== Screen Capture Helper Mode (Python script) ===== */
                <>
                  <div className="wireframe-card rounded-xl p-4 glow-cyan">
                    <div className="flex items-center justify-between mb-3">
                      <div className="mono-label flex items-center gap-2">
                        {helperConnected && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "oklch(0.65 0.2 145)" }} />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "oklch(0.55 0.2 145)" }} />
                          </span>
                        )}
                        [ LIVE ] 截屏助手
                      </div>
                      {helperConnected && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.5 0.15 145)" }}>
                          <Wifi className="h-3.5 w-3.5" />
                          已连接
                        </div>
                      )}
                    </div>

                    <div className="relative rounded-lg overflow-hidden border bg-black/5 min-h-[200px]" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                      {livePreview ? (
                        <img src={livePreview} alt="截图" className="w-full h-auto max-h-[350px] object-contain" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                          <Terminal className="h-12 w-12 mb-3" style={{ color: "oklch(0.75 0.15 145 / 40%)" }} />
                          <p className="text-sm font-medium mb-2">截屏助手模式</p>
                          <p className="text-xs text-muted-foreground text-center max-w-sm">运行 Python 脚本自动截取傲软投屏画面，实时上传分析</p>
                        </div>
                      )}
                      {helperPolling && !helperConnected && (
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "oklch(0.5 0.15 55 / 85%)" }}>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          等待截屏助手连接...
                        </div>
                      )}
                      {isAnalyzing && (
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "oklch(0.45 0.15 240 / 85%)" }}>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          AI 分析中
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Helper Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!helperPolling ? (
                      <Button onClick={startHelperPolling} className="flex-1 h-11 text-sm font-semibold gap-2" style={{ background: "oklch(0.45 0.15 145)" }}>
                        <Play className="h-4 w-4" />
                        开始实时监控
                      </Button>
                    ) : (
                      <Button onClick={stopHelperPolling} variant="outline" className="flex-1 h-11 text-sm font-semibold gap-2">
                        <Pause className="h-4 w-4" />
                        停止监控
                      </Button>
                    )}
                    <Button onClick={handleManualAnalyze} disabled={!livePreview || isAnalyzing} variant="outline" className="h-11 gap-1.5">
                      <Zap className="h-4 w-4" />
                      重新分析
                    </Button>
                  </div>

                  {/* Setup Guide */}
                  <div className="wireframe-card rounded-xl p-3">
                    <div className="mono-label mb-2">[ SETUP ] 安装指南</div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "oklch(0.55 0.15 145)" }}>1</span>
                        <span>确保电脑已安装 <strong>Python 3</strong>，然后运行：<br/><code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "oklch(0.15 0.01 240)", color: "oklch(0.85 0.1 145)" }}>pip install pillow requests mss</code></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "oklch(0.55 0.15 145)" }}>2</span>
                        <span>下载截屏脚本：<a href="/screen-capture.py" download className="underline font-semibold" style={{ color: "oklch(0.5 0.15 195)" }}>点击下载 screen-capture.py</a></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "oklch(0.55 0.15 145)" }}>3</span>
                        <span>运行脚本：<br/><code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "oklch(0.15 0.01 240)", color: "oklch(0.85 0.1 145)" }}>python screen-capture.py --server {typeof window !== 'undefined' ? window.location.origin : ''}</code></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "oklch(0.55 0.15 145)" }}>4</span>
                        <span>点击上方「<strong>开始实时监控</strong>」，网站将自动接收截图并分析</span>
                      </div>
                    </div>
                    <div className="mt-2 px-2 py-1.5 rounded text-xs" style={{ background: "oklch(0.95 0.02 145)", color: "oklch(0.35 0.1 145)" }}>
                      ✅ 截屏助手可以捕获任何窗口（包括傲软投屏），完美解决浏览器屏幕共享的限制
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span>已分析 <strong className="text-foreground">{analysisCount}</strong> 次</span>
                      {lastAnalysisTime && <span>上次: {lastAnalysisTime}</span>}
                    </div>
                  </div>
                </>
              ) : (
                /* ===== Screen Share Mode ===== */
                <>
                  <div className="wireframe-card rounded-xl p-4 glow-cyan">
                    <div className="flex items-center justify-between mb-3">
                      <div className="mono-label flex items-center gap-2">
                        {isStreaming && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "oklch(0.65 0.2 145)" }} />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "oklch(0.55 0.2 145)" }} />
                          </span>
                        )}
                        [ LIVE ] 屏幕共享
                      </div>
                      {isStreaming && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Timer className="h-3.5 w-3.5" />
                          每 {captureInterval}s
                        </div>
                      )}
                    </div>

                    <div className="relative rounded-lg overflow-hidden border bg-black/5 min-h-[200px]" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                      <video ref={videoRef} className="w-full h-auto max-h-[350px] object-contain" muted playsInline style={{ display: isStreaming ? "block" : "none" }} />
                      <canvas ref={canvasRef} className="hidden" />
                      {!isStreaming && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                          <MonitorPlay className="h-12 w-12 mb-3" style={{ color: "oklch(0.75 0.15 195 / 40%)" }} />
                          <p className="text-sm font-medium mb-1">点击下方按钮开始投屏</p>
                          <p className="text-xs text-muted-foreground text-center max-w-sm">请选择「<strong>整个屏幕</strong>」共享</p>
                          {isInIframe && (
                            <div className="mt-3 px-3 py-2 rounded-lg text-xs text-center" style={{ background: "oklch(0.95 0.04 55)", border: "1px solid oklch(0.85 0.08 55)", color: "oklch(0.4 0.1 55)" }}>
                              投屏功能需要在新窗口中打开。请点击右上角 <strong>↗</strong> 按钮。
                            </div>
                          )}
                          <div className="mt-3 px-3 py-2 rounded-lg text-xs text-center" style={{ background: "oklch(0.92 0.04 55)", border: "1px solid oklch(0.82 0.08 55)", color: "oklch(0.4 0.1 55)" }}>
                            如果傲软投屏画面显示黑色，请切换到「<strong>快捷截图</strong>」模式
                          </div>
                        </div>
                      )}
                      {isStreaming && isAutoAnalyzing && (
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "oklch(0.45 0.15 145 / 85%)" }}>
                          <Radio className="h-3 w-3 animate-pulse" />
                          自动分析中
                        </div>
                      )}
                      {isAnalyzing && (
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "oklch(0.45 0.15 240 / 85%)" }}>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          AI 分析中
                        </div>
                      )}
                      {blankFrameWarning && isStreaming && (
                        <div className="absolute bottom-2 left-2 right-2 flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "oklch(0.95 0.06 55 / 95%)", border: "1px solid oklch(0.8 0.12 55)", color: "oklch(0.35 0.12 55)" }}>
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>画面为空白/黑色！</strong>请切换到「<strong>快捷截图</strong>」模式。傲软投屏等应用使用硬件加速，无法被屏幕共享捕获。
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!isStreaming ? (
                      <Button onClick={startScreenShare} className="flex-1 h-11 text-sm font-semibold gap-2" style={{ background: "oklch(0.45 0.15 240)" }}>
                        <MonitorPlay className="h-4 w-4" />
                        开始投屏
                      </Button>
                    ) : (
                      <>
                        {!isAutoAnalyzing ? (
                          <Button onClick={startAutoAnalysis} className="flex-1 h-11 text-sm font-semibold gap-2" style={{ background: "oklch(0.45 0.15 145)" }}>
                            <Play className="h-4 w-4" />
                            开始自动分析
                          </Button>
                        ) : (
                          <Button onClick={stopAutoAnalysis} variant="outline" className="flex-1 h-11 text-sm font-semibold gap-2">
                            <Pause className="h-4 w-4" />
                            暂停
                          </Button>
                        )}
                        <Button onClick={handleManualAnalyze} disabled={isAnalyzing} variant="outline" className="h-11 gap-1.5">
                          <Zap className="h-4 w-4" />
                          手动
                        </Button>
                        <Button onClick={stopScreenShare} variant="outline" className="h-11 gap-1.5 text-red-500 hover:text-red-600">
                          <Square className="h-4 w-4" />
                          停止
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Interval Control */}
                  {isStreaming && (
                    <div className="wireframe-card rounded-xl p-3">
                      <div className="mono-label mb-2">[ CONFIG ] 分析频率</div>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 5].map((sec) => (
                          <button
                            key={sec}
                            onClick={() => {
                              setCaptureInterval(sec);
                              if (isAutoAnalyzing) {
                                stopAutoAnalysis();
                                setTimeout(() => {
                                  setIsAutoAnalyzing(true);
                                  intervalRef.current = setInterval(() => triggerAnalysis(), sec * 1000);
                                }, 100);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${captureInterval === sec ? "text-white" : "wireframe-card"}`}
                            style={captureInterval === sec ? { background: "oklch(0.45 0.15 240)" } : {}}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>已分析 <strong className="text-foreground">{analysisCount}</strong> 次</span>
                        {lastAnalysisTime && <span>上次: {lastAnalysisTime}</span>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Upload Mode */}
              <div
                className={`wireframe-card rounded-xl p-5 transition-all ${isDragging ? "border-2 border-dashed" : ""}`}
                style={isDragging ? { borderColor: "oklch(0.75 0.15 195)" } : {}}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
              >
                <div className="mono-label mb-3">[ INPUT ] 上传游戏截图</div>
                {!imagePreview ? (
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    style={{ borderColor: "oklch(0.85 0.05 195)" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-10 w-10 mx-auto mb-3" style={{ color: "oklch(0.7 0.1 195)" }} />
                    <p className="text-sm font-medium mb-1">拖拽截图到此处，或点击上传</p>
                    <p className="text-xs text-muted-foreground">支持 PNG、JPG、WEBP</p>
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                    <img src={imagePreview} alt="截图" className="w-full h-auto max-h-[350px] object-contain bg-black/5" />
                    <div className="absolute top-2 right-2">
                      <Button variant="outline" size="sm" onClick={handleReset} className="bg-white/90 backdrop-blur text-xs">重新上传</Button>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} />
              </div>
              <Button onClick={handleManualAnalyze} disabled={!imagePreview || isAnalyzing} className="w-full h-11 text-sm font-semibold" style={{ background: "oklch(0.45 0.15 240)" }}>
                {isAnalyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI 分析中...</> : <><Sparkles className="h-4 w-4 mr-2" />开始 AI 分析</>}
              </Button>
            </>
          )}

          {/* Tips */}
          <div className="wireframe-card-pink rounded-xl p-3">
            <div className="mono-label mb-2" style={{ color: "oklch(0.6 0.1 350)" }}>[ TIPS ]</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {mode === "live" ? (
                <>
                  <li className="flex items-start gap-1.5"><Scissors className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "oklch(0.75 0.15 350)" }} /><span>推荐「快捷截图」模式：截图后 Ctrl+V 粘贴，兼容傲软投屏</span></li>
                  <li className="flex items-start gap-1.5"><Shield className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "oklch(0.75 0.15 350)" }} /><span>AI 会自动评估点炮风险，优先推荐安全牌</span></li>
                  <li className="flex items-start gap-1.5"><Ghost className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "oklch(0.75 0.15 350)" }} /><span>鬼牌（飞飞）会列出所有替代方案</span></li>
                  <li className="flex items-start gap-1.5"><Sparkles className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "oklch(0.75 0.15 350)" }} /><span>AI识别有误？点击"修正识别"按钮手动修改，瞬间重新计算</span></li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-1.5"><Camera className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "oklch(0.75 0.15 350)" }} /><span>截取完整游戏界面，确保手牌清晰</span></li>
                  <li className="flex items-start gap-1.5"><ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "oklch(0.75 0.15 350)" }} /><span>点炮=4倍惩罚！AI 会标注每张牌的安全等级</span></li>
                  <li className="flex items-start gap-1.5"><Sparkles className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "oklch(0.75 0.15 350)" }} /><span>AI识别有误？点击"修正识别"按钮手动修改</span></li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Right: Analysis Result (3 cols on lg) */}
        <div className="lg:col-span-3 space-y-4">
          {isAnalyzing && !result && (
            <div className="wireframe-card rounded-xl p-8 text-center">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" style={{ color: "oklch(0.75 0.15 195)" }} />
              <p className="font-semibold mb-1">AI 正在分析牌局...</p>
              <p className="text-xs text-muted-foreground">识别区域 → 计算胡息 → 安全评估 → 推演策略</p>
            </div>
          )}

          {error && (
            <div className="wireframe-card-pink rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4" style={{ color: "oklch(0.65 0.2 30)" }} />
                <span className="font-semibold text-sm">分析出错</span>
              </div>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* ===== 0. 手牌识别+修正 (TileEditor) ===== */}
              {/* 手牌数量不足警告 */}
              {result.handTiles && result.handTiles.length > 0 && result.handTiles.length !== expectedTileCount && (
                <div
                  className="rounded-xl p-4 border-2 flex items-start gap-3"
                  style={{
                    borderColor: "oklch(0.65 0.2 25)",
                    background: "oklch(0.95 0.04 25)",
                  }}
                >
                  <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "oklch(0.5 0.2 25)" }} />
                  <div>
                    <div className="font-bold text-sm mb-1" style={{ color: "oklch(0.4 0.15 25)" }}>
                      手牌数量不匹配：AI识别出{result.handTiles.length}张，应为{expectedTileCount}张
                    </div>
                    <div className="text-xs" style={{ color: "oklch(0.45 0.1 25)" }}>
                      当前选择为{isDealer ? '庄家' : '闲家'}，应有{expectedTileCount}张手牌，但AI识别出{result.handTiles.length}张。建议：
                      <br />
                      1. 点击“修正识别”手动{result.handTiles.length < expectedTileCount ? '添加漏识的牌' : '删除多识的牌'}
                      <br />
                      2. 或检查庄家/闲家选择是否正确（左上角切换）
                      <br />
                      3. 或重新截图（确保手牌区域清晰可见）后再次分析
                    </div>
                  </div>
                </div>
              )}
              <TileEditor
                tiles={result.handTiles}
                onTilesChanged={handleTilesChanged}
                isReanalyzing={isReanalyzing}
                recommendedTile={result.recommendedTile}
              />

              {/* ===== 1. 点炮防御警告（最醒目） ===== */}
              {result.defenseAnalysis && result.defenseAnalysis.riskLevel !== "未知" && (
                <div
                  className="rounded-xl p-4 border-2"
                  style={{
                    borderColor: result.defenseAnalysis.isDefenseMode ? "oklch(0.65 0.2 25)" : "oklch(0.7 0.1 145)",
                    background: result.defenseAnalysis.isDefenseMode ? "oklch(0.97 0.02 25)" : "oklch(0.97 0.01 145)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {result.defenseAnalysis.isDefenseMode ? (
                        <ShieldAlert className="h-5 w-5" style={{ color: "oklch(0.55 0.2 25)" }} />
                      ) : (
                        <Shield className="h-5 w-5" style={{ color: "oklch(0.5 0.15 145)" }} />
                      )}
                      <span className="font-bold text-sm">
                        {result.defenseAnalysis.isDefenseMode ? "防御模式" : "安全评估"}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          background: (riskBadgeStyles[result.defenseAnalysis.riskLevel] || riskBadgeStyles["低风险"]).bg,
                          color: (riskBadgeStyles[result.defenseAnalysis.riskLevel] || riskBadgeStyles["低风险"]).text,
                        }}
                      >
                        {result.defenseAnalysis.riskLevel}
                      </span>
                    </div>
                    <button onClick={() => setShowDefenseDetails(!showDefenseDetails)} className="text-muted-foreground hover:text-foreground">
                      {showDefenseDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Dianpao Warning */}
                  {result.defenseAnalysis.dianpaoWarning && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg mb-3" style={{ background: "oklch(0.93 0.05 25 / 60%)" }}>
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "oklch(0.5 0.2 25)" }} />
                      <p className="text-xs font-medium" style={{ color: "oklch(0.35 0.15 25)" }}>{result.defenseAnalysis.dianpaoWarning}</p>
                    </div>
                  )}

                  {result.defenseAnalysis.defenseReason && (
                    <p className="text-xs text-muted-foreground mb-3">{result.defenseAnalysis.defenseReason}</p>
                  )}

                  {/* Tile Safety Grid */}
                  {showDefenseDetails && result.defenseAnalysis.tilesSafety && result.defenseAnalysis.tilesSafety.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground mb-1">出牌安全等级：</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {result.defenseAnalysis.tilesSafety.map((ts, i) => {
                          const colors = safetyColors[ts.safetyLevel] || safetyColors["有风险"];
                          return (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg border" style={{ background: colors.bg, borderColor: colors.border }}>
                              <span className="text-sm">{ts.safetyEmoji}</span>
                              <span className="font-bold text-sm" style={{ color: colors.text }}>{ts.tile}</span>
                              <span className="text-xs" style={{ color: colors.text }}>{ts.safetyLevel}</span>
                              <span className="text-xs text-muted-foreground ml-auto truncate max-w-[120px]" title={ts.reason}>{ts.reason}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground pt-2" style={{ borderTop: "1px dashed oklch(0.85 0.05 195)" }}>
                        <span>🟢 安全</span>
                        <span>🟡 较安全</span>
                        <span>🟠 有风险</span>
                        <span>🔴 危险</span>
                        <span className="ml-auto font-medium" style={{ color: "oklch(0.5 0.2 25)" }}>点炮=4倍惩罚</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== 2. 主推荐 ===== */}
              <div className="wireframe-card rounded-xl p-4 glow-cyan">
                <div className="flex items-center justify-between mb-3">
                  <div className="mono-label">[ OUTPUT ] AI 策略建议</div>
                  {(isAnalyzing || isReanalyzing) && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "oklch(0.75 0.15 195)" }} />}
                </div>

                {result.recommendedAction && (
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-lg" style={{ background: "oklch(0.94 0.02 195)" }}>
                    <div className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: "oklch(0.75 0.15 195)", color: "white" }}>
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">推荐操作</div>
                      <div className="font-black text-lg">
                        {result.recommendedAction}
                        {result.recommendedTile && (
                          <span className="ml-2 px-2 py-0.5 rounded text-sm font-bold" style={{ background: "oklch(0.75 0.15 195 / 20%)", color: "oklch(0.4 0.15 195)" }}>
                            {result.recommendedTile}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Game Phase & Strategy Mode */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2.5 rounded-lg border flex items-center gap-2" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                    <Timer className="h-4 w-4" style={{ color: "oklch(0.6 0.1 240)" }} />
                    <div>
                      <div className="text-xs text-muted-foreground">游戏阶段</div>
                      <div className="text-sm font-bold">{result.gamePhase || "未知"}</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border flex items-center gap-2" style={{
                    borderColor: result.strategyMode?.includes("防守") ? "oklch(0.7 0.15 25)" : result.strategyMode?.includes("快速") ? "oklch(0.7 0.15 145)" : "oklch(0.85 0.05 195)",
                    background: result.strategyMode?.includes("防守") ? "oklch(0.97 0.02 25)" : result.strategyMode?.includes("快速") ? "oklch(0.97 0.02 145)" : undefined,
                  }}>
                    {result.strategyMode?.includes("防守") ? <Shield className="h-4 w-4" style={{ color: "oklch(0.55 0.2 25)" }} /> : result.strategyMode?.includes("快速") ? <Zap className="h-4 w-4" style={{ color: "oklch(0.55 0.2 145)" }} /> : <Brain className="h-4 w-4" style={{ color: "oklch(0.6 0.1 240)" }} />}
                    <div>
                      <div className="text-xs text-muted-foreground">策略模式</div>
                      <div className="text-sm font-bold">{result.strategyMode || "未知"}</div>
                    </div>
                  </div>
                </div>

                {/* Huxi & Remaining & Opponent */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="p-2.5 rounded-lg border" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                    <div className="text-xs text-muted-foreground">我方胡息</div>
                    <div className="text-xl font-black" style={{ color: result.currentHuxi >= 10 ? "oklch(0.55 0.2 145)" : "oklch(0.5 0.15 240)" }}>
                      {result.currentHuxi}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">/10</span>
                    </div>
                    {result.kanHuxi ? (
                      <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.5 0.12 145)" }}>
                        含坎{result.kanHuxi}胡
                      </div>
                    ) : null}
                  </div>
                  <div className="p-2.5 rounded-lg border" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                    <div className="text-xs text-muted-foreground">对手估算</div>
                    <div className="text-xl font-black" style={{ color: result.opponentEstimatedHuxi >= 7 ? "oklch(0.55 0.2 25)" : "oklch(0.5 0.15 240)" }}>
                      {result.opponentEstimatedHuxi || "?"}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">胡</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                    <div className="text-xs text-muted-foreground">剩余底牌</div>
                    <div className="text-xl font-black" style={{ color: result.remainingTiles < 15 ? "oklch(0.55 0.2 25)" : "oklch(0.5 0.15 240)" }}>
                      {result.remainingTiles}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">张</span>
                    </div>
                  </div>
                </div>

                {/* Discard Priority */}
                {result.discardPriority && result.discardPriority.length > 0 && (
                  <div className="p-3 rounded-lg mb-3" style={{ background: "oklch(0.96 0.01 195)", border: "1px solid oklch(0.88 0.04 195)" }}>
                    <div className="text-xs font-medium text-muted-foreground mb-2">出牌优先级（从左到右优先打）：</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {result.discardPriority.map((tile, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className={`px-2 py-1 rounded text-sm font-bold border ${
                            i === 0 ? "border-2" : ""
                          }`} style={{
                            borderColor: i === 0 ? "oklch(0.65 0.2 145)" : "oklch(0.85 0.05 195)",
                            background: i === 0 ? "oklch(0.92 0.05 145)" : "white",
                            color: i === 0 ? "oklch(0.35 0.15 145)" : isRedTile(tile) ? "oklch(0.55 0.2 25)" : "oklch(0.3 0 0)",
                          }}>
                            {i === 0 && "★ "}{tile}
                          </span>
                          {i < result.discardPriority.length - 1 && <span className="text-xs text-muted-foreground">›</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forward Plan */}
                {result.forwardPlan && (
                  <div className="p-3 rounded-lg mb-3" style={{ background: "oklch(0.96 0.015 85)", border: "1px solid oklch(0.88 0.04 85)" }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lightbulb className="h-3.5 w-3.5" style={{ color: "oklch(0.6 0.15 85)" }} />
                      <span className="text-xs font-bold" style={{ color: "oklch(0.45 0.1 85)" }}>前瞻规划</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "oklch(0.4 0.08 85)" }}>{result.forwardPlan}</p>
                  </div>
                )}

                {result.aiSuggestion && (
                  <div className="text-sm leading-relaxed">
                    <Streamdown>{result.aiSuggestion}</Streamdown>
                  </div>
                )}
              </div>

              {/* ===== 3. 胡息计算明细 ===== */}
              {result.huxiBreakdown && (
                <div className="wireframe-card rounded-xl p-4">
                  <div className="mono-label mb-2">[ CALC ] 胡息计算明细</div>
                  <div className="text-sm leading-relaxed font-mono p-3 rounded-lg" style={{ background: "oklch(0.97 0.005 240)", border: "1px solid oklch(0.85 0.05 195)" }}>
                    <Streamdown>{result.huxiBreakdown}</Streamdown>
                  </div>
                  {result.potentialHuxi > result.currentHuxi && (
                    <div className="mt-2 text-xs flex items-center gap-1" style={{ color: "oklch(0.55 0.15 85)" }}>
                      <Zap className="h-3.5 w-3.5" />
                      潜在最大胡息：{result.potentialHuxi}胡
                    </div>
                  )}
                </div>
              )}

              {/* ===== 3.5 拆组方案比较 ===== */}
              {result.combinationPlans && result.combinationPlans.length > 0 && (
                <div className="wireframe-card rounded-xl p-4">
                  <div className="mono-label mb-3 flex items-center gap-2">
                    <Swords className="h-3.5 w-3.5" style={{ color: "oklch(0.6 0.15 280)" }} />
                    [ PLANS ] 拆组方案比较（{result.combinationPlans.length}种方案）
                  </div>
                  <div className="space-y-3">
                    {result.combinationPlans.map((plan, i) => (
                      <div key={i} className="p-3 rounded-lg border" style={{
                        background: plan.isOptimal ? "oklch(0.95 0.04 145 / 60%)" : "oklch(0.98 0.005 240)",
                        borderColor: plan.isOptimal ? "oklch(0.7 0.15 145)" : "oklch(0.88 0.03 195)",
                      }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {plan.isOptimal && <Sparkles className="h-3.5 w-3.5" style={{ color: "oklch(0.55 0.2 145)" }} />}
                            <span className="text-sm font-bold" style={{ color: plan.isOptimal ? "oklch(0.4 0.15 145)" : "oklch(0.35 0 0)" }}>
                              {plan.planName}{plan.isOptimal ? " ★ 最优" : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="font-mono px-2 py-0.5 rounded font-bold" style={{
                              background: (plan.stepsToTing ?? 99) <= 2 ? "oklch(0.88 0.1 145)" : (plan.stepsToTing ?? 99) <= 4 ? "oklch(0.92 0.06 55)" : "oklch(0.93 0.03 25)",
                              color: (plan.stepsToTing ?? 99) <= 2 ? "oklch(0.3 0.15 145)" : (plan.stepsToTing ?? 99) <= 4 ? "oklch(0.4 0.15 55)" : "oklch(0.45 0.1 25)",
                            }}>{plan.stepsToTing ?? "?"}步听胡</span>
                            <span className="font-mono px-2 py-0.5 rounded" style={{
                              background: plan.totalHuxi >= 10 ? "oklch(0.9 0.06 145)" : "oklch(0.93 0.04 55)",
                              color: plan.totalHuxi >= 10 ? "oklch(0.4 0.15 145)" : "oklch(0.45 0.15 55)",
                            }}>{plan.totalHuxi}胡</span>
                            <span className="text-muted-foreground">散{plan.remainingLoose}张</span>
                          </div>
                        </div>
                        {/* 散牌关联关系 */}
                        {plan.looseRelation && (
                          <div className="text-xs mb-2 px-2 py-1 rounded" style={{ background: "oklch(0.96 0.02 280 / 40%)", color: "oklch(0.45 0.08 280)" }}>
                            🔗 散牌关联：{plan.looseRelation}
                          </div>
                        )}
                        {/* 牌组展示 */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {plan.groups.map((g, j) => (
                            <span key={j} className="text-xs px-2 py-1 rounded font-mono" style={{
                              background: g.huxi > 0 ? "oklch(0.92 0.04 195)" : "oklch(0.96 0.005 240)",
                              border: `1px solid ${g.huxi > 0 ? "oklch(0.8 0.08 195)" : "oklch(0.9 0.02 240)"}`,
                              color: g.huxi > 0 ? "oklch(0.35 0.1 195)" : "oklch(0.5 0 0)",
                            }}>
                              {g.tiles.join("")}{g.huxi > 0 ? `(${g.huxi}胡)` : ""}
                            </span>
                          ))}
                        </div>
                        {/* 听牌宽度 */}
                        {plan.tingWidth && (
                          <div className="text-xs mb-1" style={{ color: "oklch(0.5 0.1 195)" }}>
                            <Eye className="h-3 w-3 inline mr-1" />听牌：{plan.tingWidth}
                          </div>
                        )}
                        {/* 原因 */}
                        <div className="text-xs" style={{ color: "oklch(0.5 0 0)" }}>{plan.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== 4. 牌效率分析 & 坎锁死 ===== */}
              {((result.tileEfficiency && result.tileEfficiency.length > 0) || result.kanLockAnalysis) && (
                <div className="wireframe-card rounded-xl p-4">
                  <div className="mono-label mb-2 flex items-center gap-2">
                    <Target className="h-3.5 w-3.5" style={{ color: "oklch(0.6 0.15 195)" }} />
                    [ EFFICIENCY ] 牌效率分析
                  </div>

                  {/* Kan Lock Analysis - Enhanced */}
                  {(result.lockedKan && result.lockedKan.length > 0) ? (
                    <div className="p-2.5 rounded-lg mb-3" style={{ background: "oklch(0.95 0.03 25 / 50%)", border: "1px solid oklch(0.85 0.05 25)" }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shield className="h-3.5 w-3.5" style={{ color: "oklch(0.55 0.15 145)" }} />
                        <span className="text-xs font-bold" style={{ color: "oklch(0.35 0.15 145)" }}>🔒 提/坎牌锁定（不可拆）</span>
                        <span className="text-xs font-mono ml-auto" style={{ color: "oklch(0.45 0.15 25)" }}>提/坎胡息: {result.kanHuxi || 0}胡</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.lockedKan.map((kan, i) => (
                          <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: "oklch(0.92 0.04 145 / 50%)", border: "1px solid oklch(0.8 0.08 145)" }}>
                            <span className="text-xs font-bold" style={{ color: "oklch(0.35 0.15 145)" }}>🔒</span>
                            {kan.tiles.map((t, j) => (
                              <span key={j} className="font-bold text-sm" style={{
                                color: isRedTile(t) ? "oklch(0.55 0.2 25)" : isBigTile(t) ? "oklch(0.4 0.15 240)" : "oklch(0.3 0 0)",
                              }}>{t}</span>
                            ))}
                            <span className="text-xs font-mono ml-1" style={{ color: "oklch(0.5 0.12 145)" }}>={kan.huxi}胡({kan.tiles.length === 4 ? "提" : "坎"})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : result.kanLockAnalysis ? (
                    <div className="p-2.5 rounded-lg mb-3" style={{ background: "oklch(0.95 0.03 25 / 50%)", border: "1px solid oklch(0.85 0.05 25)" }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" style={{ color: "oklch(0.55 0.2 25)" }} />
                        <span className="text-xs font-bold" style={{ color: "oklch(0.4 0.15 25)" }}>坎牌锁死效应</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "oklch(0.4 0.1 25)" }}>{result.kanLockAnalysis}</p>
                    </div>
                  ) : null}

                  {/* Tile Efficiency Grid */}
                  {result.tileEfficiency && result.tileEfficiency.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground mb-1">散牌进张数分析：</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {result.tileEfficiency.map((te, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg border" style={{
                            background: te.isWaste ? "oklch(0.95 0.03 25 / 40%)" : te.jinzhangCount >= 4 ? "oklch(0.95 0.03 145 / 40%)" : "oklch(0.98 0.005 240)",
                            borderColor: te.isWaste ? "oklch(0.8 0.08 25)" : te.jinzhangCount >= 4 ? "oklch(0.8 0.08 145)" : "oklch(0.88 0.03 195)",
                          }}>
                            <span className="font-bold text-sm min-w-[24px]" style={{
                              color: te.isWaste ? "oklch(0.5 0.2 25)" : isRedTile(te.tile) ? "oklch(0.55 0.2 25)" : isBigTile(te.tile) ? "oklch(0.4 0.15 240)" : "oklch(0.3 0 0)",
                            }}>{te.tile}</span>
                            <span className="text-xs font-mono" style={{
                              color: te.isWaste ? "oklch(0.5 0.15 25)" : te.jinzhangCount >= 4 ? "oklch(0.45 0.15 145)" : "oklch(0.5 0 0)",
                            }}>
                              {te.isWaste ? "✖ 废牌" : `✔ 进${te.jinzhangCount}张`}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto truncate max-w-[120px]" title={te.wasteReason}>{te.wasteReason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== 5. 鬼牌（飞飞）分析 ===== */}
              {result.ghostCardAnalysis && result.ghostCardAnalysis.hasGhost && (
                <div className="rounded-xl p-4 border-2" style={{ borderColor: "oklch(0.7 0.15 350 / 60%)", background: "oklch(0.98 0.01 350)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Ghost className="h-5 w-5" style={{ color: "oklch(0.55 0.15 350)" }} />
                      <span className="font-bold text-sm" style={{ color: "oklch(0.4 0.15 350)" }}>飞飞（鬼牌）分析</span>
                    </div>
                    <button onClick={() => setShowGhostDetails(!showGhostDetails)} className="text-muted-foreground hover:text-foreground">
                      {showGhostDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Best option highlight */}
                  {result.ghostCardAnalysis.bestOption && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg mb-3" style={{ background: "oklch(0.92 0.05 350 / 40%)" }}>
                      <Sparkles className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "oklch(0.5 0.15 350)" }} />
                      <div>
                        <div className="text-xs font-bold" style={{ color: "oklch(0.4 0.15 350)" }}>最优方案</div>
                        <p className="text-xs" style={{ color: "oklch(0.35 0.1 350)" }}>{result.ghostCardAnalysis.bestOption}</p>
                      </div>
                    </div>
                  )}

                  {/* All options table */}
                  {showGhostDetails && result.ghostCardAnalysis.allOptions && result.ghostCardAnalysis.allOptions.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground">所有替代方案：</div>
                      {result.ghostCardAnalysis.allOptions.map((opt, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 rounded-lg border"
                          style={{
                            borderColor: opt.isOptimal ? "oklch(0.65 0.15 350)" : "oklch(0.85 0.05 350)",
                            background: opt.isOptimal ? "oklch(0.93 0.04 350 / 50%)" : "oklch(0.98 0.005 350)",
                          }}
                        >
                          {opt.isOptimal && <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "oklch(0.5 0.15 350)" }} />}
                          <span className="text-xs">鬼→</span>
                          <span className="font-bold text-sm" style={{ color: "oklch(0.45 0.15 350)" }}>{opt.replaceTile}</span>
                          <span className="text-xs text-muted-foreground">形成 {opt.formedGroup}</span>
                          <span className="text-xs text-muted-foreground">({opt.groupType})</span>
                          <span
                            className="text-xs font-bold ml-auto"
                            style={{ color: opt.huxiGain > 0 ? "oklch(0.55 0.2 145)" : "oklch(0.6 0 0)" }}
                          >
                            {opt.huxiGain > 0 ? `+${opt.huxiGain}胡` : "0胡"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.ghostCardAnalysis.currentUsage && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      当前用法：{result.ghostCardAnalysis.currentUsage}
                    </div>
                  )}
                </div>
              )}

              {/* ===== 5.5 听牌分析 ===== */}
              {result.tingAnalysis && result.tingAnalysis.length > 0 && (
                <div className="rounded-xl p-4 border-2" style={{ borderColor: "oklch(0.65 0.2 145)", background: "oklch(0.97 0.02 145)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-5 w-5" style={{ color: "oklch(0.5 0.2 145)" }} />
                    <span className="font-bold text-sm" style={{ color: "oklch(0.35 0.15 145)" }}>听牌分析</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "oklch(0.88 0.1 145)", color: "oklch(0.3 0.15 145)" }}>
                      {result.tingAnalysis.length}种打法可听牌
                    </span>
                  </div>
                  <div className="space-y-3">
                    {result.tingAnalysis.slice(0, 5).map((ting, i) => (
                      <div key={i} className="p-3 rounded-lg border" style={{
                        background: i === 0 ? "oklch(0.93 0.05 145 / 60%)" : "oklch(0.98 0.005 145)",
                        borderColor: i === 0 ? "oklch(0.65 0.15 145)" : "oklch(0.85 0.05 145)",
                      }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Sparkles className="h-3.5 w-3.5" style={{ color: "oklch(0.5 0.2 145)" }} />}
                            <span className="text-sm font-bold" style={{ color: i === 0 ? "oklch(0.35 0.15 145)" : "oklch(0.35 0 0)" }}>
                              打 <span className="px-1.5 py-0.5 rounded" style={{
                                background: isRedTile(ting.discard) ? "oklch(0.93 0.05 25)" : isGhost(ting.discard) ? "oklch(0.85 0.1 350 / 30%)" : "oklch(0.95 0.02 240)",
                                color: isRedTile(ting.discard) ? "oklch(0.5 0.2 25)" : isGhost(ting.discard) ? "oklch(0.45 0.2 350)" : "inherit",
                              }}>{ting.discard}</span>
                              {i === 0 ? " ★ 最宽" : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono px-2 py-0.5 rounded font-bold" style={{
                              background: "oklch(0.88 0.1 145)",
                              color: "oklch(0.3 0.15 145)",
                            }}>听{ting.tingWidth}种{ting.tingCount}张</span>
                            <span className="font-mono px-2 py-0.5 rounded" style={{
                              background: "oklch(0.9 0.06 195)",
                              color: "oklch(0.4 0.15 195)",
                            }}>最高{ting.maxHuxi}胡</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ting.tingTiles.map((tt, j) => (
                            <div key={j} className="group relative">
                              <span className="px-2 py-1 rounded text-sm font-bold border inline-block cursor-help" style={{
                                borderColor: isGhost(tt.tile) ? "oklch(0.65 0.15 350)" : isBigTile(tt.tile) ? "oklch(0.7 0.1 240)" : "oklch(0.7 0.15 145)",
                                background: isGhost(tt.tile) ? "oklch(0.85 0.1 350 / 30%)" : isBigTile(tt.tile) ? "oklch(0.92 0.02 240)" : "oklch(0.92 0.04 145)",
                                color: isRedTile(tt.tile) ? "oklch(0.5 0.2 25)" : isGhost(tt.tile) ? "oklch(0.45 0.2 350)" : "inherit",
                              }}>
                                {tt.tile}
                                <span className="text-xs ml-0.5" style={{ color: "oklch(0.5 0.15 145)" }}>({tt.maxHuxi}胡)</span>
                              </span>
                              {tt.planDesc && (
                                <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10 p-2 rounded-lg shadow-lg text-xs max-w-[280px] whitespace-normal" style={{ background: "oklch(0.2 0 0)", color: "oklch(0.9 0 0)" }}>
                                  {tt.planDesc}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== 6. 区域识别结果 ===== */}
              {/* My Exposed Groups */}
              {result.myExposedGroups && result.myExposedGroups.length > 0 && (
                <div className="wireframe-card rounded-xl p-4">
                  <div className="mono-label mb-2 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" style={{ color: "oklch(0.75 0.15 195)" }} />
                    [ MY EXPOSED ] 我方明牌组
                  </div>
                  <div className="space-y-1.5">
                    {result.myExposedGroups.map((group, i) => renderTileGroup(group, i, "我方"))}
                  </div>
                </div>
              )}

              {/* Opponent Exposed Groups */}
              {result.opponentExposedGroups && result.opponentExposedGroups.length > 0 && (
                <div className="wireframe-card rounded-xl p-4">
                  <div className="mono-label mb-2 flex items-center gap-2">
                    <Swords className="h-3.5 w-3.5" style={{ color: "oklch(0.65 0.15 25)" }} />
                    [ OPPONENT ] 对手明牌组
                  </div>
                  <div className="space-y-1.5">
                    {result.opponentExposedGroups.map((group, i) => renderTileGroup(group, i, "对手"))}
                  </div>
                  {result.opponentEstimatedHuxi > 0 && (
                    <div className="mt-2 text-xs flex items-center gap-1" style={{ color: "oklch(0.55 0.15 25)" }}>
                      <AlertTriangle className="h-3 w-3" />
                      对手已确认胡息：{result.opponentEstimatedHuxi}胡
                    </div>
                  )}
                </div>
              )}

              {/* Discarded Tiles */}
              {result.discardedTiles && result.discardedTiles.length > 0 && (
                <div className="wireframe-card rounded-xl p-4">
                  <div className="mono-label mb-2 flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" style={{ color: "oklch(0.6 0.1 85)" }} />
                    [ DISCARD ] 弃牌区（安全牌参考）
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {result.discardedTiles.map((tile, i) => renderTile(tile, i))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">已出现的牌可作为安全牌优先打出</p>
                </div>
              )}

              {/* Hand Groups (from optimal plan) */}
              {result.handGroups && result.handGroups.length > 0 && (
                <div className="wireframe-card rounded-xl p-4">
                  <div className="mono-label mb-2">[ GROUPS ] 最优拆组</div>
                  <div className="space-y-1.5">
                    {result.handGroups.map((group, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="font-mono">{group.tiles.join("")}</span>
                        <span className="text-muted-foreground">({group.type})</span>
                        <span className="font-bold ml-auto" style={{ color: group.huxi > 0 ? "oklch(0.55 0.2 145)" : "oklch(0.6 0 0)" }}>
                          {group.huxi > 0 ? `+${group.huxi}胡` : "0胡"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Analysis (collapsible) */}
              {result.analysisReasoning && (
                <details className="wireframe-card rounded-xl">
                  <summary className="p-4 cursor-pointer font-medium text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4" style={{ color: "oklch(0.75 0.15 195)" }} />
                    查看详细分析推理
                  </summary>
                  <div className="px-4 pb-4 text-sm text-muted-foreground prose prose-sm max-w-none">
                    <Streamdown>{result.analysisReasoning}</Streamdown>
                  </div>
                </details>
              )}
            </>
          )}

          {!result && !isAnalyzing && !error && (
            <div className="wireframe-card rounded-xl p-8 text-center">
              <Brain className="h-16 w-16 mx-auto mb-4 opacity-15" />
              <p className="font-semibold text-muted-foreground mb-1">等待分析</p>
              <p className="text-xs text-muted-foreground">
                {mode === "live"
                  ? "开始投屏后，AI 将实时分析牌局并给出策略"
                  : "上传游戏截图后，AI 将自动识别并给出最优策略"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
