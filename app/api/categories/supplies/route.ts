export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.categories.findMany({
      where: {
        IsActive: true,
        CategoryName: {
          notIn: ["Finished Good", "Finished Goods"],
        },
      },
      select: {
        CategoryId: true,
        CategoryName: true,
        Description: true,
        IsActive: true,
      },
    });

    const formattedCategories = categories.map((cat) => ({
      categoryId: cat.CategoryId,
      categoryName: cat.CategoryName,
      description: cat.Description,
      isActive: cat.IsActive,
    }));

    // Standard ordering: Raw Materials, Ingredients, Tools and Supplies first, then custom categories
    const priority = ["Raw Materials", "Ingredients", "Tools and Supplies"];
    const sortedCategories = formattedCategories.sort((a, b) => {
      const idxA = priority.indexOf(a.categoryName);
      const idxB = priority.indexOf(b.categoryName);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.categoryName.localeCompare(b.categoryName);
    });

    return NextResponse.json({
      success: true,
      message: "Successfully retrieved supply categories.",
      data: sortedCategories,
    });
  } catch (error) {
    console.error("Error fetching supply categories:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error.", data: null },
      { status: 500 }
    );
  }
}

