import type { Plugin } from "rollup";

export interface CompatibilityOptions {
  /**
   * EC-03 notifications: warn by default; error stops the build, and off suppresses notifications.
   *
   * EC-03の通知。既定値はwarn。errorはビルドを停止し、offは通知を省く。
   */
  diagnostics?: "warn" | "error" | "off";
}

/**
 * Correct precedence, EC-03, and EC-06 after minification and include expansion, before JSXBin conversion.
 *
 * 圧縮・include展開の後、JSXBin化の前に優先順位・EC-03・EC-06を補正する。
 */
export function extendscriptCompat(options?: CompatibilityOptions): Plugin;
