import { useState, useMemo, useRef, useEffect } from "react";
import { Edit3, Check, X, RotateCcw, RefreshCw, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// 所有合法牌
const ALL_TILES = [
  "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
  "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾",
  "鬼",
];

// 大小字对应关系
const LARGE_TO_SMALL: Record<string, string> = {
  "壹": "一", "贰": "二", "叁": "三", "肆": "四", "伍": "五",
  "陆": "六", "柒": "七", "捌": "八", "玖": "九", "拾": "十",
};
const SMALL_TO_LARGE: Record<string, string> = {
  "一": "壹", "二": "贰", "三": "叁", "四": "肆", "五": "伍",
  "六": "陆", "七": "柒", "八": "捌", "九": "玖", "十": "拾",
};

const SMALL_TILES = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const BIG_TILES = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"];

const isBigTile = (tile: string) => "壹贰叁肆伍陆柒捌玖拾".includes(tile);
const isRedTile = (tile: string) => "二七十贰柒拾".includes(tile);
const isGhost = (tile: string) => tile === "鬼" || tile.includes("鬼") || tile.includes("飞飞");

// 牌的排序权重
const TILE_ORDER: Record<string, number> = {};
SMALL_TILES.forEach((t, i) => { TILE_ORDER[t] = i; });
BIG_TILES.forEach((t, i) => { TILE_ORDER[t] = i + 10; });
TILE_ORDER["鬼"] = 20;

interface TileEditorProps {
  tiles: string[];
  onTilesChanged: (newTiles: string[]) => void;
  isReanalyzing?: boolean;
  recommendedTile?: string;
}

export default function TileEditor({ tiles, onTilesChanged, isReanalyzing, recommendedTile }: TileEditorProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedTiles, setEditedTiles] = useState<string[]>([...tiles]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const addPickerRef = useRef<HTMLDivElement>(null);

  // Sync with parent tiles when they change (new analysis)
  useEffect(() => {
    setEditedTiles([...tiles]);
    setHasChanges(false);
    setEditMode(false);
    setSelectedIndex(null);
    setShowAddPicker(false);
  }, [tiles]);

  // Close popover on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedIndex(null);
      }
      if (addPickerRef.current && !addPickerRef.current.contains(e.target as Node)) {
        setShowAddPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 统计信息
  const stats = useMemo(() => {
    const currentTiles = editMode ? editedTiles : tiles;
    const smallCount = currentTiles.filter(t => SMALL_TILES.includes(t)).length;
    const bigCount = currentTiles.filter(t => BIG_TILES.includes(t)).length;
    const ghostCount = currentTiles.filter(t => isGhost(t)).length;
    
    // 每种牌的数量统计
    const tileCountMap: Record<string, number> = {};
    for (const t of currentTiles) {
      tileCountMap[t] = (tileCountMap[t] || 0) + 1;
    }
    
    // 检查异常：某种牌超过4张
    const overLimit = Object.entries(tileCountMap).filter(([_, count]) => count > 4);
    
    // 按数字分组统计（大小字同数字合并看）
    const numGroups: { num: number; small: string; smallCount: number; big: string; bigCount: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const small = SMALL_TILES[i];
      const big = BIG_TILES[i];
      const sc = tileCountMap[small] || 0;
      const bc = tileCountMap[big] || 0;
      if (sc > 0 || bc > 0) {
        numGroups.push({ num: i + 1, small, smallCount: sc, big, bigCount: bc });
      }
    }
    
    return { smallCount, bigCount, ghostCount, total: currentTiles.length, tileCountMap, overLimit, numGroups };
  }, [tiles, editedTiles, editMode]);

  // 排序后的牌（保留原始索引）
  const sortedTilesWithIndex = useMemo(() => {
    const currentTiles = editMode ? editedTiles : tiles;
    return currentTiles
      .map((tile, index) => ({ tile, originalIndex: index }))
      .sort((a, b) => (TILE_ORDER[a.tile] ?? 99) - (TILE_ORDER[b.tile] ?? 99));
  }, [tiles, editedTiles, editMode]);

  const handleTileClick = (index: number) => {
    if (!editMode) return;
    setSelectedIndex(selectedIndex === index ? null : index);
    setShowAddPicker(false);
  };

  const handleTileChange = (index: number, newTile: string) => {
    const newTiles = [...editedTiles];
    newTiles[index] = newTile;
    setEditedTiles(newTiles);
    setHasChanges(true);
    setSelectedIndex(null);
  };

  const handleQuickSwap = (index: number) => {
    const tile = editedTiles[index];
    const counterpart = LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile];
    if (counterpart) {
      handleTileChange(index, counterpart);
    }
  };

  const handleDeleteTile = (index: number) => {
    const newTiles = editedTiles.filter((_, i) => i !== index);
    setEditedTiles(newTiles);
    setHasChanges(true);
    setSelectedIndex(null);
  };

  const handleAddTile = (tile: string) => {
    setEditedTiles([...editedTiles, tile]);
    setHasChanges(true);
    setShowAddPicker(false);
  };

  const handleReset = () => {
    setEditedTiles([...tiles]);
    setHasChanges(false);
    setSelectedIndex(null);
    setShowAddPicker(false);
  };

  const handleApply = () => {
    onTilesChanged(editedTiles);
    setHasChanges(false);
    setEditMode(false);
    setSelectedIndex(null);
    setShowAddPicker(false);
  };

  const handleCancel = () => {
    setEditedTiles([...tiles]);
    setHasChanges(false);
    setEditMode(false);
    setSelectedIndex(null);
    setShowAddPicker(false);
  };

  // Render a single tile
  const renderTile = (tile: string, originalIndex: number, displayIndex: number) => {
    const isSelected = selectedIndex === originalIndex;
    const isRec = tile === recommendedTile;
    const ghost = isGhost(tile);
    const big = isBigTile(tile);
    const red = isRedTile(tile);

    // Tile colors
    let bg = "white";
    let border = "oklch(0.8 0.05 195)";
    let color = "oklch(0.2 0 0)";
    if (ghost) { bg = "oklch(0.95 0.06 350)"; border = "oklch(0.65 0.15 350)"; color = "oklch(0.45 0.2 350)"; }
    else if (big) { bg = "oklch(0.95 0.03 240)"; border = "oklch(0.7 0.1 240)"; color = red ? "oklch(0.5 0.2 25)" : "oklch(0.35 0.08 240)"; }
    else { bg = "white"; border = "oklch(0.85 0.05 195)"; color = red ? "oklch(0.5 0.2 25)" : "oklch(0.2 0 0)"; }

    if (isSelected) { border = "oklch(0.55 0.2 240)"; bg = "oklch(0.93 0.06 240)"; }

    return (
      <div key={`${originalIndex}-${displayIndex}`} className="relative" ref={isSelected ? popoverRef : undefined}>
        <button
          onClick={() => handleTileClick(originalIndex)}
          className={`relative flex flex-col items-center justify-center w-12 h-14 rounded-lg border-2 transition-all ${
            editMode ? "cursor-pointer hover:scale-105" : ""
          } ${isRec && !editMode ? "ring-2 ring-offset-1" : ""}`}
          style={{
            borderColor: border,
            background: bg,
            color: color,
            ...(isRec && !editMode ? { ringColor: "oklch(0.55 0.2 145)" } : {}),
          }}
        >
          <span className="text-lg font-bold leading-none">{tile}</span>
          <span
            className="text-[8px] leading-none mt-0.5"
            style={{ color: ghost ? "oklch(0.5 0.15 350)" : big ? "oklch(0.5 0.1 240)" : "oklch(0.55 0.05 195)" }}
          >
            {ghost ? "鬼" : big ? "大" : "小"}
          </span>
          {/* Quick swap button in edit mode */}
          {editMode && !ghost && (
            <button
              onClick={(e) => { e.stopPropagation(); handleQuickSwap(originalIndex); }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
              style={{ background: "oklch(0.55 0.15 240)" }}
              title={big ? "切换为小字" : "切换为大字"}
            >
              ⇄
            </button>
          )}
          {/* Delete button in edit mode */}
          {editMode && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteTile(originalIndex); }}
              className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white"
              style={{ background: "oklch(0.55 0.2 25)" }}
              title="删除此牌"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
        </button>

        {/* Tile change popover */}
        {isSelected && (
          <div
            className="absolute z-50 mt-1 p-2 rounded-xl border-2 shadow-xl"
            style={{ background: "white", borderColor: "oklch(0.7 0.1 240)", minWidth: "260px", left: "50%", transform: "translateX(-50%)" }}
          >
            {/* Quick swap */}
            {!ghost && (
              <div className="mb-2 pb-2" style={{ borderBottom: "1px solid oklch(0.9 0.03 195)" }}>
                <div className="text-[10px] text-muted-foreground mb-1">快速切换：</div>
                <button
                  onClick={() => handleTileChange(originalIndex, LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile]!)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all hover:scale-105"
                  style={{
                    borderColor: "oklch(0.6 0.15 85)",
                    background: "oklch(0.98 0.02 85)",
                    color: isRedTile(LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile] || "") ? "oklch(0.5 0.2 25)" : "inherit",
                  }}
                >
                  {tile} → {LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile]}
                  <span className="text-xs ml-1 font-normal">
                    ({LARGE_TO_SMALL[tile] ? "改为小字" : "改为大字"})
                  </span>
                </button>
              </div>
            )}

            {/* Small tiles */}
            <div className="mb-1.5">
              <div className="text-[10px] text-muted-foreground mb-1">小字（笔画少）：</div>
              <div className="flex flex-wrap gap-1">
                {SMALL_TILES.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTileChange(originalIndex, t)}
                    className={`px-2 py-1 rounded text-sm font-bold border transition-all hover:scale-110 ${
                      t === tile ? "ring-2 ring-blue-500" : ""
                    }`}
                    style={{
                      borderColor: "oklch(0.8 0.05 195)",
                      background: t === tile ? "oklch(0.9 0.06 195)" : "white",
                      color: isRedTile(t) ? "oklch(0.5 0.2 25)" : "inherit",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Big tiles */}
            <div className="mb-1.5">
              <div className="text-[10px] text-muted-foreground mb-1">大字（笔画多）：</div>
              <div className="flex flex-wrap gap-1">
                {BIG_TILES.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTileChange(originalIndex, t)}
                    className={`px-2 py-1 rounded text-sm font-bold border transition-all hover:scale-110 ${
                      t === tile ? "ring-2 ring-blue-500" : ""
                    }`}
                    style={{
                      borderColor: "oklch(0.75 0.08 240)",
                      background: t === tile ? "oklch(0.88 0.06 240)" : "oklch(0.96 0.02 240)",
                      color: isRedTile(t) ? "oklch(0.5 0.2 25)" : "oklch(0.35 0.08 240)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Ghost */}
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">特殊：</div>
              <button
                onClick={() => handleTileChange(originalIndex, "鬼")}
                className={`px-2 py-1 rounded text-sm font-bold border transition-all hover:scale-110 ${
                  tile === "鬼" ? "ring-2 ring-pink-500" : ""
                }`}
                style={{
                  borderColor: "oklch(0.65 0.15 350)",
                  background: tile === "鬼" ? "oklch(0.9 0.08 350)" : "oklch(0.97 0.03 350)",
                  color: "oklch(0.45 0.2 350)",
                }}
              >
                鬼
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 将排序后的牌分成小字、大字、鬼牌三组
  const { smallGroup, bigGroup, ghostGroup } = useMemo(() => {
    const small = sortedTilesWithIndex.filter(t => !isBigTile(t.tile) && !isGhost(t.tile));
    const big = sortedTilesWithIndex.filter(t => isBigTile(t.tile));
    const ghost = sortedTilesWithIndex.filter(t => isGhost(t.tile));
    return { smallGroup: small, bigGroup: big, ghostGroup: ghost };
  }, [sortedTilesWithIndex]);

  return (
    <div className="rounded-xl border-2 p-4" style={{ borderColor: "oklch(0.75 0.1 195)", background: "oklch(0.98 0.005 195)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="mono-label text-sm">[ HAND ] AI 识别手牌</div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="px-2 py-0.5 rounded-full font-bold"
              style={{
                background: stats.total < 18 ? "oklch(0.9 0.08 25)" : "oklch(0.92 0.03 195)",
                color: stats.total < 18 ? "oklch(0.4 0.15 25)" : "oklch(0.4 0.1 195)",
              }}
            >
              共{stats.total}张{stats.total < 18 ? " ⚠️" : ""}
            </span>
            <span className="px-2 py-0.5 rounded-full" style={{ background: "white", color: "oklch(0.4 0.05 195)", border: "1px solid oklch(0.85 0.05 195)" }}>
              小{stats.smallCount}
            </span>
            <span className="px-2 py-0.5 rounded-full" style={{ background: "oklch(0.93 0.03 240)", color: "oklch(0.4 0.1 240)", border: "1px solid oklch(0.7 0.1 240)" }}>
              大{stats.bigCount}
            </span>
            {stats.ghostCount > 0 && (
              <span className="px-2 py-0.5 rounded-full" style={{ background: "oklch(0.92 0.08 350)", color: "oklch(0.4 0.15 350)", border: "1px solid oklch(0.65 0.15 350)" }}>
                鬼{stats.ghostCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!editMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(true)}
              className="h-7 text-xs gap-1"
            >
              <Edit3 className="h-3 w-3" />
              修正识别
            </Button>
          ) : (
            <>
              {hasChanges && (
                <Button variant="outline" size="sm" onClick={handleReset} className="h-7 text-xs gap-1">
                  <RotateCcw className="h-3 w-3" />
                  重置
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleCancel} className="h-7 text-xs gap-1">
                <X className="h-3 w-3" />
                取消
              </Button>
              {hasChanges && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={isReanalyzing}
                  className="h-7 text-xs gap-1"
                  style={{ background: "oklch(0.55 0.2 145)" }}
                >
                  {isReanalyzing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  重新分析
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 异常警告 */}
      {stats.overLimit.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg mb-3" style={{ background: "oklch(0.93 0.05 25 / 60%)", border: "1px solid oklch(0.75 0.15 25)" }}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "oklch(0.5 0.2 25)" }} />
          <div className="text-xs" style={{ color: "oklch(0.35 0.15 25)" }}>
            <strong>识别异常：</strong>
            {stats.overLimit.map(([tile, count]) => `"${tile}"识别出${count}张（最多4张）`).join("，")}
            。可能存在大小字混淆，请点击"修正识别"手动修改。
          </div>
        </div>
      )}

      {/* Edit mode hint */}
      {editMode && (
        <div className="text-xs p-2.5 rounded-lg mb-3" style={{ background: "oklch(0.95 0.04 85)", border: "1px solid oklch(0.85 0.08 85)", color: "oklch(0.4 0.1 85)" }}>
          <strong>修正模式：</strong>
          点击牌可选择正确的牌 | 
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold mx-0.5" style={{ background: "oklch(0.55 0.15 240)", color: "white" }}>⇄</span>快速切换大小字 | 
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full mx-0.5" style={{ background: "oklch(0.55 0.2 25)" }}><Trash2 className="h-2.5 w-2.5 text-white" /></span>删除牌 | 
          底部<Plus className="h-3 w-3 inline mx-0.5" />添加漏识别的牌
        </div>
      )}

      {/* 分组展示手牌 */}
      <div className="space-y-3">
        {/* 小字组 */}
        {smallGroup.length > 0 && (
          <div>
            <div className="text-[10px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "oklch(0.5 0.08 195)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.6 0.1 195)" }}></span>
              小字（笔画少、字形简单）
              <span className="text-muted-foreground">— {smallGroup.length}张</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {smallGroup.map((item, di) => renderTile(item.tile, item.originalIndex, di))}
            </div>
          </div>
        )}

        {/* 大字组 */}
        {bigGroup.length > 0 && (
          <div>
            <div className="text-[10px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "oklch(0.45 0.1 240)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.5 0.12 240)" }}></span>
              大字（笔画多、有偏旁部首）
              <span className="text-muted-foreground">— {bigGroup.length}张</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bigGroup.map((item, di) => renderTile(item.tile, item.originalIndex, di))}
            </div>
          </div>
        )}

        {/* 鬼牌组 */}
        {ghostGroup.length > 0 && (
          <div>
            <div className="text-[10px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "oklch(0.45 0.15 350)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.55 0.2 350)" }}></span>
              鬼牌（飞飞）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ghostGroup.map((item, di) => renderTile(item.tile, item.originalIndex, di))}
            </div>
          </div>
        )}
      </div>

      {/* 添加牌按钮（编辑模式下显示） */}
      {editMode && (
        <div className="mt-3 pt-3 relative" style={{ borderTop: "1px dashed oklch(0.85 0.05 195)" }} ref={addPickerRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddPicker(!showAddPicker)}
            className="h-8 text-xs gap-1 w-full border-dashed"
            style={{ borderColor: "oklch(0.7 0.12 145)", color: "oklch(0.45 0.12 145)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            添加漏识别的牌（当前{stats.total}张，应为20-21张）
          </Button>
          
          {showAddPicker && (
            <div
              className="mt-2 p-3 rounded-xl border-2 shadow-lg"
              style={{ background: "white", borderColor: "oklch(0.7 0.1 145)" }}
            >
              <div className="text-[10px] text-muted-foreground mb-2">点击要添加的牌：</div>
              <div className="mb-2">
                <div className="text-[10px] font-medium mb-1" style={{ color: "oklch(0.5 0.08 195)" }}>小字：</div>
                <div className="flex flex-wrap gap-1">
                  {SMALL_TILES.map((t) => (
                    <button
                      key={t}
                      onClick={() => handleAddTile(t)}
                      className="px-2.5 py-1.5 rounded-lg text-sm font-bold border-2 transition-all hover:scale-110 active:scale-95"
                      style={{
                        borderColor: "oklch(0.8 0.05 195)",
                        background: "white",
                        color: isRedTile(t) ? "oklch(0.5 0.2 25)" : "inherit",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-2">
                <div className="text-[10px] font-medium mb-1" style={{ color: "oklch(0.45 0.1 240)" }}>大字：</div>
                <div className="flex flex-wrap gap-1">
                  {BIG_TILES.map((t) => (
                    <button
                      key={t}
                      onClick={() => handleAddTile(t)}
                      className="px-2.5 py-1.5 rounded-lg text-sm font-bold border-2 transition-all hover:scale-110 active:scale-95"
                      style={{
                        borderColor: "oklch(0.75 0.08 240)",
                        background: "oklch(0.96 0.02 240)",
                        color: isRedTile(t) ? "oklch(0.5 0.2 25)" : "oklch(0.35 0.08 240)",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium mb-1" style={{ color: "oklch(0.45 0.15 350)" }}>特殊：</div>
                <button
                  onClick={() => handleAddTile("鬼")}
                  className="px-2.5 py-1.5 rounded-lg text-sm font-bold border-2 transition-all hover:scale-110 active:scale-95"
                  style={{
                    borderColor: "oklch(0.65 0.15 350)",
                    background: "oklch(0.97 0.03 350)",
                    color: "oklch(0.45 0.2 350)",
                  }}
                >
                  鬼
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 数字分组统计（快速对比大小字） */}
      {stats.numGroups.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px dashed oklch(0.85 0.05 195)" }}>
          <div className="text-[10px] font-medium mb-1.5 text-muted-foreground">各数字牌数量统计（方便发现大小字混淆）：</div>
          <div className="flex flex-wrap gap-1">
            {stats.numGroups.map(({ num, small, smallCount, big, bigCount }) => {
              const total = smallCount + bigCount;
              const suspicious = total > 4; // 同数字大+小超过4张可能有问题
              return (
                <div
                  key={num}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border"
                  style={{
                    borderColor: suspicious ? "oklch(0.7 0.15 25)" : "oklch(0.88 0.03 195)",
                    background: suspicious ? "oklch(0.95 0.04 25)" : "oklch(0.97 0.01 195)",
                  }}
                >
                  {smallCount > 0 && (
                    <span className="font-bold" style={{ color: isRedTile(small) ? "oklch(0.5 0.2 25)" : "oklch(0.3 0 0)" }}>
                      {small}<span className="font-normal text-muted-foreground">x{smallCount}</span>
                    </span>
                  )}
                  {smallCount > 0 && bigCount > 0 && <span className="text-muted-foreground">/</span>}
                  {bigCount > 0 && (
                    <span className="font-bold" style={{ color: isRedTile(big) ? "oklch(0.5 0.2 25)" : "oklch(0.4 0.08 240)" }}>
                      {big}<span className="font-normal text-muted-foreground">x{bigCount}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Changed tiles summary */}
      {hasChanges && (
        <div className="text-xs p-2.5 rounded-lg mt-3" style={{ background: "oklch(0.95 0.04 55)", border: "1px solid oklch(0.85 0.08 55)", color: "oklch(0.4 0.1 55)" }}>
          <strong>已修改：</strong>
          {tiles.length !== editedTiles.length && (
            <span className="mx-1">牌数 {tiles.length}→{editedTiles.length}张</span>
          )}
          {editedTiles.map((tile, i) => {
            if (i < tiles.length && tile !== tiles[i]) {
              return (
                <span key={i} className="inline-flex items-center gap-0.5 mx-1">
                  <span className="line-through opacity-50">{tiles[i]}</span>
                  →
                  <span className="font-bold">{tile}</span>
                </span>
              );
            }
            return null;
          }).filter(Boolean)}
          {editedTiles.length > tiles.length && (
            <span className="mx-1">
              新增：{editedTiles.slice(tiles.length).map((t, i) => (
                <span key={`new-${i}`} className="font-bold mx-0.5" style={{ color: "oklch(0.45 0.15 145)" }}>+{t}</span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
