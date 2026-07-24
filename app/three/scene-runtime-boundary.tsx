"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, type ReactNode } from "react";
import {
  sceneRuntimeTraceEnabled,
  subscribeSceneRuntimeTraceEnable,
} from "./scene-runtime-trace-core";
import { prepareSceneRuntimeTrace } from "./scene-runtime-trace-loader";

const DynamicSceneRuntimeHost = dynamic(
  async () => {
    const hostModule = import("./scene-runtime-host");
    if (sceneRuntimeTraceEnabled()) {
      await prepareSceneRuntimeTrace();
    }
    return (await hostModule).SceneRuntimeHost;
  },
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
  useEffect(
    () =>
      subscribeSceneRuntimeTraceEnable(() => {
        void prepareSceneRuntimeTrace();
      }),
    [],
  );

  return (
    <RuntimeSiblingErrorBoundary>
      <DynamicSceneRuntimeHost />
    </RuntimeSiblingErrorBoundary>
  );
}
