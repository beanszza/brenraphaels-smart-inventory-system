import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SUPPLY_CATEGORY_NAMES = ["Raw Materials", "Ingredients", "Tools and Supplies"];

export async function GET(request: NextRequest) {
  const access = await requireRouteModule(request, "Resources & Suppliers");
  if (!access.ok) return access.response;

  try {
    const categories = await prisma.categories.findMany({
      where: {
        CategoryName: {
          in: SUPPLY_CATEGORY_NAMES,
        },
      },
      select: {
        CategoryId: true,
        CategoryName: true,
        Description: true,
      },
    });

    const formattedCategories = categories.map((cat) => ({
      categoryId: cat.CategoryId,
      categoryName: cat.CategoryName,
      description: cat.Description,
    }));

    // Custom sorting to match the C# backend logic
    const sortedCategories = formattedCategories.sort((a, b) => {
      const orderA = a.categoryName === "Raw Materials" ? 0 : a.categoryName === "Ingredients" ? 1 : 2;
      const orderB = b.categoryName === "Raw Materials" ? 0 : b.categoryName === "Ingredients" ? 1 : 2;
      return orderA - orderB;
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
