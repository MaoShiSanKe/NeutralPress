import { describe, expect, it } from "vitest";

import {
  formatAperture,
  formatColorSpace,
  formatDateTime,
  formatExposureBias,
  formatExposureMode,
  formatExposureProgram,
  formatExposureTime,
  formatFlash,
  formatFocalLength,
  formatGPS,
  formatLensSpec,
  formatMeteringMode,
  formatSceneCaptureType,
  formatSensingMethod,
  formatShotDateTime,
  formatWhiteBalance,
} from "@/lib/client/media-exif";

describe("formatDateTime", () => {
  it("应格式化 Date 对象为中文日期字符串", () => {
    const date = new Date("2024-01-15T10:30:45");
    const result = formatDateTime(date);
    expect(result).toContain("2024");
    expect(result).toContain("01");
    expect(result).toContain("15");
  });

  it("应格式化日期字符串", () => {
    const result = formatDateTime("2024-06-20T14:00:00");
    expect(result).toContain("2024");
    expect(result).toContain("06");
    expect(result).toContain("20");
  });

  it("空字符串应返回空字符串", () => {
    expect(formatDateTime("")).toBe("");
  });
});

describe("formatExposureTime", () => {
  it("大于等于 1 秒的时间应显示为秒", () => {
    expect(formatExposureTime(1)).toBe("1s");
    expect(formatExposureTime(2)).toBe("2s");
    expect(formatExposureTime(0.5)).toBe("1/2s");
  });

  it("小于 1 秒的时间应显示为分数", () => {
    expect(formatExposureTime(1 / 60)).toBe("1/60s");
    expect(formatExposureTime(1 / 250)).toBe("1/250s");
    expect(formatExposureTime(1 / 1000)).toBe("1/1000s");
  });

  it("应处理常见的快门速度", () => {
    expect(formatExposureTime(1 / 30)).toBe("1/30s");
    expect(formatExposureTime(1 / 125)).toBe("1/125s");
  });
});

describe("formatAperture", () => {
  it("应格式化光圈值", () => {
    expect(formatAperture(2.8)).toBe("f/2.8");
    expect(formatAperture(1.4)).toBe("f/1.4");
    expect(formatAperture(11)).toBe("f/11.0");
  });

  it("应保留一位小数", () => {
    expect(formatAperture(5.6)).toBe("f/5.6");
    expect(formatAperture(8)).toBe("f/8.0");
  });
});

describe("formatFocalLength", () => {
  it("应格式化焦距", () => {
    expect(formatFocalLength(50)).toBe("50mm");
    expect(formatFocalLength(24)).toBe("24mm");
    expect(formatFocalLength(70)).toBe("70mm");
  });
});

describe("formatGPS", () => {
  it("应格式化北纬东经坐标", () => {
    const result = formatGPS(39.9042, 116.4074);
    expect(result).toContain("N");
    expect(result).toContain("E");
    expect(result).toContain("39.904200");
    expect(result).toContain("116.407400");
  });

  it("应格式化南纬西经坐标", () => {
    const result = formatGPS(-33.8688, -151.2093);
    expect(result).toContain("S");
    expect(result).toContain("W");
  });

  it("零坐标应显示为北纬东经", () => {
    const result = formatGPS(0, 0);
    expect(result).toContain("N");
    expect(result).toContain("E");
  });
});

describe("formatMeteringMode", () => {
  it("应返回已知测光模式的中文名称", () => {
    expect(formatMeteringMode(0)).toBe("未知");
    expect(formatMeteringMode(1)).toBe("平均测光");
    expect(formatMeteringMode(2)).toBe("中央重点平均测光");
    expect(formatMeteringMode(3)).toBe("点测光");
    expect(formatMeteringMode(5)).toBe("评价测光");
    expect(formatMeteringMode(6)).toBe("局部测光");
    expect(formatMeteringMode(255)).toBe("其他");
  });

  it("未知模式应返回带编号的字符串", () => {
    expect(formatMeteringMode(99)).toBe("未知 (99)");
  });
});

describe("formatExposureProgram", () => {
  it("应返回已知曝光程序的中文名称", () => {
    expect(formatExposureProgram(0)).toBe("未定义");
    expect(formatExposureProgram(1)).toBe("手动");
    expect(formatExposureProgram(2)).toBe("程序自动");
    expect(formatExposureProgram(3)).toBe("光圈优先");
    expect(formatExposureProgram(4)).toBe("快门优先");
    expect(formatExposureProgram(5)).toBe("创意程序");
    expect(formatExposureProgram(8)).toBe("风景模式");
  });

  it("未知程序应返回带编号的字符串", () => {
    expect(formatExposureProgram(99)).toBe("未知 (99)");
  });
});

describe("formatExposureMode", () => {
  it("应返回已知曝光模式的中文名称", () => {
    expect(formatExposureMode(0)).toBe("自动曝光");
    expect(formatExposureMode(1)).toBe("手动曝光");
    expect(formatExposureMode(2)).toBe("自动包围曝光");
  });

  it("未知模式应返回带编号的字符串", () => {
    expect(formatExposureMode(99)).toBe("未知 (99)");
  });
});

describe("formatWhiteBalance", () => {
  it("应返回已知白平衡模式的中文名称", () => {
    expect(formatWhiteBalance(0)).toBe("自动白平衡");
    expect(formatWhiteBalance(1)).toBe("手动白平衡");
  });

  it("未知模式应返回带编号的字符串", () => {
    expect(formatWhiteBalance(99)).toBe("未知 (99)");
  });
});

