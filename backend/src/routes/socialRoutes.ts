import { Router } from "express";
import {
  check,
  connect,
  disconnect,
  getAccount,
  listAccounts,
  listProviders,
  oauthCallback,
  refresh,
} from "../controllers/socialController.js";

// Mounted at /api/admin/brands/:brandId/social-accounts (admin-only via /api/admin).
// Every account route re-checks that the account belongs to :brandId.
export const brandSocialRouter = Router({ mergeParams: true });
brandSocialRouter.get("/", listAccounts);
brandSocialRouter.post("/connect", connect);
brandSocialRouter.get("/:accountId", getAccount);
brandSocialRouter.post("/:accountId/check", check);
brandSocialRouter.post("/:accountId/refresh", refresh);
brandSocialRouter.delete("/:accountId", disconnect);

// Mounted at /api/admin/social-providers.
export const providerRouter = Router();
providerRouter.get("/", listProviders);

// Mounted at /api/social behind requireAuth + requireAdmin: the provider redirects the browser here.
export const callbackRouter = Router();
callbackRouter.get("/callback/:provider", oauthCallback);
