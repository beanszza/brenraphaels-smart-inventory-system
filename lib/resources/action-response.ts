import type { ResourceResult } from "./result";

/**
 * Keeps the existing modal error contract while its data comes from actions: a refusal throws
 * an error carrying `response.data.message` so existing forms still read the reason.
 */
export async function actionResponse(action: Promise<ResourceResult>) {
  const result = await action;
  if (!result.success) {
    const message = result.message || "The action could not be completed.";
    throw Object.assign(new Error(message), { response: { data: { message } } });
  }
  return { data: result };
}
