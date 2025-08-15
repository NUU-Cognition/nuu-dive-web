import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

const providers = [
  // Only add OAuth providers if credentials are configured
  ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
    ? [GithubProvider({ 
        clientId: process.env.GITHUB_ID!, 
        clientSecret: process.env.GITHUB_SECRET! 
      })]
    : []),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [GoogleProvider({ 
        clientId: process.env.GOOGLE_CLIENT_ID!, 
        clientSecret: process.env.GOOGLE_CLIENT_SECRET! 
      })]
    : []),
  // Always include credentials provider for demo
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      // For demo purposes, accept any email/password
      if (credentials?.email) {
        return {
          id: credentials.email,
          email: credentials.email,
          name: credentials.email.split("@")[0],
        };
      }
      return null;
    },
  }),
];

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};