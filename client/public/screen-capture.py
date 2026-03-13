#!/usr/bin/env python3
"""
桂林飞飞字牌 AI 大师 - 实时截屏助手
=====================================
在电脑上运行此脚本，自动截取屏幕画面并上传到网站进行实时分析。

安装依赖：
  pip install pillow requests mss

使用方法：
  python screen-capture.py

首次运行会让你框选截图区域，之后每秒自动截取该区域并上传。
按 Ctrl+C 停止。
"""

import sys
import time
import base64
import io
import json
import argparse

try:
    import mss
    import mss.tools
except ImportError:
    print("❌ 缺少 mss 库，请运行: pip install mss")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("❌ 缺少 Pillow 库，请运行: pip install pillow")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("❌ 缺少 requests 库，请运行: pip install requests")
    sys.exit(1)


# ========== 配置 ==========
DEFAULT_SERVER = "https://3000-ih43vtt3pfg4spe6j94ow-38615715.sg1.manus.computer"
CAPTURE_INTERVAL = 0.8  # 截屏间隔（秒）
JPEG_QUALITY = 60       # JPEG压缩质量（越低越快）
MAX_WIDTH = 1280        # 最大宽度（缩放以加快上传）


def select_region():
    """让用户选择截图区域"""
    print("\n📐 请输入截图区域坐标（像素）：")
    print("   提示：可以用 Win+Shift+S 截图来确认坐标")
    print("   或者输入 'full' 截取整个屏幕\n")
    
    choice = input("输入 'full' 截取全屏，或按回车手动输入坐标: ").strip()
    
    if choice.lower() == 'full':
        return None  # 全屏
    
    try:
        left = int(input("  左边界 X: "))
        top = int(input("  上边界 Y: "))
        right = int(input("  右边界 X: "))
        bottom = int(input("  下边界 Y: "))
        return {"left": left, "top": top, "width": right - left, "height": bottom - top}
    except ValueError:
        print("⚠️ 输入无效，将截取全屏")
        return None


def capture_screen(sct, region=None):
    """截取屏幕并返回base64 JPEG"""
    if region:
        screenshot = sct.grab(region)
    else:
        # 截取主显示器
        monitor = sct.monitors[1]
        screenshot = sct.grab(monitor)
    
    # 转换为PIL Image
    img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
    
    # 缩放以加快上传
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        new_size = (MAX_WIDTH, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    
    # 转为JPEG base64
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    return f"data:image/jpeg;base64,{b64}"


def upload_frame(server_url, image_b64):
    """上传截图到服务器"""
    try:
        resp = requests.post(
            f"{server_url}/api/screen/upload",
            json={"image": image_b64},
            timeout=5,
        )
        return resp.json()
    except requests.exceptions.ConnectionError:
        return {"error": "连接失败，请检查服务器地址"}
    except Exception as e:
        return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="字牌AI大师 - 实时截屏助手")
    parser.add_argument("--server", default=DEFAULT_SERVER, help="服务器地址")
    parser.add_argument("--interval", type=float, default=CAPTURE_INTERVAL, help="截屏间隔（秒）")
    parser.add_argument("--quality", type=int, default=JPEG_QUALITY, help="JPEG质量 (1-100)")
    parser.add_argument("--full", action="store_true", help="直接全屏截取")
    args = parser.parse_args()

    print("=" * 50)
    print("  🀄 桂林飞飞字牌 AI 大师 - 实时截屏助手")
    print("=" * 50)
    print(f"\n📡 服务器: {args.server}")
    print(f"⏱️  间隔: {args.interval}秒")
    print(f"📊 质量: {args.quality}")
    
    # 选择截图区域
    region = None if args.full else select_region()
    
    if region:
        print(f"\n📐 截图区域: {region['left']},{region['top']} - {region['left']+region['width']},{region['top']+region['height']}")
    else:
        print("\n📐 截图区域: 全屏")
    
    print(f"\n🚀 开始实时截屏... (按 Ctrl+C 停止)\n")
    
    frame_count = 0
    skip_count = 0
    
    with mss.mss() as sct:
        try:
            while True:
                start = time.time()
                
                # 截屏
                image_b64 = capture_screen(sct, region)
                
                # 上传
                result = upload_frame(args.server, image_b64)
                
                elapsed = time.time() - start
                frame_count += 1
                
                if result.get("status") == "ok":
                    print(f"\r✅ 帧 #{frame_count} | 耗时 {elapsed:.2f}s | 已跳过 {skip_count} 帧", end="", flush=True)
                elif result.get("status") == "skipped":
                    skip_count += 1
                    print(f"\r⏭️  帧 #{frame_count} | 画面未变化 | 已跳过 {skip_count} 帧", end="", flush=True)
                elif result.get("error"):
                    print(f"\r❌ 帧 #{frame_count} | 错误: {result['error']}", end="", flush=True)
                
                # 等待下一帧
                sleep_time = max(0, args.interval - elapsed)
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
        except KeyboardInterrupt:
            print(f"\n\n🛑 已停止。共截取 {frame_count} 帧，跳过 {skip_count} 帧。")
            # 通知服务器停止
            try:
                requests.post(f"{args.server}/api/screen/stop", timeout=3)
            except:
                pass


if __name__ == "__main__":
    main()
