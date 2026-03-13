import { trpc } from "@/lib/trpc";
import { Swords, Play, RotateCcw, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type GameState = {
  handTiles: string[];
  exposedTiles: string[][];
  opponentExposed: string[][];
  currentHuxi: number;
  opponentHuxi: number;
  remainingTiles: number;
  lastDrawn: string | null;
  currentAction: string | null;
  gameOver: boolean;
  message: string;
};

export default function Practice() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const startMutation = trpc.practice.start.useMutation({
    onSuccess: data => {
      setSessionId(data.sessionId);
      setGameState(data.gameState as GameState);
    },
  });

  const moveMutation = trpc.practice.move.useMutation({
    onSuccess: data => {
      setGameState(data.gameState as GameState);
    },
  });

  const handleStart = () => {
    startMutation.mutate();
  };

  const handlePlayTile = (tile: string) => {
    if (!sessionId) return;
    moveMutation.mutate({ sessionId, action: "discard", tile });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Swords
            className="h-7 w-7"
            style={{ color: "oklch(0.75 0.15 195)" }}
          />
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            虚拟对战
          </h1>
        </div>
        <p className="mono-label">AI OPPONENT PRACTICE // TRAINING MODE</p>
      </div>

      {!gameState && (
        <div className="wireframe-card rounded-xl p-12 text-center">
          <Swords className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="font-semibold mb-2">虚拟对战练习</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            与 AI 对手进行模拟对战，练习出牌策略和胡息计算。 AI
            会模拟真实对手的出牌风格，帮助你提升实战能力。
          </p>
          <Button
            onClick={handleStart}
            disabled={startMutation.isPending}
            className="h-12 px-8 text-base font-semibold"
            style={{ background: "oklch(0.45 0.15 240)" }}
          >
            {startMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                初始化对局...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                开始对战
              </>
            )}
          </Button>
        </div>
      )}

      {gameState && (
        <div className="space-y-4">
          {/* Game Info Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="wireframe-card rounded-xl p-4 text-center">
              <div className="mono-label mb-1">我的胡息</div>
              <div
                className="text-3xl font-black"
                style={{
                  color:
                    gameState.currentHuxi >= 10
                      ? "oklch(0.55 0.2 145)"
                      : "oklch(0.5 0.15 240)",
                }}
              >
                {gameState.currentHuxi}
              </div>
            </div>
            <div className="wireframe-card rounded-xl p-4 text-center">
              <div className="mono-label mb-1">剩余底牌</div>
              <div
                className="text-3xl font-black"
                style={{ color: "oklch(0.5 0.15 240)" }}
              >
                {gameState.remainingTiles}
              </div>
            </div>
            <div className="wireframe-card-pink rounded-xl p-4 text-center">
              <div
                className="mono-label mb-1"
                style={{ color: "oklch(0.6 0.1 350)" }}
              >
                对手胡息
              </div>
              <div
                className="text-3xl font-black"
                style={{ color: "oklch(0.75 0.15 350)" }}
              >
                {gameState.opponentHuxi}
              </div>
            </div>
          </div>

          {/* Message */}
          {gameState.message && (
            <div className="wireframe-card rounded-xl p-4 text-center">
              <p className="text-sm font-medium">{gameState.message}</p>
            </div>
          )}

          {/* Opponent Exposed */}
          {gameState.opponentExposed &&
            gameState.opponentExposed.length > 0 && (
              <div className="wireframe-card-pink rounded-xl p-4">
                <div
                  className="mono-label mb-3"
                  style={{ color: "oklch(0.6 0.1 350)" }}
                >
                  [ OPPONENT ] 对手明牌
                </div>
                <div className="flex flex-wrap gap-3">
                  {gameState.opponentExposed.map((group, gi) => (
                    <div key={gi} className="flex gap-1">
                      {group.map((tile, ti) => (
                        <div
                          key={ti}
                          className="w-8 h-11 rounded flex items-center justify-center text-xs font-bold border"
                          style={{
                            borderColor: "oklch(0.75 0.15 350 / 40%)",
                            background: "oklch(0.97 0.005 350)",
                          }}
                        >
                          {tile}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* My Exposed */}
          {gameState.exposedTiles && gameState.exposedTiles.length > 0 && (
            <div className="wireframe-card rounded-xl p-4">
              <div className="mono-label mb-3">[ EXPOSED ] 我的明牌</div>
              <div className="flex flex-wrap gap-3">
                {gameState.exposedTiles.map((group, gi) => (
                  <div key={gi} className="flex gap-1">
                    {group.map((tile, ti) => (
                      <div
                        key={ti}
                        className="w-8 h-11 rounded flex items-center justify-center text-xs font-bold border"
                        style={{
                          borderColor: "oklch(0.75 0.15 195 / 40%)",
                          background: "oklch(0.97 0.005 195)",
                        }}
                      >
                        {tile}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hand Tiles */}
          <div className="wireframe-card rounded-xl p-4 glow-cyan">
            <div className="mono-label mb-3">
              [ HAND ] 我的手牌{" "}
              {gameState.lastDrawn && `(新摸: ${gameState.lastDrawn})`}
            </div>
            <div className="flex flex-wrap gap-2">
              {gameState.handTiles.map((tile, i) => (
                <button
                  key={i}
                  onClick={() => handlePlayTile(tile)}
                  disabled={moveMutation.isPending || gameState.gameOver}
                  className="w-10 h-14 rounded-lg flex items-center justify-center text-base font-bold border-2 transition-all hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    borderColor:
                      tile === gameState.lastDrawn
                        ? "oklch(0.75 0.15 195)"
                        : "oklch(0.85 0.05 240)",
                    background:
                      tile === gameState.lastDrawn
                        ? "oklch(0.94 0.02 195)"
                        : "oklch(0.98 0 0)",
                  }}
                >
                  {tile}
                </button>
              ))}
            </div>
            {!gameState.gameOver && (
              <p className="text-xs text-muted-foreground mt-3">
                点击手牌打出 | AI 对手将自动应答
              </p>
            )}
          </div>

          {/* Game Over / Actions */}
          {gameState.gameOver ? (
            <div className="wireframe-card rounded-xl p-6 text-center">
              <div className="text-xl font-black mb-2">对局结束</div>
              <p className="text-sm text-muted-foreground mb-4">
                {gameState.message}
              </p>
              <Button
                onClick={handleStart}
                disabled={startMutation.isPending}
                className="h-10 px-6"
                style={{ background: "oklch(0.45 0.15 240)" }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                再来一局
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleStart}
                disabled={startMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                重新开始
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
