import type { ExtractedFile } from "./shared/types";

/**
 * 複数ファイルを統合したメッセージコンテンツを作成する
 * @param files 処理済みファイルの配列（fileProcessingStepで抽出済み）
 * @param promptText プロンプトテキスト
 * @returns メッセージコンテンツの配列
 */
export function createCombinedMessage(
  files: ExtractedFile[],
  promptText: string,
): Array<
  | { type: "text"; text: string }
  | { type: "image"; image: string; mimeType: string }
> {
  // ファイル名一覧を作成
  const fileNames = files.map((file) => file.name).join(", ");

  // メッセージコンテンツを構築
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string; mimeType: string }
  > = [
    {
      type: "text",
      text: `${promptText}: ${fileNames}`,
    },
  ];

  // ドキュメント順に処理
  for (const file of files) {
    // 画像として処理する場合
    if (
      file.processMode === "image" &&
      file.imageData &&
      file.imageData.length > 0
    ) {
      // 各ページごとに個別の説明と画像を追加
      const totalPages = file.imageData.length;
      for (let pageIndex = 0; pageIndex < file.imageData.length; pageIndex++) {
        const currentPage = pageIndex + 1;

        // ページ番号を含むテキスト説明を追加
        content.push({
          type: "text",
          text: `# ${file.name}: Page ${currentPage}/${totalPages}`,
        });

        // 該当ページの画像データを追加
        content.push({
          type: "image",
          image: file.imageData[pageIndex],
          mimeType: "image/png",
        });
      }
    } else {
      // テキストモードの場合
      content.push({
        type: "text",
        text: `# ${file.name}\n${file.textContent ?? ""}`,
      });
    }
  }

  return content;
}
