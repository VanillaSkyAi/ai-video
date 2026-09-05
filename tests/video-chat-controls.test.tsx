// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { FocusEvent, PointerEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImmersiveControls } from "../src/video-chat/use-immersive-controls";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("immersive controls", () => {
  it("stays visible paused, then hides after two seconds of playback", () => {
    const { result, rerender } = renderHook(({ playing }) => useImmersiveControls(playing, false), { initialProps: { playing: false } });
    advance(4000);
    expect(result.current.visible).toBe(true);
    rerender({ playing: true });
    advance(1999);
    expect(result.current.visible).toBe(true);
    advance(1);
    expect(result.current.visible).toBe(false);
    rerender({ playing: false });
    expect(result.current.visible).toBe(true);
  });

  it("restarts the idle period on activity even if already visible", () => {
    const { result } = renderHook(() => useImmersiveControls(true, false));
    advance(1500);
    act(() => result.current.reveal());
    advance(1500);
    expect(result.current.visible).toBe(true);
    advance(500);
    expect(result.current.visible).toBe(false);
    act(() => result.current.reveal());
    expect(result.current.visible).toBe(true);
    advance(2000);
    expect(result.current.visible).toBe(false);
  });

  it("keeps controls visible while a panel pins them", () => {
    const { result, rerender } = renderHook(({ pinned }) => useImmersiveControls(true, pinned), { initialProps: { pinned: false } });
    advance(2000);
    rerender({ pinned: true });
    advance(4000);
    expect(result.current.visible).toBe(true);
    rerender({ pinned: false });
    advance(1999);
    expect(result.current.visible).toBe(true);
    advance(1);
    expect(result.current.visible).toBe(false);
  });

  it("pins on control hover and restarts the timer on exit", () => {
    const { result } = renderHook(() => useImmersiveControls(true, false));
    act(() => result.current.onPointerEnter());
    advance(5000);
    expect(result.current.visible).toBe(true);
    act(() => result.current.onPointerLeave());
    advance(2000);
    expect(result.current.visible).toBe(false);
  });

  it("keeps controls visible across focus moves inside them", () => {
    const { result } = renderHook(() => useImmersiveControls(true, false));
    const bar = document.createElement("div");
    const button = document.createElement("button");
    bar.append(button);
    vi.spyOn(button, "matches").mockImplementation((selector) => selector === ":focus-visible");
    act(() => result.current.onFocusCapture({ target: button } as unknown as FocusEvent<HTMLElement>));
    act(() => result.current.onBlurCapture({ currentTarget: bar, relatedTarget: button } as unknown as FocusEvent<HTMLElement>));
    advance(5000);
    expect(result.current.visible).toBe(true);
    act(() => result.current.onBlurCapture({ currentTarget: bar, relatedTarget: null } as unknown as FocusEvent<HTMLElement>));
    advance(2000);
    expect(result.current.visible).toBe(false);
  });

  it("does not pin controls after pointer focus", () => {
    const { result } = renderHook(() => useImmersiveControls(true, false));
    const button = document.createElement("button");
    vi.spyOn(button, "matches").mockReturnValue(false);
    act(() => result.current.onPointerEnter());
    act(() => result.current.onFocusCapture({ target: button } as unknown as FocusEvent<HTMLElement>));
    act(() => result.current.onPointerLeave());
    advance(2000);
    expect(result.current.visible).toBe(false);
  });

  it("does not treat a touch pointer as a persistent hover", () => {
    const { result } = renderHook(() => useImmersiveControls(true, false));
    act(() => result.current.onPointerEnter({ pointerType: "touch" } as PointerEvent<HTMLElement>));
    advance(2000);
    expect(result.current.visible).toBe(false);
  });

  it("hides at first caption arrival despite a pointer left over Send, then reveals normally", () => {
    const { result, rerender } = renderHook(({ captions }) => useImmersiveControls(true, false, captions), { initialProps: { captions: false } });
    act(() => result.current.onPointerEnter());
    rerender({ captions: true });
    expect(result.current.visible).toBe(false);
    act(() => result.current.onPointerLeave());
    expect(result.current.visible).toBe(false);
    act(() => result.current.reveal());
    expect(result.current.visible).toBe(true);
    rerender({ captions: true });
    expect(result.current.visible).toBe(true);
    advance(2000);
    expect(result.current.visible).toBe(false);
  });

  it("stays hidden when caption arrival blurs pointer-focused Send", () => {
    const { result, rerender } = renderHook(({ captions }) => useImmersiveControls(true, false, captions), { initialProps: { captions: false } });
    const bar = document.createElement("div");
    const button = document.createElement("button");
    bar.append(button);
    vi.spyOn(button, "matches").mockReturnValue(false);
    act(() => result.current.onFocusCapture({ target: button } as unknown as FocusEvent<HTMLElement>));
    rerender({ captions: true });
    expect(result.current.visible).toBe(false);
    act(() => result.current.onBlurCapture({ currentTarget: bar, relatedTarget: null } as unknown as FocusEvent<HTMLElement>));
    expect(result.current.visible).toBe(false);
  });

  it("keeps editing or listening controls pinned when captions arrive", () => {
    const { result, rerender } = renderHook(({ captions, pinned }) => useImmersiveControls(true, pinned, captions), { initialProps: { captions: false, pinned: true } });
    rerender({ captions: true, pinned: true });
    expect(result.current.visible).toBe(true);
    advance(5000);
    expect(result.current.visible).toBe(true);
    rerender({ captions: true, pinned: false });
    advance(2000);
    expect(result.current.visible).toBe(false);
  });

  it("keeps keyboard focus visible when captions arrive", () => {
    const { result, rerender } = renderHook(({ captions }) => useImmersiveControls(true, false, captions), { initialProps: { captions: false } });
    const button = document.createElement("button");
    vi.spyOn(button, "matches").mockReturnValue(true);
    act(() => result.current.onFocusCapture({ target: button } as unknown as FocusEvent<HTMLElement>));
    rerender({ captions: true });
    advance(5000);
    expect(result.current.visible).toBe(true);
  });

  it("keeps paused controls visible when captions arrive", () => {
    const { result, rerender } = renderHook(({ captions }) => useImmersiveControls(false, false, captions), { initialProps: { captions: false } });
    rerender({ captions: true });
    advance(5000);
    expect(result.current.visible).toBe(true);
  });

  it("cleans up its timer on unmount", () => {
    const { unmount } = renderHook(() => useImmersiveControls(true, false));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
