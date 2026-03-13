import {
  Activity,
  BarChart3,
  Clock3,
  Flame,
  Gauge,
  Loader2,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  PanelTitle,
} from "@/components/PagePrimitives";
import { trpc } from "@/lib/trpc";

type RankedItem = {
  label: string;
  count: number;
  share: number;
};

type DailyPoint = {
  key: string;
  label: string;
  count: number;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "暂未更新";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildRankedItems(values: string[]) {
  const total = values.length;
  if (total === 0) return [] as RankedItem[];

  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      share: count / total,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

function buildDailySeries(values: Array<string | Date>) {
  const now = new Date();
  const points: DailyPoint[] = [];
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    const key = new Date(value).toISOString().slice(0, 10);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  for (let offset = 6; offset >= 0; offset -= 1) {
    const current = new Date(now);
    current.setDate(now.getDate() - offset);
    const key = current.toISOString().slice(0, 10);
    points.push({
      key,
      label: current.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
      count: counts[key] ?? 0,
    });
  }

  return points;
}

function buildFocusNote({
  averageHuxi,
  winRate,
  topAction,
  recentVolume,
}: {
  averageHuxi: number;
  winRate: number;
  topAction?: RankedItem;
  recentVolume: number;
}) {
  if (recentVolume === 0) {
    return "先去首页完成几次分析，统计页会开始沉淀你的对局节奏和建议偏向。";
  }

  if (averageHuxi < 6) {
    return "当前更像基础成型阶段，优先盯住门子完整度和中段进张，不要太早押注单一路线。";
  }

  if (averageHuxi < 10) {
    return "你已经进入冲听阶段，接下来更值得观察推荐动作是否偏激进，以及哪些牌经常成为卡点。";
  }

  if (winRate > 0 && winRate < 35) {
    return "胡息线已经不低，但转化率偏弱，建议重点复盘终盘安全牌和是否过度追大胡。";
  }

  if (topAction?.label) {
    return `最近建议最常落在“${topAction.label}”，可以回看这类局面是否真的稳定带来更顺的后续节奏。`;
  }

  return "整体节奏比较稳定，接下来更适合关注不同推荐动作在残局里的表现差异。";
}

export default function Stats() {
  const statsQuery = trpc.stats.get.useQuery();
  const recordsQuery = trpc.analysis.list.useQuery();

  const records = recordsQuery.data ?? [];
  const stats = statsQuery.data;
  const isLoading = statsQuery.isLoading || recordsQuery.isLoading;

  const derived = useMemo(() => {
    const totalRecords = records.length;
    const totalAnalyses = Math.max(totalRecords, stats?.totalGames ?? 0);
    const totalHuxiFromRecords = records.reduce(
      (sum, record) => sum + (record.currentHuxi ?? 0),
      0
    );
    const averageHuxi =
      totalRecords > 0
        ? totalHuxiFromRecords / totalRecords
        : Number(stats?.avgHuxi ?? 0);
    const bestHuxi = records.reduce(
      (max, record) => Math.max(max, record.currentHuxi ?? 0),
      0
    );
    const actionRanking = buildRankedItems(
      records
        .map((record) => record.recommendedAction?.trim())
        .filter((value): value is string => Boolean(value))
    );
    const tileRanking = buildRankedItems(
      records
        .map((record) => record.recommendedTile?.trim())
        .filter((value): value is string => Boolean(value))
    );
    const dailySeries = buildDailySeries(records.map((record) => record.createdAt));
    const recentVolume = dailySeries.reduce((sum, item) => sum + item.count, 0);
    const activeDays = dailySeries.filter((item) => item.count > 0).length;
    const latestRecord = records[0]?.createdAt ?? stats?.updatedAt ?? null;
    const winRate = Number(stats?.winRate ?? 0);
    const gamesWon = Number(stats?.gamesWon ?? 0);
    const focusNote = buildFocusNote({
      averageHuxi,
      winRate,
      topAction: actionRanking[0],
      recentVolume,
    });

    return {
      totalRecords,
      totalAnalyses,
      averageHuxi,
      bestHuxi,
      actionRanking,
      tileRanking,
      dailySeries,
      recentVolume,
      activeDays,
      latestRecord,
      winRate,
      gamesWon,
      focusNote,
    };
  }, [records, stats]);

  const hasData = derived.totalRecords > 0 || derived.totalAnalyses > 0;
  const maxDailyCount = Math.max(...derived.dailySeries.map((item) => item.count), 1);
  const topAction = derived.actionRanking[0];
  const topTile = derived.tileRanking[0];

  return (
    <div className="app-page">
      <PageHeader
        icon={BarChart3}
        eyebrow="Performance Deck"
        title="数据报告"
        description="把每次分析沉淀成可追踪的节奏面板，方便你判断最近打牌更偏进攻、防守，还是仍在补基础成型。"
        chips={[
          { label: `${derived.totalAnalyses} 次累计分析`, tone: "cyan" },
          {
            label: derived.activeDays > 0 ? `近 7 天活跃 ${derived.activeDays} 天` : "等待第一批样本",
            tone: "amber",
          },
          {
            label: `最近更新 ${formatDate(derived.latestRecord)}`,
            tone: "slate",
          },
        ]}
      />

      {isLoading && !hasData ? (
        <div className="mt-5">
          <EmptyState
            icon={Loader2}
            title="正在整理你的复盘数据"
            description="稍等一下，统计页正在从历史分析和聚合数据里重建最近的对局画像。"
          />
        </div>
      ) : null}

      {!isLoading && !hasData ? (
        <div className="mt-5">
          <EmptyState
            icon={Activity}
            title="还没有可统计的数据"
            description="先去首页完成几次截图分析，或者在练习模式里跑几局，这里就会开始出现趋势、动作分布和复盘重点。"
          />
        </div>
      ) : null}

      {hasData ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Activity}
              label="Total Analyses"
              value={derived.totalAnalyses}
              hint="累计沉淀的分析次数，包含可回看的历史样本。"
              tone="cyan"
            />
            <MetricCard
              icon={Gauge}
              label="Average Huxi"
              value={derived.averageHuxi.toFixed(1)}
              hint="优先用历史记录反推，没记录时回退到聚合统计。"
              tone="emerald"
            />
            <MetricCard
              icon={Trophy}
              label="Win Rate"
              value={derived.winRate > 0 ? `${derived.winRate.toFixed(1)}%` : "未统计"}
              hint={derived.gamesWon > 0 ? `已记录 ${derived.gamesWon} 次成胡。` : "当前后端还没有沉淀出有效胜率样本。"}
              tone="amber"
            />
            <MetricCard
              icon={Sparkles}
              label="Action Diversity"
              value={derived.actionRanking.length}
              hint={topAction ? `最近最常见建议：${topAction.label}` : "暂时还没有足够的推荐动作数据。"}
              tone="rose"
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="wireframe-card rounded-[28px] p-5 md:p-6">
              <PanelTitle
                icon={Clock3}
                kicker="Rhythm"
                title="近 7 天分析节奏"
                tone="cyan"
                extra={
                  <span className="status-pill">
                    <span className="status-dot" />
                    {derived.recentVolume} 次分析
                  </span>
                }
              />
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="grid grid-cols-7 gap-2">
                  {derived.dailySeries.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-[22px] border p-3 text-center"
                      style={{
                        background: "linear-gradient(180deg, oklch(0.99 0.01 205), oklch(0.97 0.01 220))",
                        borderColor: "oklch(0.86 0.04 210 / 82%)",
                      }}
                    >
                      <div className="text-[11px] text-muted-foreground">{item.label}</div>
                      <div className="mt-3 flex h-28 items-end justify-center">
                        <div
                          className="w-full rounded-full"
                          style={{
                            minHeight: item.count > 0 ? "18px" : "8px",
                            height: `${Math.max(8, (item.count / maxDailyCount) * 100)}%`,
                            background:
                              item.count > 0
                                ? "linear-gradient(180deg, oklch(0.68 0.14 205), oklch(0.48 0.14 235))"
                                : "oklch(0.92 0.01 230)",
                          }}
                        />
                      </div>
                      <div className="mt-3 text-sm font-bold">{item.count}</div>
                    </div>
                  ))}
                </div>

                <div className="wireframe-card rounded-[24px] p-4">
                  <div className="mono-label mb-3">Training Focus</div>
                  <div className="text-lg font-black tracking-tight">
                    {topAction ? `${topAction.label} 是当前主线` : "等待形成主线"}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {derived.focusNote}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div
                      className="rounded-[20px] border p-3"
                      style={{
                        background: "oklch(0.95 0.04 160)",
                        borderColor: "oklch(0.8 0.08 160 / 70%)",
                      }}
                    >
                      <div className="mono-label">Best Huxi</div>
                      <div className="mt-2 text-2xl font-black">{derived.bestHuxi}</div>
                    </div>
                    <div
                      className="rounded-[20px] border p-3"
                      style={{
                        background: "oklch(0.96 0.03 75)",
                        borderColor: "oklch(0.84 0.08 75 / 70%)",
                      }}
                    >
                      <div className="mono-label">Hot Tile</div>
                      <div className="mt-2 text-2xl font-black">{topTile?.label ?? "--"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="wireframe-card-pink rounded-[28px] p-5 md:p-6">
              <PanelTitle
                icon={Flame}
                kicker="Signals"
                title="建议倾向与风险提示"
                tone="rose"
              />
              <div className="space-y-4">
                <div className="rounded-[24px] border border-border bg-white/70 p-4">
                  <div className="mono-label mb-3">Action Mix</div>
                  {derived.actionRanking.length > 0 ? (
                    <div className="space-y-3">
                      {derived.actionRanking.slice(0, 5).map((item) => (
                        <div key={item.label}>
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold">{item.label}</span>
                            <span className="text-muted-foreground">
                              {item.count} 次 / {(item.share * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[oklch(0.92_0.01_235)]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(10, item.share * 100)}%`,
                                background:
                                  "linear-gradient(90deg, oklch(0.72 0.14 350), oklch(0.54 0.14 320))",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      还没有足够的推荐动作样本，先完成更多对局分析会更有参考价值。
                    </p>
                  )}
                </div>

                <div className="rounded-[24px] border border-border bg-white/70 p-4">
                  <div className="mono-label mb-3">System Notes</div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">常见建议</span>
                      <span className="font-semibold">{topAction?.label ?? "暂无"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">常见出牌</span>
                      <span className="font-semibold">{topTile?.label ?? "暂无"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">聚合问题</span>
                      <span className="font-semibold text-right">
                        {stats?.commonMistake?.trim() || "后端暂未写入常见失误类型"}
                      </span>
                    </div>
                    <div className="rounded-[18px] border px-3 py-3 text-muted-foreground">
                      {stats?.commonMistake?.trim()
                        ? `近期最需要留意的是：${stats.commonMistake}`
                        : "当前统计表里还没有填充 commonMistake，这一块我先做了前端占位，等你告诉我要不要补后端计算逻辑。"}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <section className="wireframe-card rounded-[28px] p-5 md:p-6">
              <PanelTitle
                icon={Target}
                kicker="Tile Pressure"
                title="高频推荐出牌"
                tone="amber"
              />
              {derived.tileRanking.length > 0 ? (
                <div className="space-y-3">
                  {derived.tileRanking.slice(0, 6).map((item, index) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-[22px] border p-3"
                      style={{
                        background: index === 0 ? "oklch(0.96 0.03 75)" : "oklch(0.985 0.008 220 / 92%)",
                        borderColor: index === 0 ? "oklch(0.84 0.08 75 / 78%)" : "oklch(0.86 0.03 220 / 90%)",
                      }}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-white text-lg font-black">
                        {item.label}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">#{index + 1}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.count} 次 / {(item.share * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-[oklch(0.92_0.01_235)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(10, item.share * 100)}%`,
                              background:
                                "linear-gradient(90deg, oklch(0.7 0.14 75), oklch(0.56 0.18 45))",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  当前历史样本里还没有稳定的推荐牌倾向。
                </p>
              )}
            </section>

            <section className="wireframe-card rounded-[28px] p-5 md:p-6">
              <PanelTitle
                icon={BarChart3}
                kicker="Recent Archive"
                title="最近复盘样本"
                tone="cyan"
              />
              {records.length > 0 ? (
                <div className="space-y-3">
                  {records.slice(0, 5).map((record) => (
                    <article
                      key={record.id}
                      className="rounded-[24px] border p-4"
                      style={{
                        background: "linear-gradient(180deg, oklch(1 0 0 / 84%), oklch(0.985 0.008 220 / 92%))",
                        borderColor: "oklch(0.84 0.03 220 / 88%)",
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-pill">{record.recommendedAction || "AI 分析"}</span>
                        {record.recommendedTile ? (
                          <span className="status-pill">推荐打 {record.recommendedTile}</span>
                        ) : null}
                        <span className="status-pill">胡息 {record.currentHuxi ?? 0}</span>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {formatDate(record.createdAt)}
                      </div>
                      <div className="mt-3 text-sm leading-6 text-muted-foreground line-clamp-3">
                        {record.aiSuggestion || "这条记录没有保存推荐文案。"}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  聚合统计已存在，但当前账号下还没有可直接回看的历史记录。
                </p>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
