# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageFile


ImageFile.LOAD_TRUNCATED_IMAGES = True

TESSERACT_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]

TILE_ID_TO_NAME = {
    "yi_s": "一",
    "er_s": "二",
    "san_s": "三",
    "si_s": "四",
    "wu_s": "五",
    "liu_s": "六",
    "qi_s": "七",
    "ba_s": "八",
    "jiu_s": "九",
    "shi_s": "十",
    "yi_b": "壹",
    "er_b": "贰",
    "san_b": "叁",
    "si_b": "肆",
    "wu_b": "伍",
    "liu_b": "陆",
    "qi_b": "柒",
    "ba_b": "捌",
    "jiu_b": "玖",
    "shi_b": "拾",
    "ghost": "鬼",
}

NAME_TO_TILE_ID = {value: key for key, value in TILE_ID_TO_NAME.items()}
NAME_TO_TILE_ID["陸"] = "liu_b"

COUNTERPART_TILE_ID = {
    "yi_s": "yi_b",
    "yi_b": "yi_s",
    "er_s": "er_b",
    "er_b": "er_s",
    "san_s": "san_b",
    "san_b": "san_s",
    "si_s": "si_b",
    "si_b": "si_s",
    "wu_s": "wu_b",
    "wu_b": "wu_s",
    "liu_s": "liu_b",
    "liu_b": "liu_s",
    "qi_s": "qi_b",
    "qi_b": "qi_s",
    "ba_s": "ba_b",
    "ba_b": "ba_s",
    "jiu_s": "jiu_b",
    "jiu_b": "jiu_s",
    "shi_s": "shi_b",
    "shi_b": "shi_s",
}

TEMPLATE_LIBRARY_CACHE: tuple[list[dict], dict[str, Counter]] | None = None

COLOR_GROUPS = {
    "red": {"er_s", "qi_s", "shi_s", "er_b", "qi_b", "shi_b"},
    "black": {
        "yi_s",
        "san_s",
        "si_s",
        "wu_s",
        "liu_s",
        "ba_s",
        "jiu_s",
        "yi_b",
        "san_b",
        "si_b",
        "wu_b",
        "liu_b",
        "ba_b",
        "jiu_b",
    },
    "purple": {"ghost"},
}

CURRENT_TEMPLATE_LABELS = {
    0: "wu_b",
    1: "shi_b",
    2: "wu_s",
    3: "wu_b",
    4: "er_b",
    5: "liu_b",
    6: "qi_s",
    7: "jiu_b",
    8: "si_s",
    9: "yi_s",
    10: "ghost",
    11: "wu_b",
    12: "er_b",
    13: "liu_b",
    14: "qi_s",
    15: "ba_b",
    16: "san_s",
    17: "yi_b",
    18: "shi_s",
    19: "qi_b",
}

EXTRA_TEMPLATE_FILES = {
    "sample81c-0-0.png": "yi_b",
    "sample81c-0-1.png": "yi_b",
    "sample81c-0-2.png": "yi_b",
    "sample81c-1-0.png": "shi_s",
    "sample81c-1-1.png": "qi_s",
    "sample81c-1-2.png": "er_s",
    "sample81c-2-0.png": "ba_s",
    "sample81c-2-1.png": "ba_b",
    "sample81c-2-2.png": "ba_b",
    "sample81c-5-1.png": "wu_s",
    "sample81c-5-2.png": "wu_b",
    "sample81c-6-1.png": "san_s",
    "sample81c-6-2.png": "san_b",
    "sample81c-7-1.png": "shi_b",
    "sample81c-8-0.png": "jiu_s",
    "sample81c-8-1.png": "yi_s",
    "curr3-0-0.png": "wu_b",
    "curr3-0-1.png": "wu_b",
    "curr3-0-2.png": "wu_b",
    "curr3-1-1.png": "er_b",
    "curr3-1-2.png": "er_b",
    "curr3-2-1.png": "liu_b",
    "curr3-2-2.png": "liu_b",
    "curr3-3-2.png": "qi_s",
    "curr3-3-1.png": "qi_s",
    "curr3-4-1.png": "jiu_b",
    "curr3-4-0.png": "shi_b",
    "curr3-4-2.png": "ba_b",
    "curr3-5-0.png": "wu_s",
    "curr3-5-1.png": "si_s",
    "curr3-5-2.png": "san_s",
    "curr3-6-1.png": "yi_s",
    "curr3-6-2.png": "yi_b",
    "curr3-7-2.png": "shi_s",
    "curr3-8-2.png": "qi_b",
    "curr3-7-1.png": "ghost",
}

# Some single-tile OCR outputs are stable but not literal tile names.
EXTRA_OCR_ALIASES = {
    "挫": "shi_b",
    "礁": "shi_b",
    "狠": "shi_b",
    "抬": "shi_b",
    "鞭": "er_b",
    "荆": "er_b",
    "尤": "qi_s",
    "材": "liu_b",
    "酶": "liu_b",
    "璨": "jiu_b",
    "殊": "jiu_b",
    "加": "si_s",
    "可": "si_s",
    "外": "si_s",
    "朱": "ba_b",
}


def configure_tesseract() -> bool:
    for candidate in TESSERACT_CANDIDATES:
        if os.path.exists(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            return True
    return False


def load_image(path_like: str | Path) -> np.ndarray | None:
    path = Path(path_like)
    try:
        data = np.fromfile(str(path), dtype=np.uint8)
    except OSError:
        return None
    if data.size == 0:
        return None
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def emit(payload: dict) -> int:
    def to_json_safe(value):
        if isinstance(value, np.integer):
            return int(value)
        if isinstance(value, np.floating):
            return float(value)
        if isinstance(value, np.ndarray):
            return value.tolist()
        raise TypeError(f"Object of type {value.__class__.__name__} is not JSON serializable")

    print(json.dumps(payload, ensure_ascii=False, default=to_json_safe))
    return 0


def detect_tile_boxes(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    h, w = image.shape[:2]
    strategies = [
        (0.0, 1.0, 0.0, 1.0),
        (0.35, 1.0, 0.10, 0.92),
        (0.42, 1.0, 0.15, 0.92),
        (0.45, 1.0, 0.18, 0.92),
    ]

    best_boxes: list[tuple[int, int, int, int]] = []
    best_score = -10**9

    for y_start, y_end, x_start, x_end in strategies:
        x0 = int(w * x_start)
        x1 = int(w * x_end)
        y0 = int(h * y_start)
        y1 = int(h * y_end)
        roi = image[y0:y1, x0:x1]
        if roi.size == 0:
            continue

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        tile_mask = ((hsv[:, :, 1] < 55) & (hsv[:, :, 2] > 180)).astype(
            np.uint8
        ) * 255
        kernel = np.ones((3, 3), np.uint8)
        tile_mask = cv2.morphologyEx(tile_mask, cv2.MORPH_OPEN, kernel)

        num_labels, _, stats, _ = cv2.connectedComponentsWithStats(tile_mask, 8)
        boxes: list[tuple[int, int, int, int]] = []
        area_min = max(1200, int(roi.shape[0] * roi.shape[1] * 0.0018))
        width_min = max(40, int(roi.shape[1] * 0.025))
        height_min = max(80, int(roi.shape[0] * 0.18))

        for label in range(1, num_labels):
            x, y, box_w, box_h, area = stats[label]
            if area < area_min or box_w < width_min or box_h < height_min:
                continue
            center_y = y + box_h / 2
            if center_y < roi.shape[0] * 0.18:
                continue
            boxes.append((x + x0, y + y0, box_w, box_h))

        boxes.sort(key=lambda box: (box[1], box[0]))
        count = len(boxes)
        if count == 0:
            continue

        score = -abs(count - 20) * 8
        if 12 <= count <= 21:
            score += 50
        elif 8 <= count <= 24:
            score += 20

        median_height = float(np.median([box[3] for box in boxes]))
        score += int(median_height)

        if score > best_score:
            best_score = score
            best_boxes = boxes

    return best_boxes

def detect_component_boxes(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    h, w = image.shape[:2]
    strategies = [
        (0.30, 1.0, 0.06, 0.94),
        (0.35, 1.0, 0.10, 0.92),
        (0.42, 1.0, 0.15, 0.92),
        (0.45, 1.0, 0.18, 0.92),
    ]

    best_boxes: list[tuple[int, int, int, int]] = []
    best_score = -10**9

    for y_start, y_end, x_start, x_end in strategies:
        x0 = int(w * x_start)
        x1 = int(w * x_end)
        y0 = int(h * y_start)
        y1 = int(h * y_end)
        roi = image[y0:y1, x0:x1]
        if roi.size == 0:
            continue

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        tile_mask = ((hsv[:, :, 1] < 60) & (hsv[:, :, 2] > 175)).astype(np.uint8) * 255
        tile_mask = cv2.morphologyEx(tile_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        tile_mask = cv2.morphologyEx(tile_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

        num_labels, _, stats, _ = cv2.connectedComponentsWithStats(tile_mask, 8)
        boxes: list[tuple[int, int, int, int]] = []
        area_min = max(1200, int(roi.shape[0] * roi.shape[1] * 0.0018))
        width_min = max(36, int(roi.shape[1] * 0.022))
        height_min = max(76, int(roi.shape[0] * 0.16))

        for label in range(1, num_labels):
            x, y, box_w, box_h, area = stats[label]
            if area < area_min or box_w < width_min or box_h < height_min:
                continue

            center_y = y + box_h / 2.0
            bottom_y = y + box_h
            aspect_ratio = float(box_w) / float(max(1, box_h))
            fill_ratio = float(area) / float(max(1, box_w * box_h))

            if center_y < roi.shape[0] * 0.16:
                continue
            if bottom_y < roi.shape[0] * 0.42:
                continue
            if aspect_ratio > 1.18:
                continue
            if fill_ratio < 0.36:
                continue

            boxes.append((x + x0, y + y0, box_w, box_h))

        boxes.sort(key=lambda box: (box[0], box[1]))
        if not boxes:
            continue

        expanded_count = len(expand_stacked_boxes(boxes))
        median_height = float(np.median([box[3] for box in boxes]))
        median_aspect = float(np.median([box[2] / float(max(1, box[3])) for box in boxes]))

        score = float(median_height + expanded_count * 8)
        if 20 <= expanded_count <= 21:
            score += 90.0
        elif 18 <= expanded_count <= 24:
            score += 45.0
        elif 12 <= expanded_count <= 24:
            score += 20.0

        if 0.16 <= median_aspect <= 0.95:
            score += 12.0

        score -= abs(len(boxes) - 9) * 1.5

        if score > best_score:
            best_score = score
            best_boxes = boxes

    return best_boxes

def estimate_single_tile_size(
    boxes: list[tuple[int, int, int, int]]
) -> tuple[float, float]:
    if not boxes:
        return 0.0, 0.0

    widths = np.array([box[2] for box in boxes], dtype=np.float32)
    heights = np.array([box[3] for box in boxes], dtype=np.float32)

    base_width = float(np.percentile(widths, 25))
    base_height = float(np.min(heights))

    return max(base_width, 48.0), max(base_height, 64.0)


def split_box_by_projection(
    image: np.ndarray | None,
    box: tuple[int, int, int, int],
    base_height: float,
) -> list[tuple[int, int]]:
    if image is None:
        return []

    x, y, box_w, box_h = box
    crop = image[y : y + box_h, x : x + box_w]
    if crop.size == 0:
        return []

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    tile_mask = ((hsv[:, :, 1] < 70) & (hsv[:, :, 2] > 165)).astype(np.uint8) * 255
    tile_mask = cv2.morphologyEx(tile_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    signal = tile_mask.sum(axis=1).astype(np.float32) / 255.0
    if signal.size == 0 or float(signal.max()) <= 0.0:
        return []

    kernel_size = max(3, int(box_h * 0.04))
    if kernel_size % 2 == 0:
        kernel_size += 1
    kernel = np.ones(kernel_size, dtype=np.float32) / float(kernel_size)
    smooth = np.convolve(signal, kernel, mode="same")
    threshold = max(4.0, float(np.max(smooth) * 0.22))
    active = smooth > threshold

    runs: list[tuple[int, int]] = []
    start: int | None = None
    for index, is_active in enumerate(active):
        if is_active and start is None:
            start = index
        elif not is_active and start is not None:
            runs.append((start, index))
            start = None
    if start is not None:
        runs.append((start, len(active)))

    segments: list[tuple[int, int]] = []
    min_height = max(40, int(base_height * 0.38))
    for start_y, end_y in runs:
        run_h = end_y - start_y
        if run_h < min_height:
            continue
        pad = max(2, int(round(base_height * 0.03)))
        seg_y = max(0, start_y - pad)
        seg_h = min(box_h, end_y + pad) - seg_y
        segments.append((seg_y, max(48, seg_h)))

    if 2 <= len(segments) <= 4:
        return segments

    return []


def expand_stacked_boxes(
    boxes: list[tuple[int, int, int, int]],
    image: np.ndarray | None = None,
) -> list[dict]:
    if not boxes:
        return []

    _, base_height = estimate_single_tile_size(boxes)
    expanded: list[dict] = []

    for x, y, box_w, box_h in boxes:
        projection_segments = split_box_by_projection(
            image, (x, y, box_w, box_h), base_height
        )
        if projection_segments:
            segment_count = len(projection_segments)
            for index, (offset_y, split_h) in enumerate(projection_segments):
                expanded.append(
                    {
                        "box": (x, y + offset_y, box_w, split_h),
                        "segment_index": index,
                        "segment_count": segment_count,
                    }
                )
            continue

        stack_count = 1
        if base_height > 0:
            raw_units = box_h / base_height
            if raw_units >= 3.35:
                stack_count = 4
            elif raw_units >= 2.30:
                stack_count = 3
            elif raw_units >= 1.55:
                stack_count = 2

        if stack_count == 1:
            expanded.append(
                {
                    "box": (x, y, box_w, box_h),
                    "segment_index": 0,
                    "segment_count": 1,
                }
            )
            continue

        step = box_h / float(stack_count)
        overlap = max(2, int(round(base_height * 0.04)))

        for index in range(stack_count):
            start_y = int(round(y + step * index))
            end_y = int(round(y + step * (index + 1)))

            if index > 0:
                start_y -= overlap
            if index + 1 < stack_count:
                end_y += overlap

            start_y = max(y, start_y)
            end_y = min(y + box_h, end_y)
            split_h = max(48, end_y - start_y)
            expanded.append(
                {
                    "box": (x, start_y, box_w, split_h),
                    "segment_index": index,
                    "segment_count": stack_count,
                }
            )

    expanded.sort(key=lambda item: (item["box"][0], item["box"][1]))
    return expanded


def score_box_candidate(boxes: list[tuple[int, int, int, int]]) -> float:
    if not boxes:
        return -10**9

    expanded_count = len(expand_stacked_boxes(boxes))
    if expanded_count == 0:
        return -10**9

    widths = [box[2] for box in boxes]
    score = float(min(expanded_count, 24) * 6 - max(0, expanded_count - 24) * 12)
    score += float(min(len(boxes), 12) * 2)
    median_width = float(np.median(widths)) if widths else 0.0
    if 32.0 <= median_width <= 90.0:
        score += 10.0
    return score

def detect_projection_boxes(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    h, w = image.shape[:2]
    strategies = [
        (0.35, 1.0, 0.10, 0.92),
        (0.42, 1.0, 0.15, 0.92),
        (0.45, 1.0, 0.18, 0.92),
    ]

    best_boxes: list[tuple[int, int, int, int]] = []
    best_score = -10**9

    for y_start, y_end, x_start, x_end in strategies:
        x0 = int(w * x_start)
        x1 = int(w * x_end)
        y0 = int(h * y_start)
        y1 = int(h * y_end)
        roi = image[y0:y1, x0:x1]
        if roi.size == 0:
            continue

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        tile_mask = ((hsv[:, :, 1] < 55) & (hsv[:, :, 2] > 180)).astype(np.uint8) * 255
        tile_mask = cv2.morphologyEx(
            tile_mask,
            cv2.MORPH_OPEN,
            np.ones((3, 3), np.uint8),
        )

        signal = tile_mask.sum(axis=0).astype(np.float32) / 255.0
        if signal.size == 0 or float(signal.max()) <= 0.0:
            continue

        kernel_size = max(5, int(roi.shape[1] * 0.01))
        if kernel_size % 2 == 0:
            kernel_size += 1
        kernel = np.ones(kernel_size, dtype=np.float32) / float(kernel_size)
        smooth = np.convolve(signal, kernel, mode='same')
        threshold = max(10.0, float(np.max(smooth) * 0.22))
        active = smooth > threshold

        runs: list[tuple[int, int]] = []
        start: int | None = None
        for index, is_active in enumerate(active):
            if is_active and start is None:
                start = index
            elif not is_active and start is not None:
                runs.append((start, index))
                start = None
        if start is not None:
            runs.append((start, len(active)))

        boxes: list[tuple[int, int, int, int]] = []
        width_min = max(26, int(roi.shape[1] * 0.018))
        height_min = max(80, int(roi.shape[0] * 0.18))

        for start_x, end_x in runs:
            if end_x - start_x < width_min:
                continue

            segment = tile_mask[:, start_x:end_x]
            ys, xs = np.where(segment > 0)
            if len(xs) == 0:
                continue

            seg_y0 = int(ys.min())
            seg_y1 = int(ys.max()) + 1
            seg_h = seg_y1 - seg_y0
            if seg_h < height_min:
                continue

            pad_x = 2
            pad_y = 2
            abs_x = max(x0, x0 + start_x - pad_x)
            abs_y = max(y0, y0 + seg_y0 - pad_y)
            abs_w = min(w - abs_x, (end_x - start_x) + pad_x * 2)
            abs_h = min(h - abs_y, seg_h + pad_y * 2)
            boxes.append((int(abs_x), int(abs_y), int(abs_w), int(abs_h)))

        boxes.sort(key=lambda box: (box[0], box[1]))
        score = score_box_candidate(boxes)
        if score > best_score:
            best_score = score
            best_boxes = boxes

    return best_boxes


def select_candidate_boxes(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    candidates = [
        detect_tile_boxes(image),
        detect_component_boxes(image),
        detect_projection_boxes(image),
    ]

    best_boxes: list[tuple[int, int, int, int]] = []
    best_score = -10**9
    for boxes in candidates:
        score = score_box_candidate(boxes)
        if score > best_score:
            best_score = score
            best_boxes = boxes

    return best_boxes

def detect_embedded_game_boxes(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    green_mask = (
        (hsv[:, :, 0] >= 25)
        & (hsv[:, :, 0] <= 95)
        & (hsv[:, :, 1] >= 20)
        & (hsv[:, :, 2] >= 20)
        & (hsv[:, :, 2] <= 220)
    ).astype(np.uint8) * 255

    kernel_w = max(9, int(w * 0.015))
    kernel_h = max(9, int(h * 0.015))
    if kernel_w % 2 == 0:
        kernel_w += 1
    if kernel_h % 2 == 0:
        kernel_h += 1

    mask = cv2.morphologyEx(
        green_mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_w, kernel_h)),
    )
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best_boxes: list[tuple[int, int, int, int]] = []
    best_score = -10**9

    for contour in contours:
        x, y, box_w, box_h = cv2.boundingRect(contour)
        area = box_w * box_h
        if area < h * w * 0.03:
            continue

        aspect_ratio = float(box_w) / float(max(1, box_h))
        if aspect_ratio < 1.1 or aspect_ratio > 3.6:
            continue
        if y + box_h / 2.0 < h * 0.2:
            continue

        pad_x = max(8, int(box_w * 0.02))
        pad_y = max(8, int(box_h * 0.02))
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(w, x + box_w + pad_x)
        y1 = min(h, y + box_h + pad_y)
        crop = image[y0:y1, x0:x1]
        if crop.size == 0:
            continue

        crop_boxes = select_candidate_boxes(crop)
        if not crop_boxes:
            continue

        absolute_boxes = [
            (bx + x0, by + y0, bw, bh) for bx, by, bw, bh in crop_boxes
        ]
        expanded_count = len(expand_stacked_boxes(absolute_boxes))
        score = score_box_candidate(absolute_boxes)
        green_ratio = float(np.count_nonzero(green_mask[y0:y1, x0:x1])) / float(
            max(1, (y1 - y0) * (x1 - x0))
        )
        score += green_ratio * 100.0
        if 8 <= expanded_count <= 24:
            score += 20.0

        if score > best_score:
            best_score = score
            best_boxes = absolute_boxes

    return best_boxes


def normalize_glyph_mask(glyph_mask: np.ndarray) -> np.ndarray | None:
    ys, xs = np.where(glyph_mask > 0)
    if len(xs) == 0:
        return None

    y0, y1 = ys.min(), ys.max() + 1
    x0, x1 = xs.min(), xs.max() + 1
    glyph = glyph_mask[y0:y1, x0:x1]
    glyph_h, glyph_w = glyph.shape[:2]
    longest_side = max(glyph_h, glyph_w)
    if longest_side <= 0:
        return None

    canvas = np.zeros((64, 64), dtype=np.uint8)
    scale = 56.0 / float(longest_side)
    target_w = max(1, int(round(glyph_w * scale)))
    target_h = max(1, int(round(glyph_h * scale)))
    resized = cv2.resize(glyph, (target_w, target_h), interpolation=cv2.INTER_NEAREST)
    offset_x = (64 - target_w) // 2
    offset_y = (64 - target_h) // 2
    canvas[offset_y : offset_y + target_h, offset_x : offset_x + target_w] = resized
    return canvas


def select_target_component(
    red_mask: np.ndarray,
    purple_mask: np.ndarray,
    dark_mask: np.ndarray,
    focus_hint: float | None = None,
) -> tuple[str, np.ndarray | None, dict]:
    combined_mask = (red_mask | purple_mask | dark_mask).astype(np.uint8) * 255
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(combined_mask, 8)
    if num_labels <= 1:
        return "black", None, {"fill_ratio": 0.0, "aspect_ratio": 0.0}

    mask_h, mask_w = combined_mask.shape[:2]
    target_y = (focus_hint if focus_hint is not None else 0.5) * float(mask_h)
    best_label = 0
    best_score = -1.0

    for label in range(1, num_labels):
        x, y, box_w, box_h, area = stats[label]
        if area < 40 or box_w < 6 or box_h < 10:
            continue

        center_x = x + box_w / 2.0
        center_y = y + box_h / 2.0
        vertical_penalty = abs(center_y - target_y)
        center_penalty = abs(center_x - mask_w / 2.0)
        score = float(area) * 3.0 - vertical_penalty * 25.0 - center_penalty * 12.0
        if score > best_score:
            best_score = score
            best_label = label

    if best_label == 0:
        return "black", None, {"fill_ratio": 0.0, "aspect_ratio": 0.0}

    component_mask = labels == best_label
    ys, xs = np.where(component_mask)
    y0, y1 = ys.min(), ys.max() + 1
    x0, x1 = xs.min(), xs.max() + 1
    glyph = (component_mask[y0:y1, x0:x1].astype(np.uint8) * 255)
    normalized = normalize_glyph_mask(glyph)
    if normalized is None:
        return "black", None, {"fill_ratio": 0.0, "aspect_ratio": 0.0}

    red_count = int(np.logical_and(component_mask, red_mask).sum())
    purple_count = int(np.logical_and(component_mask, purple_mask).sum())
    dark_count = int(np.logical_and(component_mask, dark_mask).sum())
    if purple_count > max(red_count, dark_count):
        color = "purple"
    elif red_count > dark_count:
        color = "red"
    else:
        color = "black"

    glyph_h = y1 - y0
    glyph_w = x1 - x0
    fill_ratio = float((normalized > 0).sum()) / float(normalized.size)
    aspect_ratio = float(glyph_w) / float(max(1, glyph_h))
    return color, normalized, {
        "fill_ratio": fill_ratio,
        "aspect_ratio": aspect_ratio,
    }


def preprocess_crop(
    crop: np.ndarray,
    focus_hint: float | None = None,
) -> tuple[str, np.ndarray | None, dict]:
    h, w = crop.shape[:2]
    inner = crop[int(h * 0.06) : int(h * 0.86), int(w * 0.08) : int(w * 0.92)]
    hsv = cv2.cvtColor(inner, cv2.COLOR_BGR2HSV)

    red_mask = (
        ((hsv[:, :, 0] < 15) | (hsv[:, :, 0] > 160))
        & (hsv[:, :, 1] > 50)
        & (hsv[:, :, 2] > 40)
    )
    purple_mask = (
        (hsv[:, :, 0] > 120)
        & (hsv[:, :, 0] < 170)
        & (hsv[:, :, 1] > 40)
        & (hsv[:, :, 2] > 40)
    )
    dark_mask = (hsv[:, :, 2] < 140) & (hsv[:, :, 1] < 140)

    return select_target_component(red_mask, purple_mask, dark_mask, focus_hint)


def score_mask(left: np.ndarray, right: np.ndarray) -> float:
    left_mask = left > 0
    right_mask = right > 0
    union = np.logical_or(left_mask, right_mask).sum()
    if union == 0:
        return 0.0
    intersection = np.logical_and(left_mask, right_mask).sum()
    return float(intersection) / float(union)


def ocr_texts(glyph: np.ndarray | None) -> list[str]:
    # Template matching is the primary recognizer now. OCR fallback was the main
    # source of 10s+ latency and upload timeouts in local runtime.
    return []


def detect_remaining_tiles(image: np.ndarray) -> int:
    h, w = image.shape[:2]
    regions = [
        image[int(h * 0.00) : int(h * 0.22), int(w * 0.38) : int(w * 0.62)],
        image[int(h * 0.00) : int(h * 0.30), int(w * 0.34) : int(w * 0.66)],
    ]
    for region in regions:
        if region.size == 0:
            continue
        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        _, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)
        try:
            text = pytesseract.image_to_string(
                Image.fromarray(thresh),
                lang="eng",
                config="--psm 6 -c tessedit_char_whitelist=0123456789",
            )
        except Exception:
            text = ""
        numbers = [int(match) for match in re.findall(r"\d+", text)]
        for number in numbers:
            if 0 <= number <= 80:
                return number
    return 0


def register_template(
    templates: list[dict],
    alias_votes: dict[str, Counter],
    tile_id: str,
    color: str,
    glyph: np.ndarray | None,
    metrics: dict,
) -> None:
    if glyph is None:
        return

    templates.append(
        {
            "tile_id": tile_id,
            "color": color,
            "mask": glyph,
            "metrics": metrics,
        }
    )

    for text in ocr_texts(glyph):
        cleaned = text.strip()
        if cleaned:
            alias_votes[cleaned][tile_id] += 1


def build_template_library() -> tuple[list[dict], dict[str, Counter]]:
    global TEMPLATE_LIBRARY_CACHE
    if TEMPLATE_LIBRARY_CACHE is not None:
        return TEMPLATE_LIBRARY_CACHE

    root = Path(__file__).resolve().parent.parent
    debug_root = root / ".debug-artifacts"
    templates: list[dict] = []
    alias_votes: dict[str, Counter] = defaultdict(Counter)

    current_path = debug_root / "tile-roi.png"
    if current_path.exists():
        image = load_image(current_path)
        if image is not None:
            boxes = detect_tile_boxes(image)
            for index, tile_id in CURRENT_TEMPLATE_LABELS.items():
                if index >= len(boxes):
                    continue
                x, y, box_w, box_h = boxes[index]
                crop = image[y : y + box_h, x : x + box_w]
                color, glyph, metrics = preprocess_crop(crop)
                register_template(templates, alias_votes, tile_id, color, glyph, metrics)

    for filename, tile_id in EXTRA_TEMPLATE_FILES.items():
        image = load_image(debug_root / filename)
        if image is None:
            continue
        color, glyph, metrics = preprocess_crop(image)
        register_template(templates, alias_votes, tile_id, color, glyph, metrics)

    TEMPLATE_LIBRARY_CACHE = (templates, alias_votes)
    return TEMPLATE_LIBRARY_CACHE


def collect_template_scores(
    color: str, glyph: np.ndarray | None, templates: list[dict]
) -> dict[str, float]:
    if glyph is None:
        return {}

    scores: dict[str, float] = {}
    for template in templates:
        if template["color"] != color:
            continue
        tile_id = template["tile_id"]
        score = score_mask(glyph, template["mask"])
        scores[tile_id] = max(scores.get(tile_id, 0.0), score)
    return scores


def vote_from_text(
    text: str,
    color: str,
    alias_votes: dict[str, Counter],
) -> Counter:
    votes: Counter = Counter()
    allowed = COLOR_GROUPS[color]

    direct = NAME_TO_TILE_ID.get(text)
    if direct in allowed:
        votes[direct] += 6

    extra = EXTRA_OCR_ALIASES.get(text)
    if extra in allowed:
        votes[extra] += 4

    for tile_id, count in alias_votes.get(text, Counter()).items():
        if tile_id in allowed:
            votes[tile_id] += count * 3

    return votes


def classify_tile(
    color: str,
    glyph: np.ndarray | None,
    metrics: dict,
    templates: list[dict],
    alias_votes: dict[str, Counter],
    use_ocr: bool = True,
) -> tuple[str | None, list[str], float]:
    if color == "purple":
        return "ghost", [], 1.0

    allowed = set(COLOR_GROUPS[color])
    template_scores = collect_template_scores(color, glyph, templates)

    # Some screenshots tint tiles inconsistently; trust a near-exact template match
    # even when the coarse color bucket says otherwise.
    for tile_id, score in template_scores.items():
        if score >= 0.9:
            allowed.add(tile_id)

    ranked_templates = sorted(
        (
            (tile_id, score)
            for tile_id, score in template_scores.items()
            if tile_id in allowed
        ),
        key=lambda item: item[1],
        reverse=True,
    )
    best_template_tile = ranked_templates[0][0] if ranked_templates else None
    best_template_score = ranked_templates[0][1] if ranked_templates else 0.0
    second_template_score = ranked_templates[1][1] if len(ranked_templates) > 1 else 0.0

    if best_template_tile is not None:
        adjusted_template_tile = maybe_switch_counterpart(
            best_template_tile,
            color,
            metrics,
            template_scores,
            templates,
        )
        if best_template_score >= 0.78:
            return adjusted_template_tile, [], min(1.0, 0.55 + best_template_score * 0.5)
        if (
            best_template_score >= 0.66
            and best_template_score - second_template_score >= 0.08
        ):
            return adjusted_template_tile, [], min(1.0, 0.48 + best_template_score * 0.45)

    if not use_ocr:
        if best_template_tile is not None and best_template_score >= 0.52:
            adjusted_template_tile = maybe_switch_counterpart(
                best_template_tile,
                color,
                metrics,
                template_scores,
                templates,
            )
            return adjusted_template_tile, [], min(1.0, 0.38 + best_template_score * 0.5)
        return None, [], 0.0

    texts = ocr_texts(glyph)
    votes: Counter = Counter()

    for text in texts:
        votes.update(vote_from_text(text, color, alias_votes))

    fill_ratio = metrics.get("fill_ratio", 0.0)
    aspect_ratio = metrics.get("aspect_ratio", 0.0)
    if color == "black" and (fill_ratio < 0.14 or aspect_ratio > 1.8):
        votes["yi_s"] += 3

    candidate_ids = list(allowed)
    best_tile_id: str | None = None
    best_score = -1.0

    for tile_id in candidate_ids:
        template_score = template_scores.get(tile_id, 0.0)
        total_score = template_score * 10.0 + float(votes[tile_id])
        if total_score > best_score:
            best_score = total_score
            best_tile_id = tile_id

    if best_tile_id is None:
        return None, texts, 0.0

    best_tile_id = maybe_switch_counterpart(
        best_tile_id,
        color,
        metrics,
        template_scores,
        templates,
    )
    best_template_match = template_scores.get(best_tile_id, 0.0)
    if best_score <= 0.0 and best_template_match < 0.18:
        return None, texts, 0.0

    confidence = min(1.0, max(best_template_match, best_score / 10.0))
    return best_tile_id, texts, confidence


def metric_distance(metrics: dict, template_metrics: dict | None) -> float:
    if template_metrics is None:
        return 10**9

    fill_distance = abs(metrics.get("fill_ratio", 0.0) - template_metrics.get("fill_ratio", 0.0))
    aspect_distance = abs(metrics.get("aspect_ratio", 0.0) - template_metrics.get("aspect_ratio", 0.0))
    return fill_distance * 4.0 + aspect_distance * 1.5


def maybe_switch_counterpart(
    tile_id: str,
    color: str,
    metrics: dict,
    template_scores: dict[str, float],
    templates: list[dict],
) -> str:
    # Counterpart switching was over-correcting mixed big/small hands.
    return tile_id

def build_runtime_templates(results: list[dict]) -> list[dict]:
    templates: list[dict] = []

    for item in sorted(results, key=lambda current: current["confidence"], reverse=True):
        glyph = item.get("glyph")
        tile_id = item.get("tile_id")
        confidence = float(item.get("confidence", 0.0))
        if glyph is None or tile_id is None or confidence < 0.82:
            continue

        templates.append(
            {
                "tile_id": tile_id,
                "color": item["color"],
                "mask": glyph,
                "metrics": item.get("metrics", {}),
            }
        )

        if len(templates) >= 8:
            break

    return templates


def propagate_columns(results: list[dict]) -> None:
    if not results:
        return

    median_width = float(np.median([item["box"][2] for item in results]))
    column_groups: list[list[dict]] = []

    for item in sorted(results, key=lambda current: current["box"][0]):
        center_x = item["box"][0] + item["box"][2] / 2
        matched_group: list[dict] | None = None
        for group in column_groups:
            group_centers = [
                member["box"][0] + member["box"][2] / 2 for member in group
            ]
            if abs(center_x - float(np.median(group_centers))) <= median_width * 0.55:
                matched_group = group
                break
        if matched_group is None:
            matched_group = []
            column_groups.append(matched_group)
        matched_group.append(item)

    for group in column_groups:
        resolved = [
            item["tile_id"]
            for item in group
            if item["tile_id"] is not None and item["confidence"] >= 0.55
        ]
        if len(resolved) < 2:
            continue
        tile_id, count = Counter(resolved).most_common(1)[0]
        if count < 2:
            continue
        for item in group:
            if item["tile_id"] is None or item["confidence"] < 0.45:
                if tile_id in COLOR_GROUPS[item["color"]]:
                    item["tile_id"] = tile_id
                    item["confidence"] = max(item["confidence"], 0.55)


def recognize_image(image: np.ndarray) -> dict:
    primary_boxes = select_candidate_boxes(image)
    fallback_boxes = detect_embedded_game_boxes(image)

    primary_score = score_box_candidate(primary_boxes)
    fallback_score = score_box_candidate(fallback_boxes)
    source_boxes = primary_boxes
    candidate_source = "primary"

    if fallback_boxes:
        primary_expanded = len(expand_stacked_boxes(primary_boxes))
        fallback_expanded = len(expand_stacked_boxes(fallback_boxes))
        if fallback_score > primary_score + 12 or (
            primary_expanded < 8 and fallback_expanded >= 8
        ):
            source_boxes = fallback_boxes
            candidate_source = "embedded"

    boxes = expand_stacked_boxes(source_boxes)
    templates, alias_votes = build_template_library()

    results: list[dict] = []
    for candidate in boxes:
        x, y, box_w, box_h = candidate["box"]
        focus_hint = (candidate["segment_index"] + 0.5) / float(candidate["segment_count"])
        crop = image[y : y + box_h, x : x + box_w]
        color, glyph, metrics = preprocess_crop(crop, focus_hint)
        tile_id, texts, confidence = classify_tile(
            color, glyph, metrics, templates, alias_votes, use_ocr=False
        )
        results.append(
            {
                "box": (x, y, box_w, box_h),
                "color": color,
                "glyph": glyph,
                "metrics": metrics,
                "tile_id": tile_id,
                "confidence": confidence,
                "ocr_texts": texts[:6],
            }
        )

    runtime_templates = build_runtime_templates(results)
    boosted_templates = templates + runtime_templates if runtime_templates else templates

    if runtime_templates:
        for item in results:
            if item["tile_id"] is not None and item["confidence"] >= 0.72:
                continue

            tile_id, texts, confidence = classify_tile(
                item["color"],
                item["glyph"],
                item["metrics"],
                boosted_templates,
                alias_votes,
                use_ocr=False,
            )

            if tile_id is None:
                continue

            if item["tile_id"] is None or confidence >= item["confidence"] + 0.05:
                item["tile_id"] = tile_id
                item["confidence"] = confidence
                item["ocr_texts"] = texts[:6]

    propagate_columns(results)

    hand_tiles = [
        TILE_ID_TO_NAME[item["tile_id"]]
        for item in results
        if item["tile_id"] in TILE_ID_TO_NAME
    ]
    unresolved = [
        {
            "box": item["box"],
            "color": item["color"],
            "ocr": item["ocr_texts"],
        }
        for item in results
        if item["tile_id"] is None
    ]

    return {
        "handTiles": hand_tiles,
        "myExposedGroups": [],
        "opponentExposedGroups": [],
        "discardedTiles": [],
        "remainingTiles": detect_remaining_tiles(image),
        "myCurrentHuxi": 0,
        "opponentCurrentHuxi": 0,
        "actionButtons": "无",
        "isDealer": len(hand_tiles) >= 21,
        "debug": {
            "boxCount": len(boxes),
            "sourceBoxCount": len(source_boxes),
            "candidateSource": candidate_source,
            "unresolvedCount": len(unresolved),
            "unresolved": unresolved[:6],
        },
    }


def main() -> int:
    if "--healthcheck" in sys.argv:
        ok = configure_tesseract()
        return emit({"ok": ok, "tesseractConfigured": ok})

    if len(sys.argv) < 2:
        return emit({"ok": False, "error": "missing_image_path"})

    image_path = sys.argv[1]
    if not configure_tesseract():
        return emit({"ok": False, "error": "tesseract_not_found"})

    image = load_image(image_path)
    if image is None:
        return emit({"ok": False, "error": "unable_to_read_image"})

    recognition = recognize_image(image)
    return emit({"ok": True, "recognition": recognition})


if __name__ == "__main__":
    raise SystemExit(main())







