/**
 * テキスト抽出方式の列挙型
 * 同一拡張子に対して複数の抽出方式を選択可能にするための識別子
 */
export type TextExtractorType =
  | "txt-default"
  | "csv-default"
  | "xlsx-sheetjs"
  | "xlsx-external-md" // 将来追加: 外部サービスによるMD変換
  | "pdf-pdfjs" // 将来追加: pdfjs-dist
  | "pdf-ocr"; // 将来追加: OCRサービス
