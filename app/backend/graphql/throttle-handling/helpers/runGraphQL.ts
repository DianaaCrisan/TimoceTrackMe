import { AdminApiContextWithoutRest } from "app/backend/core/types/AdminApiContextWithoutRest";
import {
  getLimiterForShop,
  type GraphqlLimiter,
} from "../services/GraphqlLimiter";

export async function runGraphQL<T>(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  opName: string,
  query: string,
  variables?: Record<string, unknown>,
  expectedCost?: number,
): Promise<T> {
  const limiter: GraphqlLimiter = getLimiterForShop(shopUrl);

  const runRaw = () =>
    admin.graphql(query, {
      variables,
    });

  const { data, body } = await limiter.run<T>(opName, runRaw, {
    expectedCost,
  });

  if (Array.isArray(body?.errors) && body.errors.length) {
    const messages = body.errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => e?.message ?? "Unknown error")
      .join("; ");
    throw new Error(
      `GraphQLBusinessError for request '${opName}': ${messages}`,
    );
  }

  return data;
}
