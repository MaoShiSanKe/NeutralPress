import "server-only";

import { cookies } from "next/headers";

import type { UserRole } from "@/lib/server/auth-verify";
import { jwtTokenSign, jwtTokenVerify } from "@/lib/server/jwt";

import type { PostAccessMode, PostStatus, Prisma, Role } from ".prisma/client";

export const PUBLIC_POST_STATUSES = [
  "PUBLISHED",
  "ARCHIVED",
] as const satisfies readonly PostStatus[];
export const PUBLIC_POST_ACCESS_MODE =
  "PUBLIC" as const satisfies PostAccessMode;
export const PUBLIC_POST_BASE_WHERE = {
  deletedAt: null,
  accessMode: PUBLIC_POST_ACCESS_MODE,
} as const;
export const LISTABLE_POST_BASE_WHERE = {
  deletedAt: null,
} as const;
export const PUBLIC_PUBLISHED_POST_WHERE = {
  ...PUBLIC_POST_BASE_WHERE,
  status: "PUBLISHED" as const,
} as const;
export const PUBLIC_POST_PUBLISHED_WHERE = PUBLIC_PUBLISHED_POST_WHERE;
export const LISTABLE_POST_PUBLISHED_WHERE = {
  ...LISTABLE_POST_BASE_WHERE,
  status: "PUBLISHED" as const,
} as const;
export const PUBLIC_VISIBLE_POST_WHERE = {
  ...PUBLIC_POST_BASE_WHERE,
  status: {
    in: [...PUBLIC_POST_STATUSES],
  },
} as const satisfies Prisma.PostWhereInput;
export const PUBLIC_POST_VISIBLE_WHERE = PUBLIC_VISIBLE_POST_WHERE;
export const LISTABLE_POST_VISIBLE_WHERE = {
  ...LISTABLE_POST_BASE_WHERE,
  status: {
    in: [...PUBLIC_POST_STATUSES],
  },
} as const satisfies Prisma.PostWhereInput;

const POST_ACCESS_COOKIE_PREFIX = "POST_ACCESS_";
const POST_ROLE_LEVELS: Record<UserRole, number> = {
  USER: 0,
  AUTHOR: 1,
  EDITOR: 2,
  ADMIN: 3,
};
const VALID_POST_ROLES = new Set<UserRole>([
  "USER",
  "AUTHOR",
  "EDITOR",
  "ADMIN",
]);
const VALID_POST_ACCESS_MODES = new Set<PostAccessMode>([
  "PUBLIC",
  "ROLE",
  "PASSWORD",
]);

type RoleLike = Role | UserRole | string | null | undefined;

export interface PostAccessState {
  accessMode: PostAccessMode;
  minRole: Role | null;
  accessPasswords: string[];
  accessVersion: number;
}

export interface PostAccessInput {
  accessMode?: PostAccessMode | null;
  minRole?: Role | null;
  accessPasswords?: string[] | null;
}

export interface PostAccessComparable extends PostAccessInput {
  accessVersion?: number | null;
}

export interface PostAccessTokenPayload {
  postId: number;
  accessVersion: number;
  type: "post_access";
  iat: number;
  exp: number;
}

export type PostAccessResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "LOGIN_REQUIRED" | "ROLE_REQUIRED" | "PASSWORD_REQUIRED";
    };

function isRoleLike(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_POST_ROLES.has(value as UserRole);
}

function normalizeRole(value: RoleLike): Role | null {
  return isRoleLike(value) ? value : null;
}

function normalizeAccessMode(
  value: PostAccessMode | null | undefined,
): PostAccessMode {
  return value && VALID_POST_ACCESS_MODES.has(value) ? value : "PUBLIC";
}

