import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(10).optional(),
  LLM_PROVIDER: z.enum(["openai", "mock"]).default("openai"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  DEMO_MODE: z.enum(["0", "1"]).default("0"),
  ALLOW_DEV_NO_AUTH: z.enum(["0", "1"]).default("0"),
});

export type Env = z.infer<typeof schema>;

export const ENV = (() => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.format());
    
    // In development, provide helpful error messages
    if (process.env["NODE_ENV"] === "development") {
      console.error("\n📝 Missing or invalid environment variables detected.");
      console.error("Please check your .env.local file against .env.example");
    }
    
    // Don't throw in development to allow easier onboarding
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Invalid environment variables");
    }
    
    // Return safe defaults for development
    return schema.parse({
      NODE_ENV: process.env["NODE_ENV"] || "development",
      NEXT_PUBLIC_CONVEX_URL: process.env["NEXT_PUBLIC_CONVEX_URL"] || "http://localhost:3210",
      DEMO_MODE: "1",
      ALLOW_DEV_NO_AUTH: "1",
    });
  }
  return parsed.data;
})();