import { requireAuthorization, type AuthorizationContext } from "../security/authorization";

export interface FolderNode { id: string; parentFolderId: string | null; name: string; documentCount: number; }
export interface FolderDocument { documentId: string; documentNumber: string; title: string; folderId: string | null; }
export interface FolderStore {
  list(organizationId: string): Promise<{ folders: FolderNode[]; documents: FolderDocument[] }>;
  createFolder(input: { organizationId: string; parentFolderId: string | null; name: string; actorUserId: string; occurredAt: Date }): Promise<{ id: string }>;
  renameFolder(input: { organizationId: string; folderId: string; name: string; actorUserId: string; occurredAt: Date }): Promise<void>;
  placeDocument(input: { organizationId: string; documentId: string; folderId: string; actorUserId: string; occurredAt: Date }): Promise<void>;
}

export class FolderHierarchyService {
  constructor(private readonly store: FolderStore, private readonly clock: () => Date = () => new Date()) {}

  async list(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "document.read" });
    return this.store.list(organizationId);
  }

  async create(context: AuthorizationContext, input: { organizationId: string; parentFolderId: string | null; name: string }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "document.create" });
    const name = validateName(input.name);
    return this.store.createFolder({ ...input, name, actorUserId: context.userId, occurredAt: this.clock() });
  }

  async rename(context: AuthorizationContext, input: { organizationId: string; folderId: string; name: string }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "document.create" });
    await this.store.renameFolder({ ...input, name: validateName(input.name), actorUserId: context.userId, occurredAt: this.clock() });
  }

  async place(context: AuthorizationContext, input: { organizationId: string; documentId: string; folderId: string }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "document.create" });
    await this.store.placeDocument({ ...input, actorUserId: context.userId, occurredAt: this.clock() });
  }
}

function validateName(value: string) {
  const name = value.trim();
  if (!name || name.length > 120) throw new FolderValidationError("Folder name must contain 1 to 120 characters");
  return name;
}

export class FolderValidationError extends Error {}