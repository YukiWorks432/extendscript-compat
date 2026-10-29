/**
 * Unprotected locations in the input. Lines are 1-based; columns and character positions are 0-based.
 *
 * 生成前のコードにある未保護箇所。行は1始まり、列と文字位置は0始まり。
 */
export interface PrecedenceDiagnostic {
  kind: "mixed-logical" | "nested-conditional";
  start: number;
  end: number;
  line: number;
  column: number;
}

/**
 * insertions contains the original-input positions of individual parentheses in ascending order.
 *
 * insertionsは元のコードに対する括弧1文字ごとの挿入位置を昇順で返す。
 */
export interface ProtectedCode {
  code: string;
  insertions: number[];
}

/**
 * Insert only parentheses into code already generated as ordinary JavaScript.
 *
 * 通常のJavaScriptとして生成済みのコードへ括弧だけを挿入する。
 */
export function protectPrecedence(source: string): ProtectedCode;
export function findPrecedenceIssues(source: string): PrecedenceDiagnostic[];
export function assertPrecedenceProtected(source: string): void;

/**
 * An issue detected in the original input; kind identifies the correction.
 *
 * 元の入力上で検出した不具合。補正内容をkindで区別する。
 */
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
  /**
   * Insertions and replacements against the original input, in position order.
   *
   * 元の入力に対する、位置順の挿入・置換。
   */
  edits: SourceEdit[];
  /**
   * Notifications for automatically corrected EC-03 issues, positioned in the original input.
   *
   * 自動補正したEC-03の通知。位置は元の入力を参照する。
   */
  diagnostics: CompatibilityDiagnostic[];
}

export function findCompatibilityIssues(source: string): CompatibilityDiagnostic[];
export interface UnicodeProtection {
  code: string;
  edits: SourceEdit[];
}

/**
 * Escape U+200C, U+200D and U+FEFF in strings and regular expressions; reject unsafe contexts.
 *
 * 文字列と正規表現のU+200C・U+200D・U+FEFFをエスケープし、安全に変換できない箇所は拒否する。
 */
export function protectUnicode(source: string): UnicodeProtection;

/**
 * Correct precedence, EC-06, continue labels, semicolons, and affected Unicode; return EC-03 notifications.
 *
 * 優先順位、EC-06、continueのラベル・セミコロンとUnicodeを補正し、EC-03の通知を返す。
 */
export function protectCompatibility(source: string): CompatibilityProtection;

/** Potential EC-18/19 risks at a regular-expression literal. Positions refer to the input.
 * 正規表現リテラル上のEC-18・19の可能性。位置は入力コードを参照する。 */
export interface RegExpRiskDiagnostic {
  code: "EC-18" | "EC-19";
  kind: "regexp-optional-alternative-repeat" | "regexp-nested-alternative-repeat";
  start: number;
  end: number;
  line: number;
  column: number;
  message: string;
}
/** Detect potential risks in static regular-expression literals without changing the input.
 * 静的な正規表現リテラルの潜在的な問題を検出する。入力は変更しない。 */
export function findRegExpRisks(source: string): RegExpRiskDiagnostic[];
