"use client";

import { useState, useCallback } from "react";
import {
  selectDirectory,
  readFile,
  updateFile,
  listFilesRecursive,
  listDirectoryEntries,
  deleteFile,
  createNestedFile,
  type FileSystemEntry,
} from "@/lib/fileSystemAPI";
import { toolGateway } from "@/lib/agentSystem";

export interface FileSystemState {
  directoryHandle: FileSystemDirectoryHandle | null;
  isSupported: boolean;
  files: string[];
  currentDirectory: string;
  entries: FileSystemEntry[]; // Lazy loading entries
}

export function useFileSystem() {
  const [state, setState] = useState<FileSystemState>({
    directoryHandle: null,
    isSupported:
      typeof window !== "undefined" && "showDirectoryPicker" in window,
    files: [],
    currentDirectory: "",
    entries: [],
  });

  /**
   * Yêu cầu user chọn folder để làm việc
   * Sync với ToolGateway để cache directory handle
   */
  const selectWorkingDirectory = useCallback(async () => {
    const handle = await selectDirectory();
    if (handle) {
      setState((prev) => ({
        ...prev,
        directoryHandle: handle,
        currentDirectory: handle.name,
      }));

      // Sync với ToolGateway để cache (non-serializable)
      toolGateway.setDirectoryHandle(handle);

      console.log(`✅ Directory selected and synced: ${handle.name}`);

      // Auto load entries (lazy loading - chỉ 1 level)
      await loadDirectoryEntries(handle);
    }
  }, []);

  /**
   * Load entries của 1 directory (Lazy Loading - chỉ 1 level)
   */
  const loadDirectoryEntries = useCallback(
    async (handle?: FileSystemDirectoryHandle, basePath?: string) => {
      const dirHandle = handle || state.directoryHandle;
      if (!dirHandle) return [];

      const entries = await listDirectoryEntries(dirHandle, basePath);

      if (!basePath) {
        // Root level - update state
        setState((prev) => ({ ...prev, entries }));
      }

      return entries;
    },
    [state.directoryHandle]
  );

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
   * Update file (sửa file) - For Manual Mode
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
   * Xóa file - For Manual Mode
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
   * Tạo file mới - For Manual Mode
   */
  const createNewFile = useCallback(
    async (filePath: string, content: string): Promise<boolean> => {
      if (!state.directoryHandle) return false;

      try {
        await createNestedFile(state.directoryHandle, filePath, content);
        await loadFileList();
        return true;
      } catch (error) {
        console.error("Error creating file:", error);
        return false;
      }
    },
    [state.directoryHandle, loadFileList]
  );

  return {
    ...state,
    selectWorkingDirectory,
    loadFileList,
    loadDirectoryEntries,
    readFileContent,
    updateFileContent,
    deleteFileByName,
    createNewFile,
  };
}
