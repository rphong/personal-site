"use client";

import { Component, type ReactNode } from "react";
import type { SceneFailureReason } from "./types";

export function classifySceneError(error: unknown): SceneFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch|network|404|load failed/i.test(message)) return "fetch";
  if (/decode|parse|gltf|buffer|meshopt/i.test(message)) return "decode";
  return "unknown";
}

interface SceneErrorBoundaryProps {
  readonly resetKey: string;
  readonly onError: (reason: SceneFailureReason) => void;
  readonly children: ReactNode;
}

interface SceneErrorBoundaryState {
  readonly failed: boolean;
}

export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(classifySceneError(error));
  }

  componentDidUpdate(previous: SceneErrorBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
