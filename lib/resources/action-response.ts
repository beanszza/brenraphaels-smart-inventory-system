import type { ResourceResult } from "./result";

/** Keeps the existing modal error contract while its data comes from actions. */
export async function actionResponse(action: Promise<ResourceResult>) {
  const result = await action;
  if (!result.success) throw new Error(result.message || "The action could not be completed.");
  return { data: result };
}
