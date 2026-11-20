import { prisma } from "@/lib/prisma";

export type ShopProduct = {
  productId: number;
  name: string;
  /** The IMS Variant; null for a blank Variant, which is one unlabelled default Size. */
  variant: string | null;
  image: string | null;
  price: number;
  active: boolean;
};

/** Every Size the IMS holds, active or not, so the shop can also tell what was discontinued. */
export async function readProducts(): Promise<{ products: ShopProduct[] }> {
  const rows = await prisma.finishedProducts.findMany({
    include: { Items: { select: { ItemName: true, IsActive: true } } },
    orderBy: { ProductId: "asc" },
  });
  return {
    products: rows.map(row => ({
      productId: row.ProductId,
      name: row.Items.ItemName,
      variant: row.Variant.trim() === "" ? null : row.Variant.trim(),
      image: row.ImageUrl?.trim() || null,
      price: Number(row.SellingPrice),
      active: row.Items.IsActive,
    })),
  };
}
