"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

const DynamicSceneRuntimeHost = dynamic(
  () =>
    import("./scene-runtime-host").then((module) => module.SceneRuntimeHost),
  {
    ssr: false,
    loading: () => null,
  },
);

class RuntimeSiblingErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SceneRuntimeBoundary() {
  return (
    <RuntimeSiblingErrorBoundary>
      <DynamicSceneRuntimeHost />
    </RuntimeSiblingErrorBoundary>
  );
}
