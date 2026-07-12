import { describe, expect, it } from "vitest";

import type { FolderItem } from "@/lib/client/folder-utils";
import { canEnterFolder, formatFolderName } from "@/lib/client/folder-utils";

// 构造 FolderItem 测试夹具
function makeFolder(overrides: Partial<FolderItem> = {}): FolderItem {
  return {
    id: 1,
    name: "测试文件夹",
    parentId: null,
    userUid: 100,
    systemType: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as FolderItem;
}

describe("formatFolderName", () => {
  it("ROOT_PUBLIC 类型应返回'公共空间'", () => {
    const folder = makeFolder({ systemType: "ROOT_PUBLIC" });
    expect(formatFolderName(folder, "USER", 100)).toBe("公共空间");
  });

  it("ROOT_USERS 类型应返回'用户目录'", () => {
    const folder = makeFolder({ systemType: "ROOT_USERS" });
    expect(formatFolderName(folder, "ADMIN", 100)).toBe("用户目录");
  });

  it("USER_HOME 类型且为当前用户应返回'我的文件夹'", () => {
    const folder = makeFolder({ systemType: "USER_HOME", userUid: 100 });
    expect(formatFolderName(folder, "USER", 100)).toBe("我的文件夹");
  });

  it("USER_HOME 类型但非当前用户应返回原始名称", () => {
    const folder = makeFolder({
      systemType: "USER_HOME",
      userUid: 200,
      name: "其他用户的文件夹",
    });
    expect(formatFolderName(folder, "USER", 100)).toBe("其他用户的文件夹");
  });

  it("普通文件夹（无 systemType）应返回原始名称", () => {
    const folder = makeFolder({ name: "我的照片" });
    expect(formatFolderName(folder, "USER", 100)).toBe("我的照片");
  });
});

describe("canEnterFolder", () => {
  describe("ROOT_PUBLIC", () => {
    it("所有角色都应能进入公共空间", () => {
      const folder = makeFolder({ systemType: "ROOT_PUBLIC" });
      expect(canEnterFolder(folder, "USER", 100)).toBe(true);
      expect(canEnterFolder(folder, "EDITOR", 100)).toBe(true);
      expect(canEnterFolder(folder, "ADMIN", 100)).toBe(true);
    });
  });

  describe("ROOT_USERS", () => {
    it("ADMIN 应能进入用户目录", () => {
      const folder = makeFolder({ systemType: "ROOT_USERS" });
      expect(canEnterFolder(folder, "ADMIN", 100)).toBe(true);
    });

    it("EDITOR 应能进入用户目录", () => {
      const folder = makeFolder({ systemType: "ROOT_USERS" });
      expect(canEnterFolder(folder, "EDITOR", 100)).toBe(true);
    });

    it("普通 USER 不应能进入用户目录", () => {
      const folder = makeFolder({ systemType: "ROOT_USERS" });
      expect(canEnterFolder(folder, "USER", 100)).toBe(false);
    });
  });

  describe("USER_HOME", () => {
    it("文件夹所有者应能进入", () => {
      const folder = makeFolder({ systemType: "USER_HOME", userUid: 100 });
      expect(canEnterFolder(folder, "USER", 100)).toBe(true);
    });

    it("非所有者 USER 不应能进入", () => {
      const folder = makeFolder({ systemType: "USER_HOME", userUid: 200 });
      expect(canEnterFolder(folder, "USER", 100)).toBe(false);
    });

    it("ADMIN 应能进入任何用户的文件夹", () => {
      const folder = makeFolder({ systemType: "USER_HOME", userUid: 200 });
      expect(canEnterFolder(folder, "ADMIN", 100)).toBe(true);
    });

    it("EDITOR 应能进入任何用户的文件夹", () => {
      const folder = makeFolder({ systemType: "USER_HOME", userUid: 200 });
      expect(canEnterFolder(folder, "EDITOR", 100)).toBe(true);
    });
  });

  describe("普通文件夹", () => {
    it("文件夹所有者应能进入", () => {
      const folder = makeFolder({ userUid: 100 });
      expect(canEnterFolder(folder, "USER", 100)).toBe(true);
    });

    it("非所有者 USER 不应能进入", () => {
      const folder = makeFolder({ userUid: 200 });
      expect(canEnterFolder(folder, "USER", 100)).toBe(false);
    });

    it("ADMIN 应能进入任何普通文件夹", () => {
      const folder = makeFolder({ userUid: 200 });
      expect(canEnterFolder(folder, "ADMIN", 100)).toBe(true);
    });

    it("EDITOR 不应能进入非自己的普通文件夹", () => {
      const folder = makeFolder({ userUid: 200 });
      expect(canEnterFolder(folder, "EDITOR", 100)).toBe(false);
    });
  });
});
