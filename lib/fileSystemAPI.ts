/**
 * File System Access API - Cho phép web app đọc/ghi file trên máy local
 * Chỉ hoạt động trên Chrome/Edge modern browsers
 */

import { toast } from "sonner";

export interface FileSystemAPI {
  selectDirectory: () => Promise<FileSystemDirectoryHandle | null>;
  createFile: (
    dirHandle: FileSystemDirectoryHandle,
    fileName: string,
    content: string
  ) => Promise<void>;
  readFile: (
    dirHandle: FileSystemDirectoryHandle,
    fileName: string
  ) => Promise<string>;
  updateFile: (
    dirHandle: FileSystemDirectoryHandle,
    fileName: string,
    content: string
  ) => Promise<void>;
  listFiles: (dirHandle: FileSystemDirectoryHandle) => Promise<string[]>;
  deleteFile: (
    dirHandle: FileSystemDirectoryHandle,
    fileName: string
  ) => Promise<void>;
}

/**
 * Yêu cầu user chọn folder để làm việc
 */
export async function selectDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // @ts-expect-error - File System Access API
    if (!window.showDirectoryPicker) {
      toast.error("Trình duyệt của bạn không hỗ trợ File System Access API.");
      return null;
    }

    // @ts-expect-error - showDirectoryPicker is not in TypeScript types yet
    const dirHandle = await window.showDirectoryPicker({
      mode: "readwrite", // Cho phép đọc và ghi
    });
    return dirHandle;
  } catch (error) {
    console.error(`User cancelled directory selection or error: ${error}`);
    return null;
  }
}

/**
 * Tạo file mới trong directory
 */
export async function createFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string
): Promise<void> {
  try {
    // Tạo file handle
    const fileHandle = await dirHandle.getFileHandle(fileName, {
      create: true,
    });

    // Tạo writable stream
    const writable = await fileHandle.createWritable();

    // Ghi nội dung
    await writable.write(content);

    // Đóng stream
    await writable.close();

    toast.success(`File created: ${fileName}`);
  } catch (error) {
    toast.error(`Error creating file ${fileName}: ${error}`);
    throw error;
  }
}

/**
 * Đọc file từ directory (hỗ trợ nested paths)
 */
export async function readFile(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string
): Promise<string> {
  try {
    const parts = filePath.split("/");
    const fileName = parts.pop()!;

    // Navigate đến folder chứa file
    let currentHandle = dirHandle;
    for (const part of parts) {
      currentHandle = await currentHandle.getDirectoryHandle(part);
    }

    // Lấy file handle
    const fileHandle = await currentHandle.getFileHandle(fileName);

    // Lấy file object
    const file = await fileHandle.getFile();

    // Đọc nội dung
    const content = await file.text();
    return content;
  } catch (error) {
    toast.error(`Error reading file ${filePath}: ${error}`);
    throw error;
  }
}

/**
 * Cập nhật file có sẵn (hỗ trợ nested paths)
 */
export async function updateFile(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string,
  content: string
): Promise<void> {
  try {
    const parts = filePath.split("/");
    const fileName = parts.pop()!;

    // Navigate đến folder chứa file
    let currentHandle = dirHandle;
    for (const part of parts) {
      currentHandle = await currentHandle.getDirectoryHandle(part);
    }

    // Lấy file handle (không tạo mới)
    const fileHandle = await currentHandle.getFileHandle(fileName);

    // Tạo writable stream
    const writable = await fileHandle.createWritable();

    // Ghi đè nội dung
    await writable.write(content);

    // Đóng stream
    await writable.close();
  } catch (error) {
    toast.error(`Error updating file ${filePath}: ${error}`);
    throw error;
  }
}

/**
 * Liệt kê tất cả files trong directory (FLAT - chỉ level đầu)
 */
