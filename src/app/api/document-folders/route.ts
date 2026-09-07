import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { FolderHierarchyService, FolderValidationError } from "@/lib/folders/service";
import { PrismaFolderStore } from "@/lib/folders/prisma-store";

const uuid = z.string().uuid();
const command = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("CREATE_FOLDER"), parentFolderId: uuid.nullable(), name: z.string().max(120) }),
  z.object({ operation: z.literal("RENAME_FOLDER"), folderId: uuid, name: z.string().max(120) }),
  z.object({ operation: z.literal("MOVE_FOLDER"), folderId: uuid, parentFolderId: uuid.nullable() }),
  z.object({ operation: z.literal("DELETE_FOLDER"), folderId: uuid }),
  z.object({ operation: z.literal("PLACE_DOCUMENT"), documentId: uuid, folderId: uuid }),
]);
const service = new FolderHierarchyService(new PrismaFolderStore());

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    return NextResponse.json({ data: await service.list(context, context.organizationId) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to load document folders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = command.parse(await request.json());
    if (input.operation === "CREATE_FOLDER") return NextResponse.json({ data: await service.create(context, { organizationId: context.organizationId, parentFolderId: input.parentFolderId, name: input.name }) }, { status: 201 });
    if (input.operation === "RENAME_FOLDER") { await service.rename(context, { organizationId: context.organizationId, folderId: input.folderId, name: input.name }); return NextResponse.json({ data: { updated: true } }); }
    if (input.operation === "MOVE_FOLDER") { await service.move(context, { organizationId: context.organizationId, folderId: input.folderId, parentFolderId: input.parentFolderId }); return NextResponse.json({ data: { updated: true } }); }
    if (input.operation === "DELETE_FOLDER") { await service.delete(context, { organizationId: context.organizationId, folderId: input.folderId }); return NextResponse.json({ data: { deleted: true } }); }
    await service.place(context, { organizationId: context.organizationId, documentId: input.documentId, folderId: input.folderId });
    return NextResponse.json({ data: { updated: true } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid folder request" }, { status: 400 });
    if (error instanceof FolderValidationError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Folder change could not be completed" }, { status: 409 });
  }
}