"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { decodeCategoryDescription } from "@/lib/resources-suppliers/category-status";

export async function listSupplyCategories() {
  await requireModule("Resources & Suppliers");

  try {
    const categories = await prisma.categories.findMany({
      where: {
        NOT: {
          CategoryName: { in: ["Finished Goods", "Finished Good"] },
        },
      },
      select: {
        CategoryId: true,
        CategoryName: true,
        Description: true,
        HasExpiry: true,
      },
    });

    const formattedCategories = categories
      .filter((cat) => decodeCategoryDescription(cat.Description, (cat as any).IsActive).isActive)
      .map((cat) => ({
        categoryId: cat.CategoryId,
        categoryName: cat.CategoryName,
        description: decodeCategoryDescription(cat.Description, (cat as any).IsActive).description,
        hasExpiry: cat.HasExpiry !== false,
      }));

    // Custom sorting to match the C# backend logic
    const sortedCategories = formattedCategories.sort((a, b) => {
      const orderA = a.categoryName === "Raw Materials" ? 0 : a.categoryName === "Ingredients" ? 1 : 2;
      const orderB = b.categoryName === "Raw Materials" ? 0 : b.categoryName === "Ingredients" ? 1 : 2;
      return orderA - orderB;
    });

    return resourceResult({
      success: true,
      message: "Successfully retrieved supply categories.",
      data: sortedCategories,
    });
  } catch (error) {
    console.error("Error fetching supply categories:", error);
    return resourceResult(
      { success: false, message: "Internal server error.", data: null }
    );
  }
}

export async function listUnits() {
  await requireModule("Resources & Suppliers");

  try {
    const rows = await prisma.unitOfMeasures.findMany({
      orderBy: [
        { UomType: "asc" },
        { Name: "asc" },
      ],
      select: {
        UomId: true,
        Code: true,
        Name: true,
        Abbreviation: true,
        UomType: true,
        ConversionFactor: true,
      },
    });

    // Prisma returns Decimal types as Prisma.Decimal objects, which Next.js will convert to strings or objects in JSON.
    // It's safest to serialize them as numbers.
    const units = rows.map((u) => ({
      uomId: u.UomId,
      code: u.Code,
      name: u.Name,
      abbreviation: u.Abbreviation,
      uomType: u.UomType,
      conversionFactor: Number(u.ConversionFactor),
    }));

    return resourceResult({
      success: true,
      message: "Successfully retrieved unit of measures.",
      data: units,
    });
  } catch (error) {
    console.error("Error fetching unit of measures:", error);
    return resourceResult(
      { success: false, message: "Internal server error.", data: null }
    );
  }
}