export function normalizeAccessPasswords(
  passwords: string[] | null | undefined,
): string[] {
  if (!Array.isArray(passwords)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const password of passwords) {
    if (typeof password !== "string") {
      continue;
    }

    const trimmed = password.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function normalizePostAccessInput(
  input: PostAccessInput,
): Omit<PostAccessState, "accessVersion"> {
  const accessMode = normalizeAccessMode(input.accessMode);
  const minRole = normalizeRole(input.minRole);
  const accessPasswords = normalizeAccessPasswords(input.accessPasswords);

  if (accessMode === "ROLE") {
    return {
      accessMode,
      minRole,
      accessPasswords: [],
    };
  }

  if (accessMode === "PASSWORD") {
    return {
      accessMode,
      minRole: null,
      accessPasswords,
    };
  }

  return {
    accessMode: "PUBLIC",
    minRole: null,
    accessPasswords: [],
  };
}

export function normalizePostAccessState(
  input: PostAccessComparable,
): PostAccessState {
  const normalized = normalizePostAccessInput(input);

  return {
    ...normalized,
    accessVersion:
      typeof input.accessVersion === "number" &&
      Number.isInteger(input.accessVersion) &&
      input.accessVersion > 0
        ? input.accessVersion
        : 1,
  };
}

export function validatePostAccessInput(input: PostAccessInput): string | null {
  const normalized = normalizePostAccessInput(input);

  if (normalized.accessMode === "ROLE" && !normalized.minRole) {
    return "角色权限文章必须设置最低角色";
  }

  if (
    normalized.accessMode === "PASSWORD" &&
    normalized.accessPasswords.length === 0
  ) {
    return "口令保护文章至少需要一个口令";
  }

  return null;
}

function sortPasswords(passwords: string[]): string[] {
  return [...passwords].sort((left, right) => left.localeCompare(right));
}

export function hasPostAccessChanged(
  current: PostAccessComparable,
  next: PostAccessInput,
): boolean {
  const currentState = normalizePostAccessState(current);
  const nextState = normalizePostAccessInput(next);

  return (
    currentState.accessMode !== nextState.accessMode ||
    currentState.minRole !== nextState.minRole ||
    JSON.stringify(sortPasswords(currentState.accessPasswords)) !==
      JSON.stringify(sortPasswords(nextState.accessPasswords))
  );
}

export function hasRoleAtLeast(userRole: RoleLike, minRole: RoleLike): boolean {
  const normalizedUserRole = normalizeRole(userRole);
  const normalizedMinRole = normalizeRole(minRole);

  if (!normalizedUserRole || !normalizedMinRole) {
    return false;
  }

  return (
    POST_ROLE_LEVELS[normalizedUserRole] >= POST_ROLE_LEVELS[normalizedMinRole]
  );
}

export function getPostAccessCookieName(postId: number): string {
  return `${POST_ACCESS_COOKIE_PREFIX}${postId}`;
}

export function signPostAccessToken(
  postId: number,
  accessVersion: number,
): string {
  return jwtTokenSign({
    inner: {
      postId,
      accessVersion,
      type: "post_access",
    },
  });
}

export function verifyPostAccessToken(
  token: string | undefined,
  expectedPostId: number,
  expectedAccessVersion: number,
): boolean {
  if (!token) {
    return false;
  }

  const payload = jwtTokenVerify<PostAccessTokenPayload>(token);
  if (!payload) {
    return false;
  }

  return (
    payload.type === "post_access" &&
    payload.postId === expectedPostId &&
    payload.accessVersion === expectedAccessVersion
  );
}

export async function setPostAccessCookie(
  postId: number,
  accessVersion: number,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    getPostAccessCookieName(postId),
    signPostAccessToken(postId, accessVersion),
    {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}

export async function clearPostAccessCookie(postId: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(getPostAccessCookieName(postId), "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
}

export async function hasValidPostAccessCookie(
  postId: number,
  accessVersion: number,
): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getPostAccessCookieName(postId))?.value;
  return verifyPostAccessToken(token, postId, accessVersion);
}

export async function evaluatePostAccess(params: {
  post: PostAccessComparable & { id: number };
  userRole?: RoleLike;
}): Promise<PostAccessResult> {
  const post = normalizePostAccessState(params.post);

  if (post.accessMode === "PUBLIC") {
    return { allowed: true };
  }

  if (post.accessMode === "ROLE") {
    if (!params.userRole) {
      return { allowed: false, reason: "LOGIN_REQUIRED" };
    }

    if (!hasRoleAtLeast(params.userRole, post.minRole)) {
      return { allowed: false, reason: "ROLE_REQUIRED" };
    }

    return { allowed: true };
  }

  if (await hasValidPostAccessCookie(params.post.id, post.accessVersion)) {
    return { allowed: true };
  }

  return { allowed: false, reason: "PASSWORD_REQUIRED" };
}

function normalizeBackupAccessMode(value: unknown): PostAccessMode {
  return typeof value === "string" &&
    VALID_POST_ACCESS_MODES.has(value as PostAccessMode)
    ? (value as PostAccessMode)
    : "PUBLIC";
}

function normalizeBackupRole(value: unknown): Role | null {
  return typeof value === "string" && VALID_POST_ROLES.has(value as UserRole)
    ? (value as Role)
    : null;
}

function normalizeBackupAccessVersion(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

export function normalizeBackupPostRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...row,
    accessMode: normalizeBackupAccessMode(row.accessMode),
    minRole: normalizeBackupRole(row.minRole),
    accessPasswords: normalizeAccessPasswords(
      Array.isArray(row.accessPasswords)
        ? row.accessPasswords.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    ),
    accessVersion: normalizeBackupAccessVersion(row.accessVersion),
  };
}
