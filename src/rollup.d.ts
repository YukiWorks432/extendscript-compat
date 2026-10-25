import type { Plugin } from "rollup";

/** ホスト用ビルドで、最小化・include展開の後、JSXBin化の前に配置する。 */
export function extendscriptCompat(): Plugin;
