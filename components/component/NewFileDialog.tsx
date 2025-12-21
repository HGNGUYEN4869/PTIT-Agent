"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface NewFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFile: (fileName: string) => Promise<void>;
}

export function NewFileDialog({
  open,
  onOpenChange,
  onCreateFile,
}: NewFileDialogProps) {
  const [fileName, setFileName] = useState("");

  const handleCreate = async () => {
    await onCreateFile(fileName);
    setFileName(""); // Clear input after creating
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tạo file mới</DialogTitle>
          <DialogDescription>
            Nhập tên file (có thể bao gồm đường dẫn, ví dụ: src/main.py)
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filename" className="text-right">
              Tên file
            </Label>
            <Input
              id="filename"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="example.txt hoặc src/main.py"
              className="col-span-3"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleCreate}>Tạo file</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
