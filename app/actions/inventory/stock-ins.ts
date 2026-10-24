"use server";
import { requireModule } from "@/lib/portal/staff";
import { stockInActions } from "@/lib/stock-ins/operations";
import type { NotesInput, StockInInput } from "@/lib/receiving/inputs";

export async function createStockIn(body: StockInInput) {
  const staff = await requireModule("Inventory");
  return stockInActions("Inventory", staff).createStockIn(body);
}

export async function listStockIns(query = "") {
  const staff = await requireModule("Inventory");
  return stockInActions("Inventory", staff).listStockIns(query);
}

export async function submitStockIn(idInput: string | number) {
  const staff = await requireModule("Inventory");
  return stockInActions("Inventory", staff).submitStockIn(idInput);
}

export async function approveStockIn(idInput: string | number, body: NotesInput = {}) {
  const staff = await requireModule("Inventory");
  return stockInActions("Inventory", staff).approveStockIn(idInput, body);
}

export async function rejectStockIn(idInput: string | number, body: NotesInput = {}) {
  const staff = await requireModule("Inventory");
  return stockInActions("Inventory", staff).rejectStockIn(idInput, body);
}

export async function commitStockIn(idInput: string | number, body: NotesInput = {}) {
  const staff = await requireModule("Inventory");
  return stockInActions("Inventory", staff).commitStockIn(idInput, body);
}
