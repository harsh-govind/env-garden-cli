export type ProjectLink = {
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  envFileId: string;
  envFileName: string;
};

export type FoundProjectLink = {
  link: ProjectLink;
  path: string;
};

export type NamedEntity = {
  id: string;
  name: string;
};
