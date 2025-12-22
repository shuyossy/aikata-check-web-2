import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileUploadArea, FileUploadAreaProps } from "../FileUploadArea";
import { UploadedFile } from "../types";

// テスト用のモックファイル
const createMockFile = (name: string, size: number, type: string): File => {
  const blob = new Blob([""], { type });
  return new File([blob], name, { type });
};

// テスト用のアップロードファイル
const createUploadedFile = (
  partial: Partial<UploadedFile> = {},
): UploadedFile => {
  const name = partial.name || "test.txt";
  const type = partial.type || "text/plain";
  const size = partial.size || 1024;
  return {
    id: `test-${Date.now()}`,
    file: createMockFile(name, size, type),
    name,
    size,
    type,
    status: "pending",
    ...partial,
  };
};

describe("FileUploadArea", () => {
  let mockOnFilesChange: ReturnType<typeof vi.fn>;
  let defaultProps: FileUploadAreaProps;

  beforeEach(() => {
    mockOnFilesChange = vi.fn();
    defaultProps = {
      files: [],
      onFilesChange: mockOnFilesChange,
    };
  });

  describe("レンダリング", () => {
    it("ドロップゾーンが表示される", () => {
      render(<FileUploadArea {...defaultProps} />);

      expect(
        screen.getByText("ファイルをドラッグ&ドロップ"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("または クリックして選択（複数ファイル対応）"),
      ).toBeInTheDocument();
    });

    it("サポートされるファイル形式のバッジが表示される", () => {
      render(<FileUploadArea {...defaultProps} />);

      expect(screen.getByText("PDF")).toBeInTheDocument();
      expect(screen.getByText("DOCX")).toBeInTheDocument();
      expect(screen.getByText("XLSX")).toBeInTheDocument();
      expect(screen.getByText("PPTX")).toBeInTheDocument();
      expect(screen.getByText("CSV")).toBeInTheDocument();
      expect(screen.getByText("TXT")).toBeInTheDocument();
    });

    it("ファイルサイズと数の制限が表示される", () => {
      render(
        <FileUploadArea
          {...defaultProps}
          maxFileSize={10 * 1024 * 1024}
          maxFiles={5}
        />,
      );

      expect(screen.getByText(/10 MB/)).toBeInTheDocument();
      expect(screen.getByText(/5ファイルまで/)).toBeInTheDocument();
    });

    it("カスタムの許可フォーマットが表示される", () => {
      render(
        <FileUploadArea {...defaultProps} acceptedFormats={[".pdf", ".txt"]} />,
      );

      expect(screen.getByText("PDF")).toBeInTheDocument();
      expect(screen.getByText("TXT")).toBeInTheDocument();
      expect(screen.queryByText("DOCX")).not.toBeInTheDocument();
    });
  });

  describe("ファイル一覧表示", () => {
    it("アップロードされたファイルが表示される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.pdf",
          size: 1024 * 1024,
          type: "application/pdf",
          status: "complete",
        }),
      ];

      render(<FileUploadArea {...defaultProps} files={files} />);

      expect(screen.getByText("document.pdf")).toBeInTheDocument();
      expect(screen.getByText("1 MB")).toBeInTheDocument();
    });

    it("処理中/エラーステータスに応じたバッジが表示される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "processing.txt",
          status: "processing",
        }),
        createUploadedFile({
          id: "2",
          name: "error.txt",
          status: "error",
          error: "エラーが発生しました",
        }),
      ];

      render(<FileUploadArea {...defaultProps} files={files} />);

      expect(screen.getByText("処理中")).toBeInTheDocument();
      expect(screen.getByText("エラー")).toBeInTheDocument();
    });

    it("エラーメッセージが表示される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "error.txt",
          status: "error",
          error: "ファイルの処理に失敗しました",
        }),
      ];

      render(<FileUploadArea {...defaultProps} files={files} />);

      expect(
        screen.getByText("ファイルの処理に失敗しました"),
      ).toBeInTheDocument();
    });
  });

  describe("ファイル操作", () => {
    it("ファイル入力で新しいファイルが追加される", () => {
      render(<FileUploadArea {...defaultProps} />);

      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = createMockFile("new-file.txt", 1024, "text/plain");

      // ファイル選択をシミュレート
      Object.defineProperty(fileInput, "files", {
        value: [file],
      });
      fireEvent.change(fileInput);

      expect(mockOnFilesChange).toHaveBeenCalled();
      const newFiles = mockOnFilesChange.mock.calls[0][0];
      expect(newFiles).toHaveLength(1);
      expect(newFiles[0].name).toBe("new-file.txt");
    });

    it("削除ボタンでファイルが削除される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.pdf",
        }),
      ];

      render(<FileUploadArea {...defaultProps} files={files} />);

      // 削除ボタンをクリック（X アイコン）
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((button) =>
        button.className.includes("text-red"),
      );
      expect(deleteButton).toBeTruthy();

      fireEvent.click(deleteButton!);

      expect(mockOnFilesChange).toHaveBeenCalledWith([]);
    });

    it("最大ファイル数に達した場合、新しいファイルは追加されない", () => {
      const existingFiles: UploadedFile[] = [
        createUploadedFile({ id: "1", name: "file1.txt" }),
        createUploadedFile({ id: "2", name: "file2.txt" }),
      ];

      render(
        <FileUploadArea {...defaultProps} files={existingFiles} maxFiles={2} />,
      );

      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = createMockFile("new-file.txt", 1024, "text/plain");

      Object.defineProperty(fileInput, "files", {
        value: [file],
      });
      fireEvent.change(fileInput);

      // maxFilesに達しているため、onFilesChangeは呼ばれない
      expect(mockOnFilesChange).not.toHaveBeenCalled();
    });
  });

  describe("PDF処理モード選択機能", () => {
    it("PDFファイルに処理モードセレクターが表示される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
        />,
      );

      // 処理モードセレクターのボタンが表示される
      expect(screen.getByText("テキスト抽出")).toBeInTheDocument();
      expect(screen.getByText("画像変換")).toBeInTheDocument();
    });

    it("showImageConversion=falseの場合、処理モードセレクターは表示されない", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.pdf",
          type: "application/pdf",
          status: "complete",
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={false}
        />,
      );

      // 処理モードセレクターが表示されない
      expect(screen.queryByText("テキスト抽出")).not.toBeInTheDocument();
      expect(screen.queryByText("画像変換")).not.toBeInTheDocument();
    });

    it("非PDFファイルの処理モードセレクターは無効化される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.txt",
          type: "text/plain",
          status: "complete",
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
        />,
      );

      // 処理モードセレクターのボタンはあるが無効化されている
      const textExtractButton = screen.getByText("テキスト抽出");
      const imageConvertButton = screen.getByText("画像変換");

      expect(textExtractButton).toBeDisabled();
      expect(imageConvertButton).toBeDisabled();
    });

    it("処理モードを切り替えるとonFilesChangeが呼ばれる", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "test-pdf-1",
          name: "document.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
        />,
      );

      // 画像変換ボタンをクリック
      const imageConvertButton = screen.getByText("画像変換");
      fireEvent.click(imageConvertButton);

      expect(mockOnFilesChange).toHaveBeenCalled();
      const updatedFiles = mockOnFilesChange.mock.calls[0][0];
      expect(updatedFiles[0].willConvertToImage).toBe(true);
    });
  });

  describe("複数選択と一括操作", () => {
    it("enableMultiSelect=trueの場合、PDFファイルにチェックボックスが表示される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      // チェックボックスが表示される
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it("非PDFファイルにはチェックボックスが表示されない", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.txt",
          type: "text/plain",
          status: "complete",
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      // チェックボックスが表示されない（非PDFのため）
      const checkboxes = screen.queryAllByRole("checkbox");
      expect(checkboxes).toHaveLength(0);
    });

    it("PDFを選択すると一括操作ツールバーが表示される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      // チェックボックスをクリック
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      // 一括操作ツールバーが表示される
      expect(screen.getByText("1件のPDFを選択中")).toBeInTheDocument();
      expect(screen.getByText("一括: テキスト抽出")).toBeInTheDocument();
      expect(screen.getByText("一括: 画像変換")).toBeInTheDocument();
      expect(screen.getByText("選択解除")).toBeInTheDocument();
    });

    it("Shift+クリックで範囲選択ができる", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document1.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
        createUploadedFile({
          id: "2",
          name: "document2.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
        createUploadedFile({
          id: "3",
          name: "document3.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);

      // 最初のPDFをクリック
      fireEvent.click(checkboxes[0]);

      // 3番目のPDFをShift+クリック
      fireEvent.click(checkboxes[2], { shiftKey: true });

      // 一括操作ツールバーに3件が選択されていることが表示される
      expect(screen.getByText("3件のPDFを選択中")).toBeInTheDocument();
    });

    it("Shift+クリックで非PDFを含む範囲でも、PDFのみが選択される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document1.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
        createUploadedFile({
          id: "2",
          name: "document.txt",
          type: "text/plain",
          status: "complete",
        }),
        createUploadedFile({
          id: "3",
          name: "document2.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      // チェックボックスはPDFファイルのみに表示される（2つ）
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);

      // 最初のPDFをクリック
      fireEvent.click(checkboxes[0]);

      // 2番目のPDF（インデックス2）をShift+クリック
      fireEvent.click(checkboxes[1], { shiftKey: true });

      // 2件のPDFが選択されている（非PDFは含まれない）
      expect(screen.getByText("2件のPDFを選択中")).toBeInTheDocument();
    });
  });

  describe("無効状態", () => {
    it("disabled=trueの場合、ファイル選択ができない", () => {
      render(<FileUploadArea {...defaultProps} disabled={true} />);

      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput.disabled).toBe(true);
    });

    it("disabled=trueの場合、削除ボタンが無効になる", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.pdf",
        }),
      ];

      render(
        <FileUploadArea {...defaultProps} files={files} disabled={true} />,
      );

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((button) =>
        button.className.includes("text-red"),
      );
      expect(deleteButton).toBeDisabled();
    });

    it("disabled=trueの場合、処理モードセレクターが無効になる", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          disabled={true}
        />,
      );

      const textExtractButton = screen.getByText("テキスト抽出");
      const imageConvertButton = screen.getByText("画像変換");

      expect(textExtractButton).toBeDisabled();
      expect(imageConvertButton).toBeDisabled();
    });
  });

  describe("ドラッグ&ドロップ", () => {
    it("ドラッグオーバー時にスタイルが変わる", () => {
      render(<FileUploadArea {...defaultProps} />);

      const dropZone = screen
        .getByText("ファイルをドラッグ&ドロップ")
        .closest("div");

      fireEvent.dragOver(dropZone!, {
        dataTransfer: { files: [] },
      });

      // ドラッグ中のスタイルが適用されていることを確認
      expect(dropZone).toHaveClass("border-primary");
    });

    it("ドラッグ離脱時にスタイルが元に戻る", () => {
      render(<FileUploadArea {...defaultProps} />);

      const dropZone = screen
        .getByText("ファイルをドラッグ&ドロップ")
        .closest("div");

      fireEvent.dragOver(dropZone!, {
        dataTransfer: { files: [] },
      });
      fireEvent.dragLeave(dropZone!, {
        dataTransfer: { files: [] },
      });

      expect(dropZone).toHaveClass("border-gray-300");
    });
  });

  describe("一括操作ボタン", () => {
    it("一括テキスト抽出ボタンをクリックするとwillConvertToImage=falseに設定される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document1.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: true,
        }),
        createUploadedFile({
          id: "2",
          name: "document2.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: true,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      // 両方のPDFを選択
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      // 一括テキスト抽出ボタンをクリック
      const batchTextButton = screen.getByText("一括: テキスト抽出");
      fireEvent.click(batchTextButton);

      // onFilesChangeが呼ばれ、選択されたPDFのwillConvertToImageがfalseになる
      expect(mockOnFilesChange).toHaveBeenCalled();
      const updatedFiles =
        mockOnFilesChange.mock.calls[
          mockOnFilesChange.mock.calls.length - 1
        ][0];
      expect(updatedFiles[0].willConvertToImage).toBe(false);
      expect(updatedFiles[1].willConvertToImage).toBe(false);
    });

    it("一括画像変換ボタンをクリックするとwillConvertToImage=trueに設定される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document1.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
        createUploadedFile({
          id: "2",
          name: "document2.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      // 両方のPDFを選択
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      // 一括画像変換ボタンをクリック
      const batchImageButton = screen.getByText("一括: 画像変換");
      fireEvent.click(batchImageButton);

      // onFilesChangeが呼ばれ、選択されたPDFのwillConvertToImageがtrueになる
      expect(mockOnFilesChange).toHaveBeenCalled();
      const updatedFiles =
        mockOnFilesChange.mock.calls[
          mockOnFilesChange.mock.calls.length - 1
        ][0];
      expect(updatedFiles[0].willConvertToImage).toBe(true);
      expect(updatedFiles[1].willConvertToImage).toBe(true);
    });

    it("選択解除ボタンをクリックすると選択が解除される", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document1.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      // PDFを選択
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      // ツールバーが表示されていることを確認
      expect(screen.getByText("1件のPDFを選択中")).toBeInTheDocument();

      // 選択解除ボタンをクリック
      const clearButton = screen.getByText("選択解除");
      fireEvent.click(clearButton);

      // ツールバーが非表示になる（選択されたPDFがなくなる）
      expect(screen.queryByText("1件のPDFを選択中")).not.toBeInTheDocument();
    });

    it("一括操作では選択されたPDFのみが更新され、非選択のPDFは変更されない", () => {
      const files: UploadedFile[] = [
        createUploadedFile({
          id: "1",
          name: "document1.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
        createUploadedFile({
          id: "2",
          name: "document2.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
        createUploadedFile({
          id: "3",
          name: "document3.pdf",
          type: "application/pdf",
          status: "complete",
          willConvertToImage: false,
        }),
      ];

      render(
        <FileUploadArea
          {...defaultProps}
          files={files}
          showImageConversion={true}
          enableMultiSelect={true}
        />,
      );

      // 最初のPDFのみを選択
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);

      // 一括画像変換ボタンをクリック
      const batchImageButton = screen.getByText("一括: 画像変換");
      fireEvent.click(batchImageButton);

      // onFilesChangeが呼ばれる
      expect(mockOnFilesChange).toHaveBeenCalled();
      const updatedFiles =
        mockOnFilesChange.mock.calls[
          mockOnFilesChange.mock.calls.length - 1
        ][0];

      // 選択されたPDF（1番目）のみが変更される
      expect(updatedFiles[0].willConvertToImage).toBe(true);
      // 非選択のPDF（2, 3番目）は変更されない
      expect(updatedFiles[1].willConvertToImage).toBe(false);
      expect(updatedFiles[2].willConvertToImage).toBe(false);
    });
  });
});
