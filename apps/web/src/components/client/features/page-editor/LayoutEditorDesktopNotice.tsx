"use client";

import { RiComputerLine } from "@remixicon/react";

export default function LayoutEditorDesktopNotice() {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
      <RiComputerLine size={36} />
      <p className="text-sm">布局编辑器请使用电脑访问</p>
    </div>
  );
}
