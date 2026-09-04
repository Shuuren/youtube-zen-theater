#!/usr/bin/env python3
"""Exercise Zen mode toggles in an isolated Helium profile and check player geometry."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

from playwright.sync_api import BrowserContext, Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


DEFAULT_URL = "https://www.youtube.com/watch?v=EvCMaE94p1g"
DEFAULT_HELIUM = "/Applications/Helium.app/Contents/MacOS/Helium"
DEFAULT_TIMEOUT_MS = 45_000
DEFAULT_CYCLES = 4
DEFAULT_OUTPUT_DIR = Path("diagnostics/zen-toggle-resize")
GEOMETRY_TOLERANCE_PX = 3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL, help="YouTube watch URL to exercise")
    parser.add_argument("--helium", default=DEFAULT_HELIUM, help="Helium executable path")
    parser.add_argument("--cycles", type=int, default=DEFAULT_CYCLES, help="Number of out/in cycles")
    parser.add_argument("--timeout-ms", type=int, default=DEFAULT_TIMEOUT_MS, help="Navigation and wait timeout")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for failure screenshots and the JSON report",
    )
    return parser.parse_args()


def rect_is_viewport(rect: dict[str, float], viewport: dict[str, float]) -> bool:
    return all(
        abs(rect[field] - expected) <= GEOMETRY_TOLERANCE_PX
        for field, expected in (
            ("x", 0),
            ("y", 0),
            ("width", viewport["width"]),
            ("height", viewport["height"]),
        )
    )


def read_geometry(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        () => {
          const rect = (element) => {
            if (!element) return null;
            const bounds = element.getBoundingClientRect();
            return {
              x: bounds.x,
              y: bounds.y,
              top: bounds.top,
              left: bounds.left,
              right: bounds.right,
              bottom: bounds.bottom,
              width: bounds.width,
              height: bounds.height,
            };
          };

          const viewport = { width: window.innerWidth, height: window.innerHeight };
          const intersectionArea = (bounds) => {
            if (!bounds) return 0;
            const width = Math.max(0, Math.min(bounds.right, viewport.width) - Math.max(bounds.left, 0));
            const height = Math.max(0, Math.min(bounds.bottom, viewport.height) - Math.max(bounds.top, 0));
            return width * height;
          };
          const isVisible = (element) => {
            if (!element?.isConnected) return false;
            const bounds = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return bounds.width > 0 && bounds.height > 0 &&
              style.display !== 'none' && style.visibility !== 'hidden' &&
              style.opacity !== '0' && intersectionArea(bounds) > 0;
          };
          const describe = (element, selectors) => element ? {
            matchedSelectors: selectors.filter((selector) => element.matches(selector)),
            tagName: element.tagName.toLowerCase(),
            id: element.id,
            classes: typeof element.className === 'string' ? element.className : '',
          } : null;

          const playerSelectors = ['#movie_player', '.html5-video-player'];
          const playerCandidates = [...new Set(playerSelectors.flatMap((selector) => {
            return [...document.querySelectorAll(selector)];
          }))];
          const visiblePlayers = playerCandidates
            .filter(isVisible)
            .map((element) => ({ element, bounds: element.getBoundingClientRect() }))
            .sort((left, right) => intersectionArea(right.bounds) - intersectionArea(left.bounds));
          const player = visiblePlayers[0]?.element || null;

          const videoSelectors = ['video.html5-main-video', 'video'];
          const videoCandidates = player ? [...new Set(videoSelectors.flatMap((selector) => {
            return [...player.querySelectorAll(selector)];
          }))] : [];
          const visibleVideos = videoCandidates
            .filter(isVisible)
            .map((element) => ({ element, bounds: element.getBoundingClientRect() }))
            .sort((left, right) => intersectionArea(right.bounds) - intersectionArea(left.bounds));
          const video = visibleVideos[0]?.element || null;
          const computed = video ? getComputedStyle(video) : null;
          return {
            zenActive: document.documentElement.classList.contains('ytzt-watch-page'),
            theaterActive: Boolean(document.querySelector('ytd-watch-flexy[theater]')),
            playerCandidateCount: playerCandidates.length,
            visiblePlayerCandidateCount: visiblePlayers.length,
            videoCandidateCount: videoCandidates.length,
            visibleVideoCandidateCount: visibleVideos.length,
            chosenPlayer: describe(player, playerSelectors),
            chosenVideo: describe(video, videoSelectors),
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              visualWidth: window.visualViewport?.width ?? null,
              visualHeight: window.visualViewport?.height ?? null,
            },
            player: rect(player),
            video: rect(video),
            videoComputed: computed ? {
              width: computed.width,
              minWidth: computed.minWidth,
              maxWidth: computed.maxWidth,
              height: computed.height,
              minHeight: computed.minHeight,
              maxHeight: computed.maxHeight,
              top: computed.top,
              left: computed.left,
              transform: computed.transform,
              objectFit: computed.objectFit,
            } : null,
            intrinsicVideo: video ? {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
            } : null,
          };
        }
        """
    )


def geometry_is_valid(geometry: dict[str, Any]) -> bool:
    if not geometry["zenActive"] or not geometry["theaterActive"]:
        return False

    viewport = geometry["viewport"]
    player = geometry["player"]
    video = geometry["video"]
    if not player or not video:
        return False

    return rect_is_viewport(player, viewport) and rect_is_viewport(video, viewport)


