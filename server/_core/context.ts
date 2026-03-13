import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function getDevelopmentUser(): User {
  const now = new Date();
  return {
    id: 1,
    openId: "local-dev-user",
    name: "Local Dev",
    email: "local-dev@example.com",
    loginMethod: "dev",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user && !ENV.isProduction && !ENV.oAuthServerUrl) {
    user = getDevelopmentUser();
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
