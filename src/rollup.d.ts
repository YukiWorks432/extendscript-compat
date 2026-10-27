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
 * Rewrite unbound Number calls and constructors and safe local alias calls, then correct compatibility in the final output.
 *
 * 未束縛Numberの呼び出し・コンストラクタと安全な別名の呼び出しを変換し、最終出力の互換性を補正する。
 */
export function extendscriptCompat(options?: CompatibilityOptions): Plugin;
