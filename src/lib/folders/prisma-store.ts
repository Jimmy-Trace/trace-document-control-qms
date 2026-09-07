import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { FolderStore } from "./service";
import { FolderValidationError } from "./service";

export class PrismaFolderStore implements FolderStore {
  async list(organizationId: string) {
    const [folders, placements, documents] = await Promise.all([
      db.$queryRaw<Array<{ id: string; parentFolderId: string | null; name: string }>>(Prisma.sql`
        SELECT "id", "parentFolderId", "name" FROM "DocumentFolder"
        WHERE "organizationId" = ${organizationId}::uuid ORDER BY lower("name"), "id"`),
      db.$queryRaw<Array<{ documentId: string; folderId: string }>>(Prisma.sql`
        SELECT "documentId", "folderId" FROM "DocumentFolderPlacement"
        WHERE "organizationId" = ${organizationId}::uuid`),
      db.document.findMany({
        where: { organizationId },
        select: { id: true, documentNumber: true, title: true },
        orderBy: [{ documentNumber: "asc" }, { title: "asc" }],
      }),
    ]);
    const folderByDocument = new Map(placements.map((row) => [row.documentId, row.folderId]));
    const countByFolder = new Map<string, number>();
    for (const row of placements) countByFolder.set(row.folderId, (countByFolder.get(row.folderId) ?? 0) + 1);
    return {
      folders: folders.map((row) => ({ ...row, documentCount: countByFolder.get(row.id) ?? 0 })),
      documents: documents.map((row) => ({ documentId: row.id, documentNumber: row.documentNumber, title: row.title, folderId: folderByDocument.get(row.id) ?? null })),
    };
  }

  async createFolder(input: { organizationId: string; parentFolderId: string | null; name: string; actorUserId: string; occurredAt: Date }) {
    return db.$transaction(async (tx) => {
      if (input.parentFolderId) {
        const parent = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "DocumentFolder" WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.parentFolderId}::uuid`);
        if (!parent.length) throw new Error("Access denied");
      }
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO "DocumentFolder" ("organizationId", "parentFolderId", "name", "createdByUserId", "createdAt", "updatedAt")
        VALUES (${input.organizationId}::uuid, ${input.parentFolderId}::uuid, ${input.name}, ${input.actorUserId}::uuid, ${input.occurredAt}, ${input.occurredAt}) RETURNING "id"`);
      const id = rows[0]!.id;
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: "DOCUMENT_FOLDER_CREATED", entityType: "DocumentFolder", entityId: id, occurredAt: input.occurredAt, metadata: { name: input.name, parentFolderId: input.parentFolderId } as Prisma.InputJsonValue } });
      return { id };
    });
  }

  async renameFolder(input: { organizationId: string; folderId: string; name: string; actorUserId: string; occurredAt: Date }) {
    await db.$transaction(async (tx) => {
      const prior = await tx.$queryRaw<Array<{ name: string }>>(Prisma.sql`SELECT "name" FROM "DocumentFolder" WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.folderId}::uuid`);
      if (!prior.length) throw new Error("Access denied");
      await tx.$executeRaw(Prisma.sql`UPDATE "DocumentFolder" SET "name"=${input.name}, "updatedAt"=${input.occurredAt} WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.folderId}::uuid`);
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: "DOCUMENT_FOLDER_RENAMED", entityType: "DocumentFolder", entityId: input.folderId, occurredAt: input.occurredAt, metadata: { priorName: prior[0]!.name, name: input.name } as Prisma.InputJsonValue } });
    }).catch((error) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FolderValidationError("A sibling folder with that name already exists"); throw error; });
  }

  async placeDocument(input: { organizationId: string; documentId: string; folderId: string; actorUserId: string; occurredAt: Date }) {
    await db.$transaction(async (tx) => {
      const [document, folder, prior] = await Promise.all([
        tx.document.findFirst({ where: { organizationId: input.organizationId, id: input.documentId }, select: { id: true } }),
        tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "DocumentFolder" WHERE "organizationId"=${input.organizationId}::uuid AND "id"=${input.folderId}::uuid`),
        tx.$queryRaw<Array<{ folderId: string }>>(Prisma.sql`SELECT "folderId" FROM "DocumentFolderPlacement" WHERE "organizationId"=${input.organizationId}::uuid AND "documentId"=${input.documentId}::uuid`),
      ]);
      if (!document || !folder.length) throw new Error("Access denied");
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DocumentFolderPlacement" ("organizationId", "documentId", "folderId", "placedByUserId", "placedAt")
        VALUES (${input.organizationId}::uuid, ${input.documentId}::uuid, ${input.folderId}::uuid, ${input.actorUserId}::uuid, ${input.occurredAt})
        ON CONFLICT ("organizationId", "documentId") DO UPDATE SET "folderId"=EXCLUDED."folderId", "placedByUserId"=EXCLUDED."placedByUserId", "placedAt"=EXCLUDED."placedAt"`);
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: "DOCUMENT_FOLDER_PLACEMENT_CHANGED", entityType: "Document", entityId: input.documentId, occurredAt: input.occurredAt, metadata: { priorFolderId: prior[0]?.folderId ?? null, folderId: input.folderId } as Prisma.InputJsonValue } });
    });
  }
}