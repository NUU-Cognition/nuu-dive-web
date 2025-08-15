/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as attachments from "../attachments.js";
import type * as chats from "../chats.js";
import type * as concepts from "../concepts.js";
import type * as dives from "../dives.js";
import type * as documents from "../documents.js";
import type * as exports from "../exports.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  attachments: typeof attachments;
  chats: typeof chats;
  concepts: typeof concepts;
  dives: typeof dives;
  documents: typeof documents;
  exports: typeof exports;
  messages: typeof messages;
  migrations: typeof migrations;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