describe("formatSceneCaptureType", () => {
  it("应返回已知场景类型的中文名称", () => {
    expect(formatSceneCaptureType(0)).toBe("标准");
    expect(formatSceneCaptureType(1)).toBe("风景");
    expect(formatSceneCaptureType(2)).toBe("人像");
    expect(formatSceneCaptureType(3)).toBe("夜景");
  });

  it("未知类型应返回带编号的字符串", () => {
    expect(formatSceneCaptureType(99)).toBe("未知 (99)");
  });
});

describe("formatFlash", () => {
  it("未闪光（位 0 为 0）应返回未闪光", () => {
    expect(formatFlash(0)).toBe("未闪光");
  });

  it("已闪光（位 0 为 1）应返回已闪光", () => {
    expect(formatFlash(1)).toBe("已闪光");
  });

  it("应正确解析闪光灯模式位", () => {
    // 位 3-4 = 01 (强制闪光) + 位 0 = 1 (已闪光)
    expect(formatFlash(0x09)).toContain("强制闪光");
    // 位 3-4 = 10 (强制关闭) + 位 0 = 0 (未闪光)
    expect(formatFlash(0x10)).toContain("强制关闭");
    // 位 3-4 = 11 (自动模式)
    expect(formatFlash(0x19)).toContain("自动模式");
  });

  it("应检测红眼消除标志", () => {
    expect(formatFlash(0x41)).toContain("红眼消除");
    expect(formatFlash(0x01)).not.toContain("红眼消除");
  });

  it("应检测返回光信息", () => {
    // 位 1-2 = 10 (检测到返回光)
    expect(formatFlash(0x04 | 0x01)).toContain("检测到返回光");
    // 位 1-2 = 11 (未检测到返回光)
    expect(formatFlash(0x06 | 0x01)).toContain("未检测到返回光");
  });
});

describe("formatColorSpace", () => {
  it("应返回已知色彩空间的名称", () => {
    expect(formatColorSpace(1)).toBe("sRGB");
    expect(formatColorSpace(2)).toBe("Adobe RGB");
    expect(formatColorSpace(65535)).toBe("未校准");
  });

  it("未知色彩空间应返回带编号的字符串", () => {
    expect(formatColorSpace(99)).toBe("未知 (99)");
  });
});

describe("formatSensingMethod", () => {
  it("应返回已知传感器类型的中文名称", () => {
    expect(formatSensingMethod(1)).toBe("未定义");
    expect(formatSensingMethod(2)).toBe("单芯片彩色区域传感器");
    expect(formatSensingMethod(3)).toBe("双芯片彩色区域传感器");
    expect(formatSensingMethod(7)).toBe("三线性传感器");
  });

  it("未知方法应返回带编号的字符串", () => {
    expect(formatSensingMethod(99)).toBe("未知 (99)");
  });
});

describe("formatExposureBias", () => {
  it("正偏差应带加号", () => {
    expect(formatExposureBias(1.5)).toBe("+1.5 EV");
    expect(formatExposureBias(0)).toBe("+0.0 EV");
  });

  it("负偏差应带减号", () => {
    expect(formatExposureBias(-2.0)).toBe("-2.0 EV");
    expect(formatExposureBias(-0.7)).toBe("-0.7 EV");
  });
});

describe("formatLensSpec", () => {
  it("应格式化定焦镜头规格", () => {
    const result = formatLensSpec([50, 50, 1.4, 1.4]);
    expect(result).toBe("50.0mm f/1.4");
  });

  it("应格式化变焦镜头规格", () => {
    const result = formatLensSpec([24, 70, 2.8, 2.8]);
    expect(result).toBe("24.0-70.0mm f/2.8-2.8");
  });

  it("应格式化变焦镜头规格（不同光圈）", () => {
    const result = formatLensSpec([70, 200, 2.8, 4.0]);
    expect(result).toBe("70.0-200.0mm f/2.8-4.0");
  });

  it("空数组应返回空字符串", () => {
    expect(formatLensSpec([])).toBe("");
  });

  it("不足 4 个元素应返回空字符串", () => {
    expect(formatLensSpec([50, 50])).toBe("");
    expect(formatLensSpec([50])).toBe("");
  });
});

describe("formatShotDateTime", () => {
  it("应格式化拍摄时间", () => {
    const date = new Date("2024-01-15T10:30:45");
    const result = formatShotDateTime(date, "+08:00", "123");
    expect(result).not.toBeNull();
    expect(result!.dateStr).toContain("2024");
    expect(result!.offsetTime).toBe("+08:00");
    expect(result!.subSecTime).toBe("123");
  });

  it("无日期应返回 null", () => {
    expect(formatShotDateTime(undefined, undefined, undefined)).toBeNull();
  });

  it("无偏移时间和毫秒时应返回 undefined", () => {
    const date = new Date("2024-01-15T10:30:45");
    const result = formatShotDateTime(date, undefined, undefined);
    expect(result).not.toBeNull();
    expect(result!.offsetTime).toBeUndefined();
    expect(result!.subSecTime).toBeUndefined();
  });

  it("空字符串的偏移时间和毫秒应返回 undefined", () => {
    const date = new Date("2024-01-15T10:30:45");
    const result = formatShotDateTime(date, "", "");
    expect(result).not.toBeNull();
    expect(result!.offsetTime).toBeUndefined();
    expect(result!.subSecTime).toBeUndefined();
  });
});
