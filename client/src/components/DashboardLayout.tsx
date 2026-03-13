import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl, hasOAuthLoginConfig } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  Camera,
  BookOpen,
  History,
  BarChart3,
  Swords,
  LogOut,
  PanelLeft,
  Brain,
  Gauge,
  Sparkles,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: Camera, label: "AI 牌局分析", path: "/" },
  { icon: BookOpen, label: "规则百科", path: "/rules" },
  { icon: History, label: "历史记录", path: "/history" },
  { icon: BarChart3, label: "数据报告", path: "/stats" },
  { icon: Swords, label: "虚拟对战", path: "/practice" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const loginUrl = getLoginUrl();
  const oauthConfigured = hasOAuthLoginConfig();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen blueprint-grid">
        <div className="wireframe-card rounded-[30px] p-10 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-6">
            <div className="mono-label px-3 py-1 rounded-full border status-pill">
              <span className="status-dot" />
              CONTROL ROOM ACCESS
            </div>
            <div className="flex items-center gap-3">
              <Brain
                className="h-10 w-10"
                style={{ color: "oklch(0.66 0.16 205)" }}
              />
              <h1 className="text-3xl font-black tracking-tight">
                字牌 AI 大师
              </h1>
            </div>
            <p className="mono-label text-center">
              GUILIN FEIFEI ZIPAI CONTROL ROOM
            </p>
            <p className="text-sm text-muted-foreground text-center">
              登录后即可使用牌局分析、历史复盘、数据报告与虚拟对战的完整工作台。
            </p>
            {!oauthConfigured ? (
              <div
                className="w-full rounded-lg border px-4 py-3 text-xs text-left"
                style={{
                  borderColor: "oklch(0.82 0.08 55)",
                  background: "oklch(0.96 0.03 55)",
                  color: "oklch(0.36 0.08 55)",
                }}
              >
                本地开发环境未配置 OAuth
                登录地址。页面已经可以正常打开，但登录按钮暂不可用。
              </div>
            ) : null}
          </div>
          <Button
            onClick={() => {
              if (!loginUrl) return;
              window.location.href = loginUrl;
            }}
            size="lg"
            className="w-full mt-8 shadow-lg hover:shadow-xl transition-all"
            disabled={!loginUrl}
          >
            {loginUrl ? "登录开始" : "未配置登录"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const runtimeStatusQuery = trpc.system.runtimeStatus.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const runtimeStatus = runtimeStatusQuery.data;
  const recognitionReady = runtimeStatus?.screenshotRecognitionEnabled ?? false;
  const engineLabel = runtimeStatus?.llmConfigured
    ? "AI recognition ready"
    : recognitionReady
      ? "Local OCR ready"
      : "Manual entry only";
  const engineTone = recognitionReady
    ? "status-pill"
    : "status-pill border-[oklch(0.82_0.08_55)] bg-[oklch(0.97_0.03_55)] text-[oklch(0.42_0.09_55)]";
  const runtimeLabel =
    runtimeStatus?.runtime === "local" ? "Local runtime" : "Runtime unknown";

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0 bg-white/55 backdrop-blur-xl supports-[backdrop-filter]:bg-white/55"
          disableTransition={isResizing}
        >
          <SidebarHeader className="px-3 py-4">
            <div className="wireframe-card rounded-[24px] p-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="mt-4 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Brain
                      className="h-5 w-5 shrink-0"
                      style={{ color: "oklch(0.66 0.16 205)" }}
                    />
                    <span className="font-bold tracking-tight truncate text-sm">
                      字牌 AI 大师
                    </span>
                  </div>
                  <div className="mono-label mt-2">Match Analysis Console</div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="status-dot" />
                    Engine online
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {!isCollapsed ? (
              <div className="px-4 pb-2 pt-1">
                <div className="mono-label">Workbench</div>
              </div>
            ) : null}
            <SidebarMenu className="px-3 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-11 rounded-2xl transition-all font-normal data-[active=true]:shadow-none"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            {!isCollapsed ? (
              <div className="wireframe-card rounded-[24px] p-3 mb-3">
                <div className="flex items-center gap-2">
                  <Gauge
                    className="h-4 w-4"
                    style={{ color: "oklch(0.62 0.15 160)" }}
                  />
                  <div className="text-xs font-semibold">分析工作台已就绪</div>
                </div>
                <div className="text-xs text-muted-foreground mt-2 leading-5">
                  在首页接入牌局画面，在历史和统计页回看你的决策变化。
                </div>
              </div>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <span className="tracking-tight text-foreground font-medium">
                  {activeMenuItem?.label ?? "菜单"}
                </span>
              </div>
            </div>
          </div>
        )}
        {!isMobile ? (
          <div className="sticky top-0 z-30 px-5 py-4">
            <div className="wireframe-card rounded-[26px] px-5 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="mono-label">
                  {activeMenuItem?.label ?? "字牌 AI 大师"}
                </div>
                <div className="text-base font-bold tracking-tight">
                  桂林飞飞字牌分析控制台
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="status-pill">
                  <span className="status-dot" />
                  {runtimeLabel}
                </span>
                <span
                  className={engineTone}
                  title={
                    runtimeStatus?.llmConfigured
                      ? "当前已启用云端截图 AI 识别"
                      : recognitionReady
                        ? "当前已启用本地 OCR 截图识别"
                        : "当前未启用截图识别，上传后会进入手动录入模式"
                  }
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {engineLabel}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <main className="flex-1 blueprint-grid min-h-screen pb-8">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
