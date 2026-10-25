/** 生成前のコードにある未保護箇所。行は1始まり、列と文字位置は0始まり。 */
export interface PrecedenceDiagnostic {
  kind: "mixed-logical" | "nested-conditional";
  start: number;
  end: number;
  line: number;
  column: number;
}

/** insertionsは元のコードに対する括弧1文字ごとの挿入位置を昇順で返す。 */
export interface ProtectedCode {
  code: string;
  insertions: number[];
}

/** 通常のJavaScriptとして生成済みのコードへ括弧だけを挿入する。 */
export function protectExtendscriptExpressionPrecedence(source: string): ProtectedCode;
export function findUnprotectedExtendscriptExpressionPrecedence(
  source: string,
): PrecedenceDiagnostic[];
export function assertExtendscriptExpressionPrecedenceProtected(source: string): void;
