import { BookOpen, Zap, Calculator, Ghost, Layers } from "lucide-react";
import { useState } from "react";

const sections = [
  { id: "basics", label: "基本规则", icon: BookOpen },
  { id: "tiles", label: "牌面组成", icon: Layers },
  { id: "actions", label: "操作说明", icon: Zap },
  { id: "huxi", label: "胡息计算", icon: Calculator },
  { id: "feifei", label: "飞飞规则", icon: Ghost },
];

export default function Rules() {
  const [activeSection, setActiveSection] = useState("basics");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-7 w-7" style={{ color: "oklch(0.75 0.15 195)" }} />
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            规则百科
          </h1>
        </div>
        <p className="mono-label">GUILIN FEIFEI ZIPAI RULES ENCYCLOPEDIA</p>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === s.id
                ? "text-white"
                : "wireframe-card hover:border-primary/40"
            }`}
            style={
              activeSection === s.id
                ? { background: "oklch(0.45 0.15 240)" }
                : {}
            }
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSection === "basics" && <BasicsSection />}
      {activeSection === "tiles" && <TilesSection />}
      {activeSection === "actions" && <ActionsSection />}
      {activeSection === "huxi" && <HuxiSection />}
      {activeSection === "feifei" && <FeifeiSection />}
    </div>
  );
}

function BasicsSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card rounded-xl p-6">
        <div className="mono-label mb-3">[ OVERVIEW ] 游戏概述</div>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            桂林飞飞字牌是流行于广西桂林地区的一种字牌玩法，属于跑胡子的地方变体。
            游戏使用一副80张字牌，由两名玩家对战。核心特色是引入了<strong>"飞飞"（鬼牌/癞子）</strong>机制，
            飞飞可以替代任何一张牌，极大增加了组牌的灵活性和策略深度。
          </p>
          <p>
            胡牌条件为<strong>胡息达到10胡</strong>（区别于湖南标准的15胡），
            所有手牌必须组成合法的牌型组合（门子），才能宣布胡牌。
          </p>
        </div>
      </div>

      <div className="wireframe-card rounded-xl p-6">
        <div className="mono-label mb-3">[ FLOW ] 游戏流程</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: "01", title: "发牌", desc: "庄家21张，闲家20张。最后一张亮出作为挡底。" },
            { step: "02", title: "出牌", desc: "轮流摸牌出牌，可进行吃、碰、偎、提、跑等操作。" },
            { step: "03", title: "胡牌", desc: "胡息≥10且所有牌组成合法门子即可胡牌。" },
          ].map((item) => (
            <div key={item.step} className="p-4 rounded-lg border" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
              <div className="text-3xl font-black mb-2" style={{ color: "oklch(0.75 0.15 195)" }}>
                {item.step}
              </div>
              <div className="font-semibold mb-1">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TilesSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card rounded-xl p-6">
        <div className="mono-label mb-3">[ TILES ] 牌面组成（共80张）</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.75 0.15 195)" }} />
              小字（40张）
            </h3>
            <div className="flex flex-wrap gap-2">
              {["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"].map(
                (t) => (
                  <div
                    key={t}
                    className="w-10 h-14 rounded-lg flex items-center justify-center text-lg font-bold border-2"
                    style={{
                      borderColor: ["二", "七", "十"].includes(t)
                        ? "oklch(0.65 0.2 25)"
                        : "oklch(0.3 0 0)",
                      color: ["二", "七", "十"].includes(t)
                        ? "oklch(0.55 0.2 25)"
                        : "oklch(0.2 0 0)",
                      background: "oklch(0.98 0 0)",
                    }}
                  >
                    {t}
                  </div>
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              每种4张，红色：二、七、十 | 黑色：其余
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.75 0.15 350)" }} />
              大字（40张）
            </h3>
            <div className="flex flex-wrap gap-2">
              {["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"].map(
                (t) => (
                  <div
                    key={t}
                    className="w-10 h-14 rounded-lg flex items-center justify-center text-lg font-bold border-2"
                    style={{
                      borderColor: ["贰", "柒", "拾"].includes(t)
                        ? "oklch(0.65 0.2 25)"
                        : "oklch(0.3 0 0)",
                      color: ["贰", "柒", "拾"].includes(t)
                        ? "oklch(0.55 0.2 25)"
                        : "oklch(0.2 0 0)",
                      background: "oklch(0.98 0 0)",
                    }}
                  >
                    {t}
                  </div>
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              每种4张，红色：贰、柒、拾 | 黑色：其余
            </p>
          </div>
        </div>
      </div>

      <div className="wireframe-card rounded-xl p-6">
        <div className="mono-label mb-3">[ COMBOS ] 牌型说明</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                <th className="text-left py-2 px-3 font-semibold">牌型</th>
                <th className="text-left py-2 px-3 font-semibold">说明</th>
                <th className="text-left py-2 px-3 font-semibold">示例</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["顺子", "三张连续且大小相同的牌", "一二三、肆伍陆"],
                ["二七十", "特殊顺子组合", "二七十、贰柒拾"],
                ["对子", "两张完全相同的牌", "五五"],
                ["坎（扫）", "三张完全相同的牌", "五五五"],
                ["提（扫穿）", "四张完全相同的牌", "五五五五"],
                ["大小搭（绞牌）", "2大1小或2小1大的同数字牌", "捌捌八、十十拾"],
              ].map(([name, desc, example]) => (
                <tr key={name} className="border-b" style={{ borderColor: "oklch(0.92 0.01 240)" }}>
                  <td className="py-2 px-3 font-medium text-foreground">{name}</td>
                  <td className="py-2 px-3">{desc}</td>
                  <td className="py-2 px-3 font-mono text-xs">{example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ActionsSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card rounded-xl p-6">
        <div className="mono-label mb-3">[ ACTIONS ] 操作说明</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                <th className="text-left py-2 px-3 font-semibold">操作</th>
                <th className="text-left py-2 px-3 font-semibold">触发条件</th>
                <th className="text-left py-2 px-3 font-semibold">是否明示</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["吃", "上家打出的牌可与手中牌组成顺子/二七十/大小搭", "全部明示"],
                ["碰", "别人打出的牌与手中一对相同", "全部明示"],
                ["偎（扫）", "自己摸到的牌与手中一对相同", "不明示"],
                ["提（扫穿）", "起手四张相同 / 坎+自己摸到第四张", "摸牌不亮"],
                ["跑（开舵）", "手中有坎，别人打出第四张", "全部明示"],
                ["下比", "吃牌时手中有相同牌也能组成牌型", "必须一起亮出"],
              ].map(([name, trigger, show]) => (
                <tr key={name} className="border-b" style={{ borderColor: "oklch(0.92 0.01 240)" }}>
                  <td className="py-2 px-3 font-medium text-foreground">{name}</td>
                  <td className="py-2 px-3">{trigger}</td>
                  <td className="py-2 px-3">{show}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="wireframe-card-pink rounded-xl p-6">
        <div className="mono-label mb-3" style={{ color: "oklch(0.6 0.1 350)" }}>
          [ PRIORITY ] 操作优先级
        </div>
        <div className="flex items-center gap-2 flex-wrap text-sm font-medium">
          {["扫穿/扫", "胡牌", "开舵/碰", "吃"].map((item, i) => (
            <span key={item} className="flex items-center gap-2">
              <span
                className="px-3 py-1.5 rounded-lg"
                style={{
                  background: `oklch(${0.94 - i * 0.05} 0.02 ${195 + i * 40})`,
                  border: `1.5px solid oklch(${0.75 - i * 0.05} 0.15 ${195 + i * 40} / 50%)`,
                }}
              >
                {item}
              </span>
              {i < 3 && <span className="text-muted-foreground">&gt;</span>}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          扫穿、扫、开舵是强制规则。胡牌时可以不开舵。放炮必胡。
        </p>
      </div>
    </div>
  );
}

function HuxiSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card rounded-xl p-6 glow-cyan">
        <div className="mono-label mb-3">[ HUXI TABLE ] 胡息计算表</div>
        <p className="text-sm text-muted-foreground mb-4">
          胡息是字牌的核心计分单位。桂林飞飞玩法中，<strong>最低10胡息</strong>即可胡牌。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2" style={{ borderColor: "oklch(0.75 0.15 195)" }}>
                <th className="text-left py-2 px-3 font-bold">牌型</th>
                <th className="text-center py-2 px-3 font-bold">大字胡息</th>
                <th className="text-center py-2 px-3 font-bold">小字胡息</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["碰", "3", "1"],
                ["坎/偎（扫）", "6", "3"],
                ["跑（开舵）", "9", "6"],
                ["提（扫穿）", "12", "9"],
                ["一二三 / 壹贰叁", "3", "3"],
                ["二七十 / 贰柒拾", "3", "3"],
                ["其他顺子", "0", "0"],
                ["大小搭（绞牌）", "0", "0"],
              ].map(([name, big, small]) => (
                <tr key={name} className="border-b" style={{ borderColor: "oklch(0.92 0.01 240)" }}>
                  <td className="py-2.5 px-3 font-medium">{name}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded font-bold text-xs"
                      style={{
                        background: Number(big) > 0 ? "oklch(0.75 0.15 195 / 15%)" : "oklch(0.95 0 0)",
                        color: Number(big) > 0 ? "oklch(0.4 0.15 195)" : "oklch(0.6 0 0)",
                      }}
                    >
                      {big}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded font-bold text-xs"
                      style={{
                        background: Number(small) > 0 ? "oklch(0.75 0.15 350 / 15%)" : "oklch(0.95 0 0)",
                        color: Number(small) > 0 ? "oklch(0.5 0.15 350)" : "oklch(0.6 0 0)",
                      }}
                    >
                      {small}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="wireframe-card rounded-xl p-6">
        <div className="mono-label mb-3">[ FORMULA ] 结算公式</div>
        <div className="space-y-3 text-sm">
          <div className="p-3 rounded-lg font-mono text-xs" style={{ background: "oklch(0.96 0.005 240)" }}>
            <div>舵数 = (胡息 - 7) / 3</div>
            <div className="mt-1">胡牌分数 = 舵数 × 倍数</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              ["自摸胡", "基本舵数 × 2"],
              ["海底胡", "基本舵数 × 2"],
              ["天胡/地胡", "基本舵数 × 2"],
            ].map(([name, formula]) => (
              <div key={name} className="p-3 rounded-lg border text-center" style={{ borderColor: "oklch(0.85 0.05 195)" }}>
                <div className="font-semibold text-xs mb-1">{name}</div>
                <div className="text-xs text-muted-foreground font-mono">{formula}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeifeiSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card-pink rounded-xl p-6 glow-pink">
        <div className="mono-label mb-3" style={{ color: "oklch(0.6 0.1 350)" }}>
          [ FEIFEI ] 飞飞（鬼牌）规则
        </div>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            <strong>飞飞</strong>是桂林飞飞字牌的核心特色机制。飞飞即鬼牌（癞子），
            可以<strong>替代任何一张牌</strong>来组成合法的牌型。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {[
              {
                title: "万能替代",
                desc: "飞飞可以变成任何一张牌，用于组成顺子、碰、坎、绞牌等任何牌型。",
              },
              {
                title: "策略核心",
                desc: "合理使用飞飞是赢牌的关键。AI 会分析飞飞的最优使用方式。",
              },
              {
                title: "增加胡牌概率",
                desc: "飞飞的存在使得胡牌组合大幅增加，需要动态评估最优组合。",
              },
              {
                title: "对手推断",
                desc: "根据对手的出牌和操作，可以推断对手是否持有飞飞及其可能用途。",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-lg border"
                style={{ borderColor: "oklch(0.75 0.15 350 / 30%)" }}
              >
                <div className="font-semibold mb-1 flex items-center gap-2">
                  <Ghost className="h-4 w-4" style={{ color: "oklch(0.75 0.15 350)" }} />
                  {item.title}
                </div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
