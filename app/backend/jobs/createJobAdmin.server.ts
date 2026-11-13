import { unauthenticated } from "app/shopify.server";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";

const SESSION_RELOAD_INTERVAL_MS = 60 * 1000;

type LoadAdmin = (shop: string) => Promise<AdminApiContextWithoutRest>;

const loadAdminFromOfflineSession: LoadAdmin = async (shop) =>
  (await unauthenticated.admin(shop)).admin;

/**
 * An admin client that stays valid for a long job.
 *
 * The `admin` from `authenticate.admin(request)` holds the offline token as it
 * was during the request. The app uses expiring offline tokens, and the
 * library refreshes one only when a new context is created within 5 minutes
 * of its expiry, so a job longer than that could start getting 401s.
 *
 * This client reloads the context from the session store at most once a
 * minute, which refreshes the token when it is close to expiring. Only one
 * reload runs at a time: concurrent refreshes would race to use the same
 * refresh token.
 */
export function createJobAdmin(
  shop: string,
  deps: { loadAdmin: LoadAdmin; now: () => number } = {
    loadAdmin: loadAdminFromOfflineSession,
    now: Date.now,
  },
): AdminApiContextWithoutRest {
  let current: Promise<AdminApiContextWithoutRest> | null = null;
  let loadedAt = 0;

  const getAdmin = (): Promise<AdminApiContextWithoutRest> => {
    if (!current || deps.now() - loadedAt >= SESSION_RELOAD_INTERVAL_MS) {
      loadedAt = deps.now();
      const loading = deps.loadAdmin(shop);
      // A failed load must not be cached, or every later call would reuse it.
      loading.catch(() => {
        if (current === loading) current = null;
      });
      current = loading;
    }

    return current;
  };

  return {
    graphql: async (...args) => (await getAdmin()).graphql(...args),
  };
}
