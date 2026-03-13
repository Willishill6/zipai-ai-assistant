import {
  BookOpen,
  Zap,
  Calculator,
  Ghost,
  Layers,
  Shield,
  Crown,
} from "lucide-react";
import { useState } from "react";
import {
  MetricCard,
  PageHeader,
  PanelTitle,
} from "@/components/PagePrimitives";

const sections = [
  { id: "basics", label: "基本规则", icon: BookOpen },
  { id: "tiles", label: "牌面组成", icon: Layers },
  { id: "actions", label: "操作说明", icon: Zap },
  { id: "huxi", label: "胡息计算", icon: Calculator },
  { id: "feifei", label: "飞飞规则", icon: Ghost },
] as const;

const smallTiles = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const bigTiles = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"];

const actionRows = [
  {
    action: "吃",
    trigger: "上家打出的牌能与手中组成顺子、二七十或大小搭。",
    reveal: "全部明示",
  },
  {
    action: "碰",
    trigger: "别人打出的牌与手中一对相同。",
    reveal: "全部明示",
  },
  {
    action: "偎",
    trigger: "自己摸到的牌与手中一对相同。",
    reveal: "不明示",
  },
  {
    action: "提",
    trigger: "起手四张相同，或坎后再摸到第四张。",
    reveal: "摸牌时不亮",
  },
  {
    action: "跑",
    trigger: "手中已有坎，其他人再打出第四张。",
    reveal: "全部明示",
  },
  {
    action: "下比",
    trigger: "吃牌时手中还有相同结构，也必须一并亮出。",
    reveal: "必须同时亮牌",
  },
];

const huxiRows = [
  ["碰", "3", "1"],
  ["坎 / 偎", "6", "3"],
  ["跑", "9", "6"],
  ["提", "12", "9"],
  ["一二三 / 壹贰叁", "6", "3"],
  ["二七十 / 贰柒拾", "6", "3"],
  ["其他顺子", "0", "0"],
  ["大小搭", "0", "0"],
];

function TileChip({
  value,
  tone,
}: {
  value: string;
  tone: "small" | "big" | "ghost";
}) {
  const styles = {
    small: {
      background: "white",
      borderColor: "oklch(0.84 0.05 205)",
      color: "二七十".includes(value) ? "oklch(0.52 0.18 25)" : "oklch(0.2 0 0)",
    },
    big: {
      background: "oklch(0.96 0.02 235)",
      borderColor: "oklch(0.78 0.06 235)",
      color: "贰柒拾".includes(value) ? "oklch(0.52 0.18 25)" : "oklch(0.34 0.08 235)",
    },
    ghost: {
      background: "oklch(0.96 0.03 350)",
      borderColor: "oklch(0.78 0.08 350)",
      color: "oklch(0.42 0.14 350)",
    },
  }[tone];

  return (
    <span
      className="inline-flex h-11 w-9 items-center justify-center rounded-xl border text-base font-bold shadow-sm"
      style={styles}
    >
      {value}
    </span>
  );
}

function InfoList({
  items,
}: {
  items: { title: string; desc: string }[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="wireframe-card rounded-[24px] p-4">
          <div className="text-sm font-bold tracking-tight">{item.title}</div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            {item.desc}
          </div>
        </div>
      ))}
    </div>
  );
}

function BasicsSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card rounded-[28px] p-5 md:p-6">
        <PanelTitle
          icon={BookOpen}
          kicker="Overview"
          title="桂林飞飞字牌怎么玩"
        />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              桂林飞飞字牌是跑胡子的地方变体，两人对局，使用一副
              <strong className="text-foreground"> 80 张字牌</strong>。它最鲜明的差别是加入了
              <strong className="text-foreground">“飞飞”</strong> 机制，也就是鬼牌。
            </p>
            <p>
              目标不是单纯凑牌，而是让所有手牌最终都能组成合法门子，同时让
              <strong className="text-foreground"> 胡息达到 10 胡</strong>。这使得组牌与安全判断同样重要。
            </p>
          </div>
          <div className="wireframe-card rounded-[24px] p-4">
            <div className="mono-label mb-3">Round Flow</div>
            <div className="space-y-3">
              {[
                ["01", "发牌", "庄家 21 张，闲家 20 张。"],
                ["02", "行牌", "轮流摸牌出牌，视牌型执行吃碰偎提跑。"],
                ["03", "成胡", "门子完整且胡息达到 10 胡即可。"],
              ].map(([step, title, desc]) => (
                <div key={step} className="flex gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
                    style={{
                      background: "oklch(0.95 0.03 205)",
                      color: "oklch(0.36 0.1 210)",
                    }}
                  >
                    {step}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{title}</div>
                    <div className="text-xs leading-5 text-muted-foreground">
                      {desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <InfoList
        items={[
          {
            title: "庄闲差别",
            desc: "庄家起手 21 张，闲家起手 20 张，这会直接影响截图识别和手动录入时的牌数判断。",
          },
          {
            title: "门子要求",
            desc: "手牌不能只看局部顺眼，最终必须收束成合法门子，否则胡息再高也不能胡牌。",
          },
          {
            title: "防守价值",
            desc: "点炮惩罚很重，残局阶段往往不是追最高胡息，而是先避免给对手放炮。",
          },
          {
            title: "飞飞博弈",
            desc: "鬼牌能补顺子、补坎，也能改善听牌宽度，何时兑现价值是核心判断点。",
          },
        ]}
      />
    </div>
  );
}

function TilesSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card rounded-[28px] p-5 md:p-6">
        <PanelTitle
          icon={Layers}
          kicker="Tiles"
          title="牌面组成与观察重点"
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="wireframe-card rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">小字 40 张</div>
                <div className="text-xs text-muted-foreground">
                  笔画少，识别时更容易和大字混淆。
                </div>
              </div>
              <span className="status-pill">红字：二 七 十</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {smallTiles.map((tile) => (
                <TileChip key={tile} value={tile} tone="small" />
              ))}
            </div>
          </div>

          <div className="wireframe-card rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">大字 40 张</div>
                <div className="text-xs text-muted-foreground">
                  笔画多，有偏旁部首，识别价值更高。
                </div>
              </div>
              <span className="status-pill">红字：贰 柒 拾</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {bigTiles.map((tile) => (
                <TileChip key={tile} value={tile} tone="big" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="wireframe-card rounded-[28px] p-5 md:p-6">
        <div className="mono-label mb-3">Shape Language</div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="wireframe-card rounded-[22px] p-4">
            <div className="text-sm font-bold">顺子</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">
              同类三张连续数字，例如“一二三”或“壹贰叁”。
            </div>
          </div>
          <div className="wireframe-card rounded-[22px] p-4">
            <div className="text-sm font-bold">坎 / 提 / 跑</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">
              同牌三张为坎，四张升级为提或跑，通常也是胡息大头来源。
            </div>
          </div>
          <div className="wireframe-card rounded-[22px] p-4">
            <div className="text-sm font-bold">大小搭</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">
              同数字的大字与小字可以混搭成组，但本身不产生胡息。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionsSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card rounded-[28px] p-5 md:p-6">
        <PanelTitle
          icon={Zap}
          kicker="Actions"
          title="吃碰偎提跑的触发方式"
        />
        <div className="overflow-hidden rounded-[22px] border border-border bg-white/60">
          {actionRows.map((row) => (
            <div
              key={row.action}
              className="data-table-row grid gap-3 px-4 py-4 md:grid-cols-[120px_1fr_140px]"
            >
              <div className="text-sm font-bold">{row.action}</div>
              <div className="text-sm leading-6 text-muted-foreground">
                {row.trigger}
              </div>
              <div className="text-sm font-medium text-foreground/80">
                {row.reveal}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wireframe-card-pink rounded-[28px] p-5 md:p-6">
        <PanelTitle
          icon={Shield}
          kicker="Priority"
          title="操作优先级"
          tone="rose"
        />
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {["提 / 坎", "胡牌", "跑 / 碰", "吃牌"].map((item, index) => (
            <div key={item} className="flex items-center gap-2">
              <span
                className="rounded-full px-4 py-2"
                style={{
                  background: `oklch(${0.95 - index * 0.03} 0.03 ${220 - index * 35})`,
                  border: `1px solid oklch(${0.82 - index * 0.03} 0.07 ${220 - index * 35} / 65%)`,
                }}
              >
                {item}
              </span>
              {index < 3 ? <span className="text-muted-foreground">→</span> : null}
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm leading-6 text-muted-foreground">
          提、坎和跑通常是强制性或半强制性动作。实战里更值得注意的是，
          当对手胡息已经接近门槛时，是否还要冒风险去追自己的最快拆法。
        </div>
      </div>
    </div>
  );
}

function HuxiSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card rounded-[28px] p-5 md:p-6">
        <PanelTitle
          icon={Calculator}
          kicker="Scoring"
          title="胡息表与结算思路"
        />
        <div className="overflow-hidden rounded-[22px] border border-border bg-white/60">
          <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <div>牌型</div>
            <div className="text-center">大字</div>
            <div className="text-center">小字</div>
          </div>
          {huxiRows.map(([name, big, small]) => (
            <div
              key={name}
              className="data-table-row grid grid-cols-[1.2fr_0.9fr_0.9fr] gap-3 px-4 py-4"
            >
              <div className="text-sm font-medium">{name}</div>
              <div className="text-center">
                <span className="status-pill">{big}</span>
              </div>
              <div className="text-center">
                <span className="status-pill">{small}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          icon={Crown}
          label="Win Threshold"
          value="10 胡"
          hint="桂林飞飞字牌的起胡线低于很多传统跑胡子变体。"
          tone="amber"
        />
        <MetricCard
          icon={Calculator}
          label="基础公式"
          value="舵数 = (胡息 - 7) / 3"
          hint="记住胡息只是中间量，真正结算还要乘倍数。"
          tone="cyan"
        />
        <MetricCard
          icon={Zap}
          label="常见加成"
          value="自摸 / 海底 / 天胡"
          hint="这些额外条件会让实际得分继续放大。"
          tone="rose"
        />
      </div>
    </div>
  );
}

function FeifeiSection() {
  return (
    <div className="space-y-4">
      <div className="wireframe-card-pink rounded-[28px] p-5 md:p-6">
        <PanelTitle
          icon={Ghost}
          kicker="Feifei"
          title="飞飞是这套玩法的策略核心"
          tone="rose"
        />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="wireframe-card rounded-[24px] p-4">
            <div className="mono-label mb-3">Wildcard</div>
            <div className="flex items-center gap-3">
              <TileChip value="鬼" tone="ghost" />
              <div className="text-sm leading-6 text-muted-foreground">
                飞飞可以替代任意一张牌，用来补顺、补坎、冲听口，往往决定整副牌的上限。
              </div>
            </div>
          </div>

          <InfoList
            items={[
              {
                title: "万能替代",
                desc: "它不局限于某一类牌，能够在不同拆法之间来回切换，让同一手牌出现多条最优路线。",
              },
              {
                title: "提升听牌宽度",
                desc: "有时飞飞不该直接换成最高胡息，而是应该补成更宽的听口，给后续来牌留空间。",
              },
              {
                title: "影响对手判断",
                desc: "对手无法准确知道鬼牌落点，所以残局里飞飞经常也会改变安全牌排序。",
              },
              {
                title: "AI 价值点",
                desc: "你的分析页会把鬼牌所有替代方案列出来，这也是判断 AI 是否拆得合理的关键证据。",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default function Rules() {
  const [activeSection, setActiveSection] =
    useState<(typeof sections)[number]["id"]>("basics");

  return (
    <div className="app-page">
      <PageHeader
        icon={BookOpen}
        eyebrow="Rules Encyclopedia"
        title="规则百科"
        description="把牌面结构、操作优先级、胡息计算和飞飞机制收拢成一套清晰的参考面板，方便你在分析页和对战页之间来回对照。"
        chips={[
          { label: "80 张字牌", tone: "cyan" },
          { label: "10 胡起胡", tone: "amber" },
          { label: "飞飞万能替牌", tone: "rose" },
        ]}
      />

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={Layers}
          label="Deck"
          value="80 张"
          hint="小字 40 张 + 大字 40 张，红字分布固定。"
          tone="cyan"
        />
        <MetricCard
          icon={Calculator}
          label="Threshold"
          value="10 胡"
          hint="门子完整且胡息达标才算真正成胡。"
          tone="amber"
        />
        <MetricCard
          icon={Ghost}
          label="Wildcard"
          value="飞飞"
          hint="鬼牌能拉高拆法上限，也是 AI 推演的重点。"
          tone="rose"
        />
      </div>

      <div className="wireframe-card rounded-[28px] p-3 mt-5">
        <div className="control-strip">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                activeSection === section.id ? "text-white" : ""
              }`}
              style={
                activeSection === section.id
                  ? { background: "oklch(0.45 0.15 240)" }
                  : {
                      background: "oklch(0.985 0.008 220 / 92%)",
                      border: "1px solid oklch(0.86 0.03 220 / 90%)",
                    }
              }
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {activeSection === "basics" && <BasicsSection />}
        {activeSection === "tiles" && <TilesSection />}
        {activeSection === "actions" && <ActionsSection />}
        {activeSection === "huxi" && <HuxiSection />}
        {activeSection === "feifei" && <FeifeiSection />}
      </div>
    </div>
  );
}
