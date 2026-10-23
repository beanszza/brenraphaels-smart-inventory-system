import { LOGOUT_PATH } from "@/lib/portal/config";
import { secondaryActionClass } from "./AuthScreen";

/** Signs out of the Portal and every other system. */
export function SignOutButton() {
  return (
    <form action={LOGOUT_PATH} method="post" className="w-full sm:w-auto">
      <button type="submit" className={`${secondaryActionClass} w-full`}>
        Sign out
      </button>
    </form>
  );
}