export async function listFiles(
  dirHandle: FileSystemDirectoryHandle
): Promise<string[]> {
  const files: string[] = [];

  try {
    // @ts-expect-error - values() async iterator not in TypeScript types
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file") {
        files.push(entry.name);
      }
    }
    return files;
  } catch (error) {
    toast.error(`Error listing files: ${error}`);
    throw error;
  }
}

/**
 * Interface cho file/folder entry với thông tin lazy loading
 */
export interface FileSystemEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  handle?: FileSystemDirectoryHandle; // Chỉ có với directory
}

/**
 * List entries (files + folders) ở 1 level - Lazy Loading approach
 * Trả về cả files và folders, user tự quyết định khi nào expand folder
 */
export async function listDirectoryEntries(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = ""
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];

  try {
    // @ts-expect-error - values() async iterator not in TypeScript types
    for await (const entry of dirHandle.values()) {
      const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;

      entries.push({
        name: entry.name,
        path: fullPath,
        kind: entry.kind,
        handle: entry.kind === "directory" ? entry : undefined,
      });
    }

    return entries;
  } catch (error) {
    toast.error(`Error listing directory entries: ${error}`);
    throw error;
  }
}

/**
 * Liệt kê TẤT CẢ files đệ quy, bao gồm nested folders
 * Optimized: Stack-based + Parallel processing (BFS approach)
 * Trả về danh sách paths như: ["src/App.tsx", "components/Button.tsx"]
 * NOTE: Chỉ dùng khi cần load toàn bộ cây thư mục 1 lần
 */
export async function listFilesRecursive(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = ""
): Promise<string[]> {
  const files: string[] = [];
  const stack: { handle: FileSystemDirectoryHandle; path: string }[] = [
    { handle: dirHandle, path: basePath },
  ];

  try {
    while (stack.length > 0) {
      // Lấy tất cả items trong stack hiện tại để xử lý song song
      const batchSize = stack.length;
      const batch = stack.splice(0, batchSize);

      // Xử lý song song từng batch (theo level)
      const promises = batch.map(async ({ handle, path }) => {
        const results: { handle: FileSystemDirectoryHandle; path: string }[] =
          [];
        const localFiles: string[] = [];

        // @ts-expect-error - values() async iterator not in TypeScript types
        for await (const entry of handle.values()) {
          const fullPath = path ? `${path}/${entry.name}` : entry.name;

          if (entry.kind === "file") {
            localFiles.push(fullPath);
          } else if (entry.kind === "directory") {
            results.push({ handle: entry, path: fullPath });
          }
        }

        return { files: localFiles, dirs: results };
      });

      const batchResults = await Promise.all(promises);

      // Thu thập kết quả
      batchResults.forEach(({ files: localFiles, dirs }) => {
        files.push(...localFiles);
        stack.push(...dirs);
      });
    }

    return files;
  } catch (error) {
    console.error("Error listing files recursively:", error);
    throw error;
  }
}

/**
 * Xóa file (hỗ trợ nested paths)
 */
export async function deleteFile(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string
): Promise<void> {
  try {
    const parts = filePath.split("/");
    const fileName = parts.pop()!;

    // Navigate đến folder chứa file
    let currentHandle = dirHandle;
    for (const part of parts) {
      currentHandle = await currentHandle.getDirectoryHandle(part);
    }

    await currentHandle.removeEntry(fileName);
    console.log(`File deleted: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Tạo nested directory (ví dụ: src/components/ui)
 */
export async function createNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileSystemDirectoryHandle> {
  const parts = path.split("/").filter((p) => p);
  let currentHandle = rootHandle;

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, {
      create: true,
    });
  }

  return currentHandle;
}

/**
 * Tạo file trong nested directory
 */
export async function createNestedFile(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string,
  content: string
): Promise<void> {
  const parts = filePath.split("/");
  const fileName = parts.pop()!;
  const dirPath = parts.join("/");

  let dirHandle = rootHandle;
  if (dirPath) {
    dirHandle = await createNestedDirectory(rootHandle, dirPath);
  }

  await createFile(dirHandle, fileName, content);
}
