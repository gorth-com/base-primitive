import { createElement, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@bprogress/next", () => ({
  AppProgressProvider: ({ children }: PropsWithChildren) =>
    createElement("section", { "data-native-progress": true }, children),
  Progress: ({ children }: PropsWithChildren) => children,
  Bar: () => createElement("i", { "data-progress-bar": true }),
  useProgress: () => ({ start: state.start, stop: state.stop }),
}));
vi.mock("@/components/custom/toast", () => ({
  Toaster: ({ children }: PropsWithChildren) => children,
  toast: { add: state.toast },
}));
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/providers/theme", () => ({
  ThemeProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/providers/font", () => ({
  FontProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/providers/direction", () => ({
  DirectionProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/providers/layout", () => ({
  LayoutProvider: ({ children }: PropsWithChildren) => children,
}));

import { ApplicationProvider } from "@/providers/application";
import { useProgress, type ProgressValue } from "@/hooks/use-progress";

function renderApplication() {
  let progress!: ProgressValue;
  function Consumer() {
    progress = useProgress();
    return createElement("button", { disabled: progress.pending }, "Save");
  }
  const html = renderToStaticMarkup(
    createElement(ApplicationProvider, null, createElement(Consumer)),
  );
  return { progress, html };
}

beforeEach(() => vi.clearAllMocks());

it("supplies the action hook through ApplicationProvider without an app-owned wrapper", async () => {
  const { progress, html } = renderApplication();
  expect(html.match(/data-native-progress=/g)).toHaveLength(1);
  expect(html.match(/data-progress-bar=/g)).toHaveLength(1);
  expect(Object.keys(progress).sort()).toEqual([
    "fail",
    "finish",
    "pending",
    "run",
    "start",
    "stop",
  ]);
  expect(progress.pending).toBe(false);
  expect(await progress.run(async () => "saved")).toBe("saved");
  expect(state.start).toHaveBeenCalledOnce();
  expect(state.stop).toHaveBeenCalledOnce();
});

it("uses the existing toast manager and unlocks after a failed action", async () => {
  const { progress } = renderApplication();
  await progress.run(() => Promise.reject(new Error("private diagnostics")));
  expect(state.toast).toHaveBeenCalledOnce();
  expect(JSON.stringify(state.toast.mock.calls)).not.toContain(
    "private diagnostics",
  );
  expect(progress.start()).toBe(true);
  progress.finish();
});

it("reports a missing application boundary clearly", () => {
  function Outside() {
    useProgress();
    return null;
  }
  expect(() => renderToStaticMarkup(createElement(Outside))).toThrow(
    "ApplicationProvider",
  );
});
