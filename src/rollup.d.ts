import type { Plugin } from "rollup";

export interface CompatibilityOptions {
  /** Potential EC-18/19 warnings: off by default; warn or error to enable.
   * EC-18・19の可能性の通知。既定はoff。warnまたはerrorで有効にする。 */
  regexpDiagnostics?: "off" | "warn" | "error";
  /**
   * Add a UTF-8 byte order mark to each generated JavaScript chunk by default.
   *
   * 生成される各JavaScriptチャンクにUTF-8 BOMを既定で付与する。
   */
  bom?: boolean;
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
