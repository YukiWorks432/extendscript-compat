import type { Plugin } from "rollup";

export interface CompatibilityOptions {
  /** EC-03の通知。既定値はwarn。errorはビルドを停止し、offは通知を省く。 */
  diagnostics?: "warn" | "error" | "off";
}

/** 圧縮・include展開の後、JSXBin化の前に優先順位とEC-06を補正する。 */
export function extendscriptCompat(options?: CompatibilityOptions): Plugin;
