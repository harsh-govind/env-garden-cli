import type { ParsedArgs } from "./args.js";
import type { CliFetch } from "./api.js";
import type { createWorkspaceApi } from "../lib/workspace-api.js";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type ProjectRole = "OWNER" | "CONTRIBUTOR" | "VIEWER";

export type WorkspaceSummary = {
  id: string;
  name: string;
};

export type CreatedWorkspaceResponse = {
  workspaceId: string;
};

export type WorkspaceDetail = WorkspaceSummary & {
  role: WorkspaceRole;
  projectAccessScope: string;
  projectCount: number;
  memberCount: number;
  historyCount: number;
  projects: WorkspaceSummary[];
};

export type EnvFileSummary = {
  id: string;
  name: string;
  environment: string;
  description: string | null;
  variableCount: number;
};

export type ProjectDetail = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  role: ProjectRole;
  canManage: boolean;
  envFiles: EnvFileSummary[];
};

export type WorkspaceMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  projectAccessScope: string;
  defaultProjectRole: ProjectRole;
  canEdit: boolean;
  canRemove: boolean;
};

export type WorkspaceInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  expiresAt: string;
};

export type WorkspaceMembers = {
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
};

export type HistoryEntry = {
  id: string;
  operation: string;
  message: string;
  createdAt: string;
};

export type HistoryPage = {
  history: HistoryEntry[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type MemberAccessPayload = {
  role: WorkspaceRole;
  projectAccessScope: "ALL_PROJECTS" | "SELECTED_PROJECTS";
  defaultProjectRole: ProjectRole;
  projects?: {
    projectId: string;
    role: ProjectRole;
    environmentAccessScope: "ALL_ENVIRONMENTS";
    environments: string[];
  }[];
};

export type ManageCommandInput = {
  parsed: ParsedArgs;
  fetchImplementation?: CliFetch;
};

export type TableRow = string[];

export type WorkspaceApi = ReturnType<typeof createWorkspaceApi>;

export type WorkspacesResponse = {
  workspaces: WorkspaceSummary[];
};

export type WorkspaceResponse = {
  workspace: WorkspaceDetail;
};

export type ProjectResponse = {
  project: ProjectDetail;
};

export type CreatedProjectResponse = {
  project: WorkspaceSummary;
};

export type EnvFileResponse = {
  envFile: EnvFileSummary;
};

export type MemberResponse = {
  member: WorkspaceMember;
};
