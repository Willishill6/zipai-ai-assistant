import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Clock3,
  Eye,
  History,
  Loader2,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  PanelTitle,
} from "@/components/PagePrimitives";

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const utils = trpc.useUtils();
  const { data: records, isLoading } = trpc.analysis.list.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const deleteMutation = trpc.analysis.delete.useMutation({
    onSuccess: async (_data, input) => {
      if (expandedId === input.id) {
        setExpandedId(null);
      }
      await utils.analysis.list.invalidate();
    },
  });

  const summary = useMemo(() => {
    const safeRecords = records ?? [];
    const total = safeRecords.length;
    const avgHuxi =
      total > 0
        ? safeRecords.reduce((sum: number, record: any) => sum + (record.currentHuxi || 0), 0) /
          total
        : 0;
    const uniqueActions = new Set(
      safeRecords
        .map((record: any) => record.recommendedAction)
        .filter(Boolean)
    ).size;
    const latest = safeRecords[0]?.createdAt ?? null;

    return {
      total,
      avgHuxi,
      uniqueActions,
      latest,
    };
  }, [records]);

  const handleDelete = (id: number) => {
    if (!window.confirm("确定删除这条分析记录吗？")) {
      return;
    }
    deleteMutation.mutate({ id });
  };

  return (
    <div className="app-page">
      <PageHeader
        icon={History}
        eyebrow="Replay Archive"
        title="历史记录"
        description="每次截图分析都会沉淀成可回看的决策切片。这里更适合做复盘：看当时建议了什么、为什么建议、以及你最近的决策方向有没有变化。"
        chips={[
          { label: `${summary.total} 条分析`, tone: "cyan" },
          { label: `${summary.uniqueActions} 类动作建议`, tone: "amber" },
          summary.latest
            ? { label: `最近更新 ${formatDate(summary.latest)}`, tone: "slate" }
            : { label: "等待首条记录", tone: "slate" },
        ]}
      />

      {isLoading ? (
        <div className="mt-5">
          <EmptyState
            icon={Loader2}
            title="正在加载历史记录"
            description="稍等一下，正在把你之前的分析结果整理成可复盘的记录面板。"
          />
        </div>
      ) : null}

      {!isLoading && (!records || records.length === 0) ? (
        <div className="mt-5">
          <EmptyState
            icon={History}
            title="还没有可回看的分析记录"
            description="上传一张牌局截图，或者在首页完成一次实时分析后，这里就会自动累积你的复盘档案。"
          />
        </div>
      ) : null}

      {records && records.length > 0 ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <MetricCard
              icon={History}
              label="Archive Size"
              value={summary.total}
              hint="记录越多，统计页给出的趋势就越有参考意义。"
              tone="cyan"
            />
            <MetricCard
              icon={Target}
              label="Average Huxi"
              value={summary.avgHuxi.toFixed(1)}
              hint="这里是历史记录中的平均即时胡息。"
              tone="emerald"
            />
            <MetricCard
              icon={Sparkles}
              label="Action Diversity"
              value={summary.uniqueActions}
              hint="反映 AI 最近给出了多少类不同的动作建议。"
              tone="rose"
            />
          </div>

          <div className="mt-5 space-y-4">
            {records.map((record: any) => {
              const isOpen = expandedId === record.id;
              const recognizedCount = Array.isArray(record.handTiles)
                ? record.handTiles.length
                : 0;

              return (
                <article
                  key={record.id}
                  className="wireframe-card rounded-[30px] p-4 md:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    {record.screenshotUrl ? (
                      <div
                        className="h-28 w-full shrink-0 overflow-hidden rounded-[22px] border lg:w-44"
                        style={{ borderColor: "oklch(0.84 0.04 205 / 90%)" }}
                      >
                        <img
                          src={record.screenshotUrl}
                          alt="截图"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-pill">
                          <span className="status-dot" />
                          {record.recommendedAction || "AI 分析"}
                        </span>
                        {record.recommendedTile ? (
                          <span className="status-pill">{record.recommendedTile}</span>
                        ) : null}
                        <span className="status-pill">
                          胡息 {record.currentHuxi ?? 0}
                        </span>
                        {recognizedCount > 0 ? (
                          <span className="status-pill">
                            手牌 {recognizedCount} 张
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDate(record.createdAt)}
                        </span>
                        {record.remainingTiles ? (
                          <span>剩余底牌 {record.remainingTiles} 张</span>
                        ) : null}
                      </div>

                      {record.aiSuggestion ? (
                        <div className="mt-4 rounded-[22px] border border-border bg-white/55 p-4 text-sm leading-6 text-muted-foreground">
                          <div className="mono-label mb-2">Snapshot</div>
                          <div className="line-clamp-3">
                            <Streamdown>{record.aiSuggestion}</Streamdown>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedId(isOpen ? null : record.id)}
                        className="rounded-full"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        {isOpen ? "收起" : "查看"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                        className="rounded-full text-destructive hover:text-destructive"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        删除
                      </Button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="mt-5 soft-divider pt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                      <div className="space-y-4">
                        <div className="wireframe-card rounded-[24px] p-4">
                          <PanelTitle
                            icon={Sparkles}
                            kicker="AI Suggestion"
                            title="当时的推荐与判断"
                            tone="emerald"
                          />
                          <div className="text-sm leading-6">
                            <Streamdown>{record.aiSuggestion || "暂无建议内容。"}</Streamdown>
                          </div>
                        </div>

                        {record.screenshotUrl ? (
                          <div className="wireframe-card rounded-[24px] p-4">
                            <div className="mono-label mb-3">Screenshot</div>
                            <div
                              className="overflow-hidden rounded-[20px] border"
                              style={{ borderColor: "oklch(0.84 0.04 205 / 90%)" }}
                            >
                              <img
                                src={record.screenshotUrl}
                                alt="截图详情"
                                className="w-full object-cover"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="wireframe-card rounded-[24px] p-4">
                        <PanelTitle
                          icon={Target}
                          kicker="Reasoning"
                          title="推理细节"
                          tone="cyan"
                        />
                        <div className="text-sm leading-6 text-muted-foreground">
                          <Streamdown>
                            {record.analysisReasoning || "这条记录没有保存详细推理。"}
                          </Streamdown>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
