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
export function protectPrecedence(source: string): ProtectedCode;
export function findPrecedenceIssues(source: string): PrecedenceDiagnostic[];
export function assertPrecedenceProtected(source: string): void;

/** 元の入力上で検出した不具合。補正内容をkindで区別する。 */
export interface CompatibilityDiagnostic {
  code: "EC-03" | "EC-06";
  kind: "continue-through-switch" | "labeled-continue-semicolon" | "regexp-escaped-hyphen";
  start: number;
  end: number;
  line: number;
  column: number;
  message: string;
}

export interface SourceEdit {
  start: number;
  end: number;
  text: string;
}

export interface CompatibilityProtection {
  code: string;
  /** 元の入力に対する、位置順の挿入・置換。 */
  edits: SourceEdit[];
  /** 自動補正したEC-03の通知。位置は元の入力を参照する。 */
  diagnostics: CompatibilityDiagnostic[];
}

export function findCompatibilityIssues(source: string): CompatibilityDiagnostic[];
/** 優先順位、EC-06、continueのラベルとセミコロンを補正し、EC-03の通知を返す。 */
export function protectCompatibility(source: string): CompatibilityProtection;
