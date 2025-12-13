"use client";

// 動的にロードしたライブラリをキャッシュ
let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * pdfjs-distを動的に読み込む（キャッシュ付き）
 * SSR時のDOMMatrixエラーを回避するため、クライアントサイドでのみ読み込む
 */
const getPdfjsLib = async (): Promise<typeof import("pdfjs-dist")> => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      // PDF.jsのワーカーを設定（ローカルファイルを使用 - 社内環境対応のためCDN不使用）
      if (typeof window !== "undefined") {
        lib.GlobalWorkerOptions.workerSrc = "/libs/pdf.worker.min.mjs";
      }
      return lib;
    });
  }
  return pdfjsLibPromise;
};

/**
 * PDF変換時のエラー
 */
export class PdfConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfConversionError";
  }
}

/**
 * PDF を PNG(Base64 DataURL) の配列に変換
 * @param data PDF の ArrayBuffer または Uint8Array
 * @param opts.scale レンダリング解像度（デフォルト 2.0）
 * @returns 各ページのPNG画像（Base64 DataURL）の配列
 */
export const convertPdfBytesToImages = async (
  data: Uint8Array | ArrayBufferLike,
  opts: { scale?: number } = {},
): Promise<string[]> => {
  const scale = opts.scale ?? 2.0;

  // data が Uint8Array でなければ Uint8Array に包む
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  // pdfjs-distを動的に読み込む
  const pdfjsLib = await getPdfjsLib();

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const images: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new PdfConversionError("Canvas context could not be created");
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push(canvas.toDataURL("image/png"));
  }
  return images;
};

/**
 * FileからPDFを読み込み、PNG画像の配列に変換
 * @param file PDFファイル
 * @param opts.scale レンダリング解像度（デフォルト 2.0）
 * @returns 各ページのPNG画像（Base64 DataURL）の配列
 */
export const convertPdfFileToImages = async (
  file: File,
  opts: { scale?: number } = {},
): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  return convertPdfBytesToImages(arrayBuffer, opts);
};

/**
 * 画像データURL配列を縦に結合して1枚のPNGにする
 * @param imageDataArray Base64 DataURL形式の画像配列
 * @returns 結合した1枚のPNG画像（Base64 DataURL）
 */
export const combineImages = async (
  imageDataArray: string[],
): Promise<string> => {
  if (imageDataArray.length === 0) {
    throw new PdfConversionError("画像データが空です");
  }
  if (imageDataArray.length === 1) return imageDataArray[0];

  const images = await Promise.all(
    imageDataArray.map(
      (data) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = data;
        }),
    ),
  );

  const maxWidth = Math.max(...images.map((img) => img.width));
  const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new PdfConversionError("Canvas context could not be created");
  }

  canvas.width = maxWidth;
  canvas.height = totalHeight;

  // 白背景で塗りつぶし
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, maxWidth, totalHeight);

  // 画像を縦に並べて描画
  let currentY = 0;
  for (const img of images) {
    context.drawImage(img, 0, currentY);
    currentY += img.height;
  }

  return canvas.toDataURL("image/png");
};

/**
 * Base64 DataURLからBase64部分のみを抽出
 * @param dataUrl Base64 DataURL (例: "data:image/png;base64,...")
 * @returns Base64文字列のみ
 */
export const extractBase64FromDataUrl = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    throw new PdfConversionError("Invalid data URL format");
  }
  return match[1];
};

/**
 * DataURLをBlobに変換
 * @param dataUrl Base64 DataURL
 * @returns Blob
 */
const dataUrlToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * FileからPDFを読み込み、PNG画像のFile配列に変換
 * FormDataでサーバーに送信するためのFile形式で返す
 * @param file PDFファイル
 * @param opts.scale レンダリング解像度（デフォルト 2.0）
 * @returns 各ページのPNG画像のFile配列
 */
export const convertPdfFileToFiles = async (
  file: File,
  opts: { scale?: number } = {},
): Promise<File[]> => {
  const images = await convertPdfFileToImages(file, opts);
  const baseName = file.name.replace(/\.pdf$/i, "");

  return images.map((dataUrl, index) => {
    const blob = dataUrlToBlob(dataUrl);
    return new File([blob], `${baseName}_page_${index + 1}.png`, {
      type: "image/png",
    });
  });
};
