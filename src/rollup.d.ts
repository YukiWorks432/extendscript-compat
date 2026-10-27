import type { Plugin } from "rollup";

export interface CompatibilityOptions {
  /**
   * EC-03 and unsupported Number reference notifications: warn by default; error stops the build, and off suppresses notifications.
   *
   * EC-03と自動補正できないNumber参照の通知。既定値はwarn。errorはビルドを停止し、offは通知を省く。
   */
  diagnostics?: "warn" | "error" | "off";
}

/**
 * Rewrite unbound Number calls in modules, then correct precedence, EC-03, EC-06, and affected Unicode in the final output.
 *
 * モジュール内の未束縛Number呼び出しを変換し、最終出力の優先順位・EC-03・EC-06とUnicodeを補正する。
 */
export function extendscriptCompat(options?: CompatibilityOptions): Plugin;
