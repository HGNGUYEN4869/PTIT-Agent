/**
 * File System Access API - Cho phép web app đọc/ghi file trên máy local
 * Chỉ hoạt động trên Chrome/Edge modern browsers
 */

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
    // @ts-ignore - File System Access API
    if (!window.showDirectoryPicker) {
      console.error("File System Access API not supported in this browser");
      alert(
        "Trình duyệt của bạn không hỗ trợ tính năng này. Vui lòng sử dụng Chrome hoặc Edge."
      );
      return null;
    }

    // @ts-ignore
    const dirHandle = await window.showDirectoryPicker({
      mode: "readwrite", // Cho phép đọc và ghi
    });

    console.log("📁 Directory selected:", dirHandle.name);
    return dirHandle;
  } catch (error) {
    console.error("User cancelled directory selection or error:", error);
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

    console.log(`✅ File created: ${fileName}`);
  } catch (error) {
    console.error(`❌ Error creating file ${fileName}:`, error);
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

    console.log(`📖 File read: ${filePath}`);
    return content;
  } catch (error) {
    console.error(`❌ Error reading file ${filePath}:`, error);
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

    console.log(`✏️ File updated: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error updating file ${filePath}:`, error);
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
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file") {
        files.push(entry.name);
      }
    }

    console.log(`📋 Files found: ${files.length}`);
    return files;
  } catch (error) {
    console.error("❌ Error listing files:", error);
    throw error;
  }
}

/**
 * Liệt kê TẤT CẢ files đệ quy, bao gồm nested folders
 * Trả về danh sách paths như: ["src/App.tsx", "components/Button.tsx"]
 */
export async function listFilesRecursive(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = ""
): Promise<string[]> {
  const files: string[] = [];

  try {
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
      const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.kind === "file") {
        files.push(fullPath);
      } else if (entry.kind === "directory") {
        // Đệ quy vào folder con
        const subFiles = await listFilesRecursive(entry, fullPath);
        files.push(...subFiles);
      }
    }

    return files;
  } catch (error) {
    console.error("❌ Error listing files recursively:", error);
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
    console.log(`🗑️ File deleted: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error deleting file ${filePath}:`, error);
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
