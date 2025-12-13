/**
 * テキスト抽出方式の列挙型
 * 同一拡張子に対して複数の抽出方式を選択可能にするための識別子
 */
export type TextExtractorType =
  | "txt-default"
  | "csv-default"
  | "xlsx-sheetjs"
  | "xlsx-external-md" // 将来追加: 外部サービスによるMD変換
  | "pdf-parse" // PDFテキスト抽出（pdf-parseライブラリ使用）- 非推奨
  | "pdfjs-dist" // PDFテキスト抽出（pdfjs-distライブラリ使用）- 非推奨
  | "unpdf" // PDFテキスト抽出（unpdfライブラリ使用）- 推奨
  | "pdf-ocr" // 将来追加: OCRサービス
  | "docx-mammoth" // Word文書（mammothライブラリ使用）
  | "pptx-officeparser"; // PowerPoint文書（officeparserライブラリ使用）
