import { NextResponse, type NextRequest } from "next/server";
import { confirmAndLink, FileError, removeFile, requestUpload, resolveFile, type FileTarget } from "@/lib/files";
import { filesGateway, type FilesPort, type ImageVariant } from "@/lib/gateway/files";
import type { Module } from "@/lib/portal/config";
import { requireRouteModule } from "@/lib/portal/staff";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** Each record that holds a file: its Module, and where the file id is stored. */
export const productImage: FileTarget = {
  kind: "product-image",
  entityType: "finished-product",
  role: "product image",
  exists: async (id) => (await prisma.finishedProducts.count({ where: { ProductId: id } })) > 0,
  current: async (id) => {
    const fp = await prisma.finishedProducts.findUnique({
      where: { ProductId: id },
      include: { Items: true },
    });
    if (!fp) return null;
    if (fp.ImageUrl) return fp.ImageUrl;
    const prodName = fp.Items?.ItemName?.trim();
    if (!prodName) return null;
    const sibling = await prisma.finishedProducts.findFirst({
      where: {
        Items: { ItemName: { equals: prodName, mode: "insensitive" } },
        ImageUrl: { not: null },
      },
      select: { ImageUrl: true },
    });
    return sibling?.ImageUrl ?? null;
  },
  // Only this product's photo changes; a same-named product without its own photo still shows this one via current().
  save: async (id, fileId) => {
    await prisma.finishedProducts.update({ where: { ProductId: id }, data: { ImageUrl: fileId } });
  },
};

export const purchaseOrderReceipt: FileTarget = {
  kind: "receipt",
  entityType: "purchase-order",
  role: "receipt",
  exists: async (id) => (await prisma.purchaseOrders.count({ where: { PoId: id } })) > 0,
  current: async (id) => (await prisma.purchaseOrders.findUnique({ where: { PoId: id } }))?.ProofImageUrl ?? null,
  save: async (id, fileId) => void (await prisma.purchaseOrders.update({ where: { PoId: id }, data: { ProofImageUrl: fileId } })),
};

export const batchImage: FileTarget = {
  kind: "batch-image",
  entityType: "production-batch",
  role: "batch image",
  exists: async (id) => (await prisma.productionBatches.count({ where: { BatchId: id } })) > 0,
  current: async (id) => (await prisma.productionBatches.findUnique({ where: { BatchId: id } }))?.ImageUrl ?? null,
  save: async (id, fileId) => void (await prisma.productionBatches.update({ where: { BatchId: id }, data: { ImageUrl: fileId } })),
};

export const writeOffPhotoTarget: FileTarget = {
  kind: "write-off-photo",
  entityType: "stock-write-off-photo",
  role: "evidence photo",
  exists: async (id) => (await prisma.stockWriteOffPhotos.count({ where: { PhotoId: id } })) > 0,
  current: async (id) => (await prisma.stockWriteOffPhotos.findUnique({ where: { PhotoId: id } }))?.FileId ?? null,
  save: async (id, fileId) => void (await prisma.stockWriteOffPhotos.update({ where: { PhotoId: id }, data: { FileId: fileId } })),
};

function preferredVariant(value: string | null): ImageVariant | undefined {
  return value === "small" || value === "medium" || value === "large" ? value : undefined;
}

function failure(error: unknown) {
  if (error instanceof FileError) return NextResponse.json({ message: error.message }, { status: error.status });
  console.error("File request failed", error);
  return NextResponse.json({ message: "The file service is unavailable." }, { status: 502 });
}

async function recordId(props: Params) {
  const id = Number((await props.params).id);
  if (!Number.isSafeInteger(id)) throw new FileError("Record not found.", 404);
  return id;
}

/**
 * Handlers for one file-holding record. Each checks the Module before doing anything:
 * `resolve` returns where to show the file from, `upload` an address to PUT the bytes to,
 * `confirm` links the finished upload to the record, and `remove` clears its IMS association.
 */
export function fileRoutes(module: Module, target: FileTarget, port: FilesPort = filesGateway) {
  return {
    async remove(request: NextRequest, props: Params) {
      const access = await requireRouteModule(request, module);
      if (!access.ok) return access.response;
      try {
        await removeFile(port, access.staff, target, await recordId(props));
        return new NextResponse(null, { status: 204 });
      } catch (error) { return failure(error); }
    },
    async resolve(request: NextRequest, props: Params) {
      const access = await requireRouteModule(request, module);
      if (!access.ok) return access.response;
      try {
        const id = await recordId(props);
        if (!(await target.exists(id))) throw new FileError("Record not found.", 404);
        const file = await resolveFile(port, access.staff, await target.current(id), preferredVariant(request.nextUrl.searchParams.get("variant")));
        // A private address expires, so it must never be cached.
        return NextResponse.json(file, { headers: file.private ? { "Cache-Control": "no-store" } : {} });
      } catch (error) {
        return failure(error);
      }
    },

    async upload(request: NextRequest, props: Params) {
      const access = await requireRouteModule(request, module);
      if (!access.ok) return access.response;
      try {
        const id = await recordId(props);
        if (!(await target.exists(id))) throw new FileError("Record not found.", 404);
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const address = await requestUpload(port, access.staff, {
          kind: target.kind,
          filename: body?.filename as string,
          contentType: body?.contentType as string,
          size: body?.size as number,
        }, target, id);
        return NextResponse.json(
          { fileId: address.id, uploadUrl: address.uploadUrl, uploadUrlExpiresInSeconds: address.uploadUrlExpiresInSeconds },
          { status: 201, headers: { "Cache-Control": "no-store" } },
        );
      } catch (error) {
        return failure(error);
      }
    },

    async confirm(request: NextRequest, props: Params) {
      const access = await requireRouteModule(request, module);
      if (!access.ok) return access.response;
      try {
        const id = await recordId(props);
        const body = (await request.json().catch(() => null)) as { fileId?: unknown } | null;
        const file = await confirmAndLink(port, access.staff, target, id, body?.fileId as string);
        return NextResponse.json({ fileId: file.id, status: file.status });
      } catch (error) {
        return failure(error);
      }
    },
  };
}