def annotate_failure(page: Page, cycle: int, geometry: dict[str, Any]) -> None:
    page.evaluate(
        """
        ({ cycle, player, video }) => {
          document.querySelector('[data-ytzt-diagnostic-overlay]')?.remove();
          const overlay = document.createElement('div');
          overlay.dataset.ytztDiagnosticOverlay = 'true';
          Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '2147483647',
            pointerEvents: 'none',
          });

          const addOutline = (bounds, color, label) => {
            if (!bounds) return;
            const outline = document.createElement('div');
            Object.assign(outline.style, {
              position: 'fixed',
              boxSizing: 'border-box',
              left: `${bounds.left}px`,
              top: `${bounds.top}px`,
              width: `${bounds.width}px`,
              height: `${bounds.height}px`,
              border: `3px solid ${color}`,
            });
            outline.title = label;
            overlay.append(outline);
          };

          addOutline(player, '#ff3b30', `player ${player ? `${player.width}x${player.height} at ${player.left},${player.top}` : 'missing'}`);
          addOutline(video, '#0a84ff', `video ${video ? `${video.width}x${video.height} at ${video.left},${video.top}` : 'missing'}`);

          const label = document.createElement('pre');
          label.textContent = [
            `Zen resize diagnostic — cycle ${cycle}`,
            `viewport ${window.innerWidth}x${window.innerHeight}`,
            `player ${player ? `${Math.round(player.width)}x${Math.round(player.height)} at ${Math.round(player.left)},${Math.round(player.top)}` : 'missing'}`,
            `video ${video ? `${Math.round(video.width)}x${Math.round(video.height)} at ${Math.round(video.left)},${Math.round(video.top)}` : 'missing'}`,
          ].join('\\n');
          Object.assign(label.style, {
            position: 'fixed',
            top: '12px',
            left: '12px',
            margin: '0',
            padding: '8px 10px',
            color: '#fff',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '2px solid #ff3b30',
            borderRadius: '4px',
            font: '12px/1.4 monospace',
            whiteSpace: 'pre',
          });
          overlay.append(label);
          document.documentElement.append(overlay);
        }
        """,
        {"cycle": cycle, "player": geometry["player"], "video": geometry["video"]},
    )


def remove_failure_annotation(page: Page) -> None:
    page.evaluate("document.querySelector('[data-ytzt-diagnostic-overlay]')?.remove()")


def wait_for_zen(page: Page, active: bool, timeout_ms: int) -> None:
    page.wait_for_selector(
        "html.ytzt-watch-page",
        state="attached" if active else "detached",
        timeout=timeout_ms,
    )


def exercise(page: Page, cycles: int, timeout_ms: int, output_dir: Path) -> list[dict[str, Any]]:
    wait_for_zen(page, True, timeout_ms)
    page.wait_for_timeout(750)
    measurements: list[dict[str, Any]] = []

    for cycle in range(1, cycles + 1):
        page.keyboard.press("t")
        wait_for_zen(page, False, timeout_ms)
        page.wait_for_timeout(500)

        page.keyboard.press("t")
        wait_for_zen(page, True, timeout_ms)
        page.wait_for_timeout(750)

        geometry = read_geometry(page)
        result = {"cycle": cycle, **geometry, "valid": geometry_is_valid(geometry)}
        measurements.append(result)
        print(json.dumps(result, sort_keys=True), flush=True)

        if not result["valid"]:
            output_dir.mkdir(parents=True, exist_ok=True)
            screenshot = output_dir / f"cycle-{cycle:02d}-FAIL.png"
            annotate_failure(page, cycle, geometry)
            try:
                page.screenshot(path=str(screenshot), full_page=False)
            finally:
                remove_failure_annotation(page)
            print(f"FAIL cycle {cycle}: screenshot saved to {screenshot}", file=sys.stderr)

    return measurements


def main() -> int:
    args = parse_args()
    if args.cycles < 1:
        print("--cycles must be at least 1", file=sys.stderr)
        return 2

    extension_dir = Path(__file__).resolve().parents[1]
    helium_path = Path(args.helium)
    if not helium_path.is_file():
        print(f"Helium executable not found: {helium_path}", file=sys.stderr)
        return 2

    measurements: list[dict[str, Any]] = []
    try:
        with sync_playwright() as playwright:
            with tempfile.TemporaryDirectory(prefix="youtube-zen-playwright-") as profile_dir:
                context: BrowserContext = playwright.chromium.launch_persistent_context(
                    user_data_dir=profile_dir,
                    executable_path=str(helium_path),
                    headless=False,
                    viewport={"width": 1280, "height": 800},
                    args=[
                        "--disable-extensions-except=" + str(extension_dir),
                        "--load-extension=" + str(extension_dir),
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--disable-sync",
                    ],
                )
                try:
                    page = context.pages[0] if context.pages else context.new_page()
                    page.goto(args.url, wait_until="domcontentloaded", timeout=args.timeout_ms)
                    page.wait_for_selector("#movie_player video.html5-main-video", state="attached", timeout=args.timeout_ms)
                    measurements = exercise(page, args.cycles, args.timeout_ms, args.output_dir)
                finally:
                    context.close()
    except PlaywrightTimeoutError as error:
        print(f"BLOCKED: Helium/YouTube did not reach the expected state: {error}", file=sys.stderr)
        return 2
    except Exception as error:  # noqa: BLE001 - report launch/runtime blockers clearly
        print(f"BLOCKED: could not run Helium diagnostic: {error}", file=sys.stderr)
        return 2

    failures = [measurement for measurement in measurements if not measurement["valid"]]
    if failures:
        print(f"FAILED: {len(failures)} of {len(measurements)} Zen entries had non-viewport geometry", file=sys.stderr)
        return 1

    print(f"PASS: {len(measurements)} Zen toggle entries matched the viewport within {GEOMETRY_TOLERANCE_PX}px")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
