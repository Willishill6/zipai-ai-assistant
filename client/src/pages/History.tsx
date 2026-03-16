import { trpc } from "@/lib/trpc";
import { History, Trash2, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Streamdown } from "streamdown";

export default function HistoryPage() {
  const { data: records, isLoading } = trpc.analysis.list.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const deleteMutation = trpc.analysis.delete.useMutation({
    onSuccess: () => {
      trpc.useUtils().analysis.list.invalidate();
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <History className="h-7 w-7" style={{ color: "oklch(0.75 0.15 195)" }} />
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            历史记录
          </h1>
        </div>
        <p className="mono-label">ANALYSIS HISTORY // REPLAY & LEARN</p>
      </div>

      {isLoading && (
        <div className="wireframe-card rounded-xl p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin" style={{ color: "oklch(0.75 0.15 195)" }} />
          <p className="text-sm text-muted-foreground mt-3">加载历史记录...</p>
        </div>
      )}

      {!isLoading && (!records || records.length === 0) && (
        <div className="wireframe-card rounded-xl p-12 text-center">
          <History className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-muted-foreground mb-1">暂无分析记录</p>
          <p className="text-xs text-muted-foreground">
            上传游戏截图进行 AI 分析后，记录将自动保存在这里
          </p>
        </div>
      )}

      {records && records.length > 0 && (
        <div className="space-y-3">
          {records.map((record: any) => (
            <div key={record.id} className="wireframe-card rounded-xl overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                {record.screenshotUrl && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                    <img
                      src={record.screenshotUrl}
                      alt="截图"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {record.recommendedAction || "AI 分析"}
                    </span>
                    {record.recommendedTile && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-bold"
                        style={{
                          background: "oklch(0.75 0.15 195 / 15%)",
                          color: "oklch(0.4 0.15 195)",
                        }}
                      >
                        {record.recommendedTile}
                      </span>
                    )}
                    {record.currentHuxi !== null && (
                      <span className="text-xs text-muted-foreground">
                        胡息: {record.currentHuxi}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(record.createdAt).toLocaleString("zh-CN")}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExpandedId(expandedId === record.id ? null : record.id)
                    }
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {expandedId === record.id && (
                <div className="border-t p-4 space-y-3" style={{ borderColor: "oklch(0.92 0.01 240)" }}>
                  {record.aiSuggestion && (
                    <div>
                      <div className="mono-label mb-2">[ SUGGESTION ] AI 建议</div>
                      <div className="text-sm prose prose-sm max-w-none">
                        <Streamdown>{record.aiSuggestion}</Streamdown>
                      </div>
                    </div>
                  )}
                  {record.analysisReasoning && (
                    <div>
                      <div className="mono-label mb-2">[ REASONING ] 分析推理</div>
                      <div className="text-sm text-muted-foreground prose prose-sm max-w-none">
                        <Streamdown>{record.analysisReasoning}</Streamdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
