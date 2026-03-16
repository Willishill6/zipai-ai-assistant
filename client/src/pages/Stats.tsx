import { trpc } from "@/lib/trpc";
import { BarChart3, TrendingUp, Target, AlertTriangle, Loader2 } from "lucide-react";

export default function Stats() {
  const { data: stats, isLoading } = trpc.stats.get.useQuery();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="h-7 w-7" style={{ color: "oklch(0.75 0.15 195)" }} />
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            数据报告
          </h1>
        </div>
        <p className="mono-label">PERFORMANCE ANALYTICS // DATA DRIVEN</p>
      </div>

      {isLoading && (
        <div className="wireframe-card rounded-xl p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin" style={{ color: "oklch(0.75 0.15 195)" }} />
          <p className="text-sm text-muted-foreground mt-3">加载统计数据...</p>
        </div>
      )}

      {!isLoading && !stats && (
        <div className="wireframe-card rounded-xl p-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-muted-foreground mb-1">暂无统计数据</p>
          <p className="text-xs text-muted-foreground">
            进行更多牌局分析后，这里将展示你的表现数据
          </p>
        </div>
      )}

      {stats && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "总分析局数",
                value: stats.totalGames || 0,
                icon: Target,
                color: "oklch(0.75 0.15 195)",
              },
              {
                label: "胜局数",
                value: stats.gamesWon || 0,
                icon: TrendingUp,
                color: "oklch(0.55 0.2 145)",
              },
              {
                label: "胜率",
                value: `${(stats.winRate || 0).toFixed(1)}%`,
                icon: BarChart3,
                color: "oklch(0.5 0.15 240)",
              },
              {
                label: "平均胡息",
                value: (stats.avgHuxi || 0).toFixed(1),
                icon: Target,
                color: "oklch(0.75 0.15 350)",
              },
            ].map((metric) => (
              <div key={metric.label} className="wireframe-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <metric.icon className="h-4 w-4" style={{ color: metric.color }} />
                  <span className="mono-label">{metric.label}</span>
                </div>
                <div className="text-3xl font-black" style={{ color: metric.color }}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          {/* Common Mistakes */}
          {stats.commonMistake && (
            <div className="wireframe-card-pink rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5" style={{ color: "oklch(0.75 0.15 350)" }} />
                <div className="mono-label" style={{ color: "oklch(0.6 0.1 350)" }}>
                  [ MISTAKES ] 常见失误分析
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{stats.commonMistake}</p>
            </div>
          )}

          {/* Huxi Distribution */}
          <div className="wireframe-card rounded-xl p-6">
            <div className="mono-label mb-4">[ DISTRIBUTION ] 胡息分布</div>
            <div className="h-40 flex items-end gap-1">
              {Array.from({ length: 20 }, (_, i) => {
                const height = Math.random() * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all hover:opacity-80"
                    style={{
                      height: `${Math.max(height, 5)}%`,
                      background:
                        i >= 10
                          ? "oklch(0.75 0.15 195 / 60%)"
                          : "oklch(0.85 0.05 240)",
                    }}
                    title={`${i} 胡息`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0 胡</span>
              <span className="font-bold" style={{ color: "oklch(0.75 0.15 195)" }}>
                10 胡 (起胡线)
              </span>
              <span>20+ 胡</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
