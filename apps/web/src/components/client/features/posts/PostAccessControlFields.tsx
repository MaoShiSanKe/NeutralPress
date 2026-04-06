"use client";

import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";

export type PostAccessMode = "PUBLIC" | "ROLE" | "PASSWORD";
export type PostAccessRole = "USER" | "AUTHOR" | "EDITOR" | "ADMIN";

export interface PostAccessFormValue {
  accessMode: PostAccessMode;
  minRole: PostAccessRole | null;
  accessPasswords: string[];
}

const ACCESS_MODE_OPTIONS = [
  { value: "PUBLIC", label: "公开" },
  { value: "ROLE", label: "权限限制" },
  { value: "PASSWORD", label: "口令保护" },
] as const;

const ROLE_OPTIONS = [
  { value: "USER", label: "登录用户及以上" },
  { value: "AUTHOR", label: "作者及以上" },
  { value: "EDITOR", label: "编辑及以上" },
  { value: "ADMIN", label: "管理员及以上" },
] as const;

function normalizeAccessPasswords(passwords: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const password of passwords) {
    const trimmed = password.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    normalized.push(trimmed);
    seen.add(trimmed);
  }

  return normalized;
}

function sortPasswords(passwords: string[]): string[] {
  return [...passwords].sort((left, right) => left.localeCompare(right));
}

export function normalizePasswordLines(value: string): string[] {
  return normalizeAccessPasswords(value.split(/\r?\n/));
}

export function normalizePostAccessForm(
  value: PostAccessFormValue,
): PostAccessFormValue {
  if (value.accessMode === "ROLE") {
    return {
      accessMode: "ROLE",
      minRole: value.minRole,
      accessPasswords: [],
    };
  }

  if (value.accessMode === "PASSWORD") {
    return {
      accessMode: "PASSWORD",
      minRole: null,
      accessPasswords: normalizeAccessPasswords(value.accessPasswords),
    };
  }

  return {
    accessMode: "PUBLIC",
    minRole: null,
    accessPasswords: [],
  };
}

export function validatePostAccessForm(
  value: PostAccessFormValue,
): string | null {
  const normalized = normalizePostAccessForm(value);

  if (normalized.accessMode === "ROLE" && !normalized.minRole) {
    return "请选择受限文章的最低访问角色";
  }

  if (
    normalized.accessMode === "PASSWORD" &&
    normalized.accessPasswords.length === 0
  ) {
    return "口令保护文章至少需要一个口令";
  }

  return null;
}

export function hasPostAccessFormChanged(
  current: PostAccessFormValue,
  next: PostAccessFormValue,
): boolean {
  const currentNormalized = normalizePostAccessForm(current);
  const nextNormalized = normalizePostAccessForm(next);

  return (
    currentNormalized.accessMode !== nextNormalized.accessMode ||
    currentNormalized.minRole !== nextNormalized.minRole ||
    JSON.stringify(sortPasswords(currentNormalized.accessPasswords)) !==
      JSON.stringify(sortPasswords(nextNormalized.accessPasswords))
  );
}

export function getPostAccessControlLabel(value: PostAccessFormValue): string {
  const normalized = normalizePostAccessForm(value);

  if (normalized.accessMode === "PUBLIC") {
    return "公开";
  }

  if (normalized.accessMode === "PASSWORD") {
    return `口令保护（${normalized.accessPasswords.length} 个口令）`;
  }

  switch (normalized.minRole) {
    case "USER":
      return "登录用户及以上";
    case "AUTHOR":
      return "作者及以上";
    case "EDITOR":
      return "编辑及以上";
    case "ADMIN":
      return "管理员及以上";
    default:
      return "权限限制";
  }
}

interface PostAccessControlFieldsProps {
  value: PostAccessFormValue;
  onChange: (nextValue: PostAccessFormValue) => void;
  passwordText?: string;
  onPasswordTextChange?: (nextValue: string) => void;
}

export function PostAccessControlFields({
  value,
  onChange,
  passwordText,
  onPasswordTextChange,
}: PostAccessControlFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground/80">
            访问方式
          </label>
          <Select
            value={value.accessMode}
            onChange={(nextValue) => {
              const nextMode = String(nextValue) as PostAccessMode;

              if (nextMode === "ROLE") {
                onChange({
                  ...value,
                  accessMode: "ROLE",
                  minRole: value.minRole ?? "USER",
                });
                return;
              }

              onChange({
                ...value,
                accessMode: nextMode,
              });
            }}
            options={ACCESS_MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            size="sm"
          />
        </div>

        {value.accessMode === "ROLE" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              权限级别
            </label>
            <Select
              value={value.minRole ?? "USER"}
              onChange={(nextValue) =>
                onChange({
                  ...value,
                  accessMode: "ROLE",
                  minRole: String(nextValue) as PostAccessRole,
                })
              }
              options={ROLE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              size="sm"
            />
          </div>
        )}
      </div>

      {value.accessMode === "ROLE" && (
        <p className="text-sm text-muted-foreground">
          只有达到所选角色级别的用户才能查看正文。
        </p>
      )}

      {value.accessMode === "PASSWORD" && (
        <Input
          label="访问口令"
          value={passwordText ?? value.accessPasswords.join("\n")}
          onChange={(event) => {
            onPasswordTextChange?.(event.target.value);
            return onChange({
              ...value,
              accessMode: "PASSWORD",
              accessPasswords: normalizePasswordLines(event.target.value),
            });
          }}
          rows={3}
          size="sm"
          helperText="一行一个口令，输入任一口令即可访问正文"
        />
      )}
    </div>
  );
}
