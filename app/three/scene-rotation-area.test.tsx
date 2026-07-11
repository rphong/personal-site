import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SceneRotationArea } from "./scene-rotation-area";

const desktop = { top: 10, right: 8, bottom: 12, left: 40 };
const mobile = { top: 8, right: 8, bottom: 45, left: 8 };

function malformedPointerEvent(
  type: string,
  init: PointerEventInit,
  overrides: Partial<Pick<PointerEvent, "clientX" | "clientY" | "pointerId">>,
) {
  const event = new PointerEvent(type, { bubbles: true, ...init });
  for (const [property, value] of Object.entries(overrides)) {
    Object.defineProperty(event, property, { value });
  }
  return event;
}

describe("SceneRotationArea", () => {
  it("forwards mouse yaw and pitch deltas", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");

    fireEvent.pointerDown(area, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(area, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 120,
      clientY: 92,
    });

    expect(onDelta).toHaveBeenCalledWith(20, -8, true);
    expect(area.style.getPropertyValue("--rotation-top")).toBe("10%");
    expect(area.style.getPropertyValue("--rotation-mobile-bottom")).toBe(
      "45%",
    );
    expect(area).toHaveAttribute("aria-hidden", "true");
  });

  it("locks vertical touch gestures and forwards horizontal touch yaw only", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");

    fireEvent.pointerDown(area, {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(area, {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 102,
      clientY: 140,
    });
    expect(onDelta).not.toHaveBeenCalled();

    fireEvent.pointerMove(area, {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 132,
      clientY: 142,
    });
    expect(onDelta).not.toHaveBeenCalled();

    fireEvent.pointerUp(area, {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
    });
    fireEvent.pointerDown(area, {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(area, {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: 132,
      clientY: 102,
    });
    expect(onDelta).toHaveBeenCalledWith(32, 0, false);
    expect(area).toHaveStyle({ touchAction: "pan-y pinch-zoom" });
    expect(area).not.toHaveAttribute("tabindex");
    expect(area).not.toHaveAttribute("role");
  });

  it("keeps touch jitter inside the slop and ignores competing pointers", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");

    fireEvent.pointerDown(area, {
      pointerId: 4,
      pointerType: "touch",
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(area, {
      pointerId: 4,
      pointerType: "touch",
      isPrimary: true,
      clientX: 14,
      clientY: 12,
    });
    fireEvent.pointerDown(area, {
      pointerId: 5,
      pointerType: "touch",
      isPrimary: false,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(area, {
      pointerId: 5,
      pointerType: "touch",
      isPrimary: false,
      clientX: 80,
      clientY: 20,
    });
    expect(onDelta).not.toHaveBeenCalled();

    fireEvent.pointerMove(area, {
      pointerId: 4,
      pointerType: "touch",
      isPrimary: true,
      clientX: 20,
      clientY: 12,
    });
    expect(onDelta).toHaveBeenCalledWith(10, 0, false);
  });

  it("ignores secondary mouse buttons and stops after cancel or capture loss", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");
    const setPointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => true);
    const releasePointerCapture = vi.fn();
    Object.defineProperties(area, {
      setPointerCapture: { configurable: true, value: setPointerCapture },
      hasPointerCapture: { configurable: true, value: hasPointerCapture },
      releasePointerCapture: {
        configurable: true,
        value: releasePointerCapture,
      },
    });

    fireEvent.pointerDown(area, {
      pointerId: 6,
      pointerType: "mouse",
      isPrimary: true,
      button: 2,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(area, {
      pointerId: 6,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 20,
      clientY: 20,
    });
    expect(onDelta).not.toHaveBeenCalled();
    expect(setPointerCapture).not.toHaveBeenCalled();

    fireEvent.pointerDown(area, {
      pointerId: 7,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    fireEvent.pointerCancel(area, {
      pointerId: 7,
      pointerType: "mouse",
      isPrimary: true,
    });
    expect(hasPointerCapture).toHaveBeenCalledWith(7);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    fireEvent.pointerMove(area, {
      pointerId: 7,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 30,
      clientY: 30,
    });
    expect(onDelta).not.toHaveBeenCalled();

    fireEvent.pointerDown(area, {
      pointerId: 8,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.lostPointerCapture(area, {
      pointerId: 8,
      pointerType: "mouse",
      isPrimary: true,
    });
    fireEvent.pointerMove(area, {
      pointerId: 8,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 40,
      clientY: 40,
    });
    expect(onDelta).not.toHaveBeenCalled();
  });

  it("keeps input usable when pointer-capture APIs throw", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");
    Object.defineProperties(area, {
      setPointerCapture: {
        configurable: true,
        value: vi.fn(() => {
          throw new DOMException("synthetic pointer");
        }),
      },
      hasPointerCapture: {
        configurable: true,
        value: vi.fn(() => {
          throw new DOMException("already released");
        }),
      },
    });

    expect(() => {
      fireEvent.pointerDown(area, {
        pointerId: 9,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      });
    }).not.toThrow();
    fireEvent.pointerMove(area, {
      pointerId: 9,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 15,
      clientY: 8,
    });
    expect(onDelta).toHaveBeenCalledWith(5, -2, true);
    expect(() => {
      fireEvent.pointerUp(area, {
        pointerId: 9,
        pointerType: "mouse",
        isPrimary: true,
      });
    }).not.toThrow();
  });

  it("ignores non-finite coordinates without poisoning the active pointer", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");

    fireEvent.pointerDown(area, {
      pointerId: 10,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent(
      area,
      malformedPointerEvent(
        "pointermove",
        {
          pointerId: 10,
          pointerType: "mouse",
          isPrimary: true,
          clientY: 20,
        },
        { clientX: Number.NaN },
      ),
    );
    expect(onDelta).not.toHaveBeenCalled();
    fireEvent.pointerMove(area, {
      pointerId: 10,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 15,
      clientY: 8,
    });
    expect(onDelta).toHaveBeenCalledWith(5, -2, true);

    fireEvent.pointerUp(area, {
      pointerId: 10,
      pointerType: "mouse",
      isPrimary: true,
    });
    fireEvent(
      area,
      malformedPointerEvent(
        "pointerdown",
        {
          pointerId: 11,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
        },
        { clientX: Number.POSITIVE_INFINITY },
      ),
    );
    fireEvent.pointerMove(area, {
      pointerId: 11,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 30,
      clientY: 0,
    });
    expect(onDelta).toHaveBeenCalledTimes(1);

    fireEvent(
      area,
      malformedPointerEvent(
        "pointerdown",
        {
          pointerId: 13,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          clientX: 0,
          clientY: 0,
        },
        { pointerId: Number.NaN },
      ),
    );
    fireEvent.pointerDown(area, {
      pointerId: 14,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 1,
      clientY: 1,
    });
    fireEvent.pointerMove(area, {
      pointerId: 14,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 3,
      clientY: 4,
    });
    expect(onDelta).toHaveBeenLastCalledWith(2, 3, true);
  });

  it("treats an unknown primary pointer type as fine-pointer input", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");

    fireEvent.pointerDown(area, {
      pointerId: 12,
      pointerType: "",
      isPrimary: true,
      button: 0,
      clientX: 4,
      clientY: 9,
    });
    fireEvent.pointerMove(area, {
      pointerId: 12,
      pointerType: "",
      isPrimary: true,
      clientX: 7,
      clientY: 5,
    });
    expect(onDelta).toHaveBeenCalledWith(3, -4, true);
  });

  it.each([
    ["non-finite", { ...desktop, top: Number.NaN }, mobile],
    ["overlapping", { ...desktop, left: 60, right: 40 }, mobile],
    ["out-of-range", desktop, { ...mobile, bottom: 101 }],
  ])("rejects %s rotation insets", (_label, invalidDesktop, invalidMobile) => {
    render(
      <div>
        <span>surrounding content</span>
        <SceneRotationArea
          desktop={invalidDesktop}
          mobile={invalidMobile}
          onDelta={vi.fn()}
        />
      </div>,
    );
    expect(screen.getByText("surrounding content")).toBeVisible();
    expect(screen.queryByTestId("scene-rotation-area")).not.toBeInTheDocument();
  });

  it("clears an active pointer while invalid insets fail closed", () => {
    const onDelta = vi.fn();
    const view = render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId("scene-rotation-area"), {
      pointerId: 20,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 0,
    });

    view.rerender(
      <SceneRotationArea
        desktop={{ ...desktop, left: 100 }}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    expect(screen.queryByTestId("scene-rotation-area")).not.toBeInTheDocument();

    view.rerender(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const restoredArea = screen.getByTestId("scene-rotation-area");
    fireEvent.pointerDown(restoredArea, {
      pointerId: 21,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 1,
      clientY: 1,
    });
    fireEvent.pointerMove(restoredArea, {
      pointerId: 21,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 4,
      clientY: 5,
    });
    expect(onDelta).toHaveBeenCalledWith(3, 4, true);
  });
});
