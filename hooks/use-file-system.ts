"use client";

import { useState, useCallback } from "react";
import {
  selectDirectory,
  createFile,
  readFile,
  updateFile,
  listFiles,
  listFilesRecursive,
  deleteFile,
  createNestedFile,
} from "@/lib/fileSystemAPI";

export interface FileSystemState {
  directoryHandle: FileSystemDirectoryHandle | null;
  isSupported: boolean;
  files: string[];
  currentDirectory: string;
}

export function useFileSystem() {
  const [state, setState] = useState<FileSystemState>({
    directoryHandle: null,
    isSupported:
      typeof window !== "undefined" && "showDirectoryPicker" in window,
    files: [],
    currentDirectory: "",
  });

  /**
   * Yêu cầu user chọn folder để làm việc
   */
  const selectWorkingDirectory = useCallback(async () => {
    const handle = await selectDirectory();
    if (handle) {
      setState((prev) => ({
        ...prev,
        directoryHandle: handle,
        currentDirectory: handle.name,
      }));

      // Auto load file list
      await loadFileList(handle);
    }
  }, []);

  /**
   * Load danh sách files (RECURSIVE - lấy tất cả files trong nested folders)
   */
  const loadFileList = useCallback(
    async (handle?: FileSystemDirectoryHandle) => {
      const dirHandle = handle || state.directoryHandle;
      if (!dirHandle) return;

      const files = await listFilesRecursive(dirHandle);
      setState((prev) => ({ ...prev, files }));

      console.log(`📂 Loaded ${files.length} files recursively`);
    },
    [state.directoryHandle]
  );

  /**
   * Tạo file mới từ code do backend sinh ra
   * AUTO-PROMPT user chọn thư mục nếu chưa chọn
   */
  const createFileFromCode = useCallback(
    async (fileName: string, code: string): Promise<boolean> => {
      // Nếu chưa chọn thư mục, tự động prompt user
      if (!state.directoryHandle) {
        const userConfirm = confirm(
          `AI cần tạo file "${fileName}"\n\nBạn cần chọn thư mục để lưu file này. Chọn OK để chọn thư mục.`
        );

        if (!userConfirm) {
          console.log("User cancelled folder selection");
          return false;
        }

        // Auto open folder picker
        const handle = await selectDirectory();
        if (!handle) {
          alert("Không thể tạo file vì bạn chưa chọn thư mục!");
          return false;
        }

        // Update state
        setState((prev) => ({
          ...prev,
          directoryHandle: handle,
          currentDirectory: handle.name,
        }));

        // Tạo file với handle mới
        try {
          await createFile(handle, fileName, code);
          await loadFileList(handle);
          return true;
        } catch (error) {
          console.error("Error creating file:", error);
          return false;
        }
      }

      // Đã có directoryHandle, tạo file bình thường
      try {
        await createFile(state.directoryHandle, fileName, code);
        await loadFileList();
        return true;
      } catch (error) {
        console.error("Error creating file:", error);
        return false;
      }
    },
    [state.directoryHandle, loadFileList]
  );

  /**
   * Tạo file với đường dẫn nested (src/components/Button.tsx)
   * AUTO-PROMPT user chọn thư mục nếu chưa chọn
   */
  const createNestedFileFromCode = useCallback(
    async (filePath: string, code: string): Promise<boolean> => {
      // Nếu chưa chọn thư mục, tự động prompt user
      if (!state.directoryHandle) {
        const userConfirm = confirm(
          `AI cần tạo file "${filePath}"\n\nBạn cần chọn thư mục để lưu file này. Chọn OK để chọn thư mục.`
        );

        if (!userConfirm) {
          console.log("User cancelled folder selection");
          return false;
        }

        // Auto open folder picker
        const handle = await selectDirectory();
        if (!handle) {
          alert("Không thể tạo file vì bạn chưa chọn thư mục!");
          return false;
        }

        // Update state
        setState((prev) => ({
          ...prev,
          directoryHandle: handle,
          currentDirectory: handle.name,
        }));

        // Tạo file với handle mới
        try {
          await createNestedFile(handle, filePath, code);
          await loadFileList(handle);
          return true;
        } catch (error) {
          console.error("Error creating nested file:", error);
          return false;
        }
      }

      // Đã có directoryHandle, tạo file bình thường
      try {
        await createNestedFile(state.directoryHandle, filePath, code);
        await loadFileList();
        return true;
      } catch (error) {
        console.error("Error creating nested file:", error);
        return false;
      }
    },
    [state.directoryHandle, loadFileList]
  );

  /**
   * Đọc file
   */
  const readFileContent = useCallback(
    async (fileName: string): Promise<string | null> => {
      if (!state.directoryHandle) return null;

      try {
        return await readFile(state.directoryHandle, fileName);
      } catch (error) {
        console.error("Error reading file:", error);
        return null;
      }
    },
    [state.directoryHandle]
  );

  /**
   * Update file (sửa file)
   */
  const updateFileContent = useCallback(
    async (fileName: string, newCode: string): Promise<boolean> => {
      if (!state.directoryHandle) return false;

      try {
        await updateFile(state.directoryHandle, fileName, newCode);
        return true;
      } catch (error) {
        console.error("Error updating file:", error);
        return false;
      }
    },
    [state.directoryHandle]
  );

  /**
   * Xóa file
   */
  const deleteFileByName = useCallback(
    async (fileName: string): Promise<boolean> => {
      if (!state.directoryHandle) return false;

      try {
        await deleteFile(state.directoryHandle, fileName);
        await loadFileList();
        return true;
      } catch (error) {
        console.error("Error deleting file:", error);
        return false;
      }
    },
    [state.directoryHandle, loadFileList]
  );

  /**
   * Process code từ backend và tự động tạo/sửa files
   * AUTO-PROMPT user chọn thư mục nếu chưa chọn
   */
  const processBackendCode = useCallback(
    async (
      operations: Array<{
        type: "create" | "update" | "delete";
        path: string;
        content?: string;
      }>
    ): Promise<void> => {
      // Nếu chưa chọn thư mục, tự động prompt user
      if (!state.directoryHandle) {
        const userConfirm = confirm(
          `AI cần tạo/sửa ${operations.length} file(s)\n\nBạn cần chọn thư mục để lưu các file này. Chọn OK để chọn thư mục.`
        );

        if (!userConfirm) {
          console.log("User cancelled folder selection");
          return;
        }

        // Auto open folder picker
        const handle = await selectDirectory();
        if (!handle) {
          alert("Không thể tạo file vì bạn chưa chọn thư mục!");
          return;
        }

        // Update state
        setState((prev) => ({
          ...prev,
          directoryHandle: handle,
          currentDirectory: handle.name,
        }));

        // Process với handle mới
        for (const op of operations) {
          try {
            switch (op.type) {
              case "create":
                if (op.content) {
                  await createNestedFile(handle, op.path, op.content);
                  console.log(` Created: ${op.path}`);
                }
                break;

              case "update":
                if (op.content) {
                  await updateFile(handle, op.path, op.content);
                  console.log(` Updated: ${op.path}`);
                }
                break;

              case "delete":
                await deleteFile(handle, op.path);
                console.log(` Deleted: ${op.path}`);
                break;
            }
          } catch (error) {
            console.error(`Error processing ${op.type} for ${op.path}:`, error);
          }
        }

        await loadFileList(handle);
        return;
      }

      // Đã có directoryHandle, process bình thường
      for (const op of operations) {
        try {
          switch (op.type) {
            case "create":
              if (op.content) {
                await createNestedFile(
                  state.directoryHandle,
                  op.path,
                  op.content
                );
                console.log(` Created: ${op.path}`);
              }
              break;

            case "update":
              if (op.content) {
                await updateFile(state.directoryHandle, op.path, op.content);
                console.log(` Updated: ${op.path}`);
              }
              break;

            case "delete":
              await deleteFile(state.directoryHandle, op.path);
              console.log(` Deleted: ${op.path}`);
              break;
          }
        } catch (error) {
          console.error(`Error processing ${op.type} for ${op.path}:`, error);
        }
      }

      await loadFileList();
    },
    [state.directoryHandle, loadFileList]
  );

  return {
    ...state,
    selectWorkingDirectory,
    loadFileList,
    createFileFromCode,
    createNestedFileFromCode,
    readFileContent,
    updateFileContent,
    deleteFileByName,
    processBackendCode,
  };
}
