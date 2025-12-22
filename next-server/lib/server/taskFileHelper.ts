import * as fs from "fs/promises";
import * as path from "path";
import { getLogger } from "./logger";

const logger = getLogger();

/**
 * キューファイルの保存先ディレクトリを取得する
 * 環境変数QUEUE_FILE_DIRが設定されていればそれを使用、なければデフォルト値
 */
const getFileBaseDir = (): string => {
  return process.env.QUEUE_FILE_DIR || "./queue_files";
};

/**
 * AIタスクキュー用ファイルを管理するヘルパークラス
 * キュー登録時にアップロードされたファイルを保存・読み込み・削除する
 */
export class TaskFileHelper {
  /**
   * ファイルベースディレクトリを取得する
   */
  static getFileBaseDir(): string {
    return getFileBaseDir();
  }

  /**
   * タスクIDに基づくファイルディレクトリを取得する
   */
  static getTaskDir(taskId: string): string {
    return path.join(getFileBaseDir(), taskId);
  }

  /**
   * ファイルの保存先パスを取得する
   */
  static getFilePath(taskId: string, fileId: string, fileName: string): string {
    const ext = path.extname(fileName);
    return path.join(TaskFileHelper.getTaskDir(taskId), `${fileId}${ext}`);
  }

  /**
   * ファイルを保存する
   * @param taskId タスクID
   * @param fileId ファイルメタデータID
   * @param buffer ファイルデータ
   * @param fileName 元ファイル名（拡張子取得用）
   * @returns 保存先のファイルパス
   */
  static async saveFile(
    taskId: string,
    fileId: string,
    buffer: Buffer,
    fileName: string,
  ): Promise<string> {
    const taskDir = TaskFileHelper.getTaskDir(taskId);
    await fs.mkdir(taskDir, { recursive: true });

    const filePath = TaskFileHelper.getFilePath(taskId, fileId, fileName);
    await fs.writeFile(filePath, buffer);

    logger.debug(
      { taskId, fileId, filePath, size: buffer.length },
      "タスクファイルを保存しました",
    );
    return filePath;
  }

  /**
   * ファイルを読み込む
   * @param filePath ファイルパス
   * @returns ファイルデータ
   */
  static async loadFile(filePath: string): Promise<Buffer> {
    const buffer = await fs.readFile(filePath);
    logger.debug(
      { filePath, size: buffer.length },
      "タスクファイルを読み込みました",
    );
    return buffer;
  }

  /**
   * タスクのファイルディレクトリを削除する
   * @param taskId タスクID
   */
  static async deleteTaskFiles(taskId: string): Promise<void> {
    const taskDir = TaskFileHelper.getTaskDir(taskId);
    try {
      await fs.rm(taskDir, { recursive: true, force: true });
      logger.debug(
        { taskId, taskDir },
        "タスクファイルディレクトリを削除しました",
      );
    } catch (error) {
      // ディレクトリが存在しない場合は無視
      logger.debug(
        { taskId, taskDir, error },
        "タスクファイルディレクトリの削除に失敗しましたが、無視します",
      );
    }
  }

  /**
   * 単一のファイルを削除する
   * @param filePath ファイルパス
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug({ filePath }, "ファイルを削除しました");
    } catch (error) {
      // ファイルが存在しない場合は無視
      logger.debug(
        { filePath, error },
        "ファイルの削除に失敗しましたが、無視します",
      );
    }
  }

  /**
   * ファイルが存在するか確認する
   * @param filePath ファイルパス
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ベースディレクトリが存在することを確認し、なければ作成する
   */
  static async ensureBaseDir(): Promise<void> {
    const baseDir = getFileBaseDir();
    await fs.mkdir(baseDir, { recursive: true });
    logger.debug({ baseDir }, "キューファイルベースディレクトリを確認しました");
  }

  /**
   * ディレクトリ内のファイル一覧を取得する
   * @param taskId タスクID
   * @returns ファイルパスの配列
   */
  static async listTaskFiles(taskId: string): Promise<string[]> {
    const taskDir = TaskFileHelper.getTaskDir(taskId);
    try {
      const files = await fs.readdir(taskDir);
      return files.map((file) => path.join(taskDir, file));
    } catch {
      // ディレクトリが存在しない場合は空配列を返す
      return [];
    }
  }

  /**
   * 変換済み画像ファイルのパスを取得する
   * @param taskId タスクID
   * @param fileId ファイルメタデータID
   * @param imageIndex 画像インデックス（0から始まる）
   */
  static getConvertedImagePath(
    taskId: string,
    fileId: string,
    imageIndex: number,
  ): string {
    return path.join(
      TaskFileHelper.getTaskDir(taskId),
      `${fileId}_img_${imageIndex}.png`,
    );
  }

  /**
   * 変換済み画像を保存する
   * @param taskId タスクID
   * @param fileId ファイルメタデータID
   * @param images 変換済み画像バッファの配列
   */
  static async saveConvertedImages(
    taskId: string,
    fileId: string,
    images: Buffer[],
  ): Promise<void> {
    const taskDir = TaskFileHelper.getTaskDir(taskId);
    await fs.mkdir(taskDir, { recursive: true });

    for (let i = 0; i < images.length; i++) {
      const imagePath = TaskFileHelper.getConvertedImagePath(taskId, fileId, i);
      await fs.writeFile(imagePath, images[i]);
      logger.debug(
        { taskId, fileId, imageIndex: i, imagePath, size: images[i].length },
        "変換済み画像を保存しました",
      );
    }

    logger.debug(
      { taskId, fileId, count: images.length },
      "変換済み画像の保存が完了しました",
    );
  }

  /**
   * 変換済み画像を読み込む
   * @param taskId タスクID
   * @param fileId ファイルメタデータID
   * @param count 画像の数
   * @returns 画像バッファの配列
   */
  static async loadConvertedImages(
    taskId: string,
    fileId: string,
    count: number,
  ): Promise<Buffer[]> {
    const images: Buffer[] = [];

    for (let i = 0; i < count; i++) {
      const imagePath = TaskFileHelper.getConvertedImagePath(taskId, fileId, i);
      const buffer = await fs.readFile(imagePath);
      images.push(buffer);
      logger.debug(
        { taskId, fileId, imageIndex: i, imagePath, size: buffer.length },
        "変換済み画像を読み込みました",
      );
    }

    logger.debug(
      { taskId, fileId, count },
      "変換済み画像の読み込みが完了しました",
    );
    return images;
  }
}
