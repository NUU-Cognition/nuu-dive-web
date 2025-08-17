"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, GitBranch, FileText } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/d");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <GitBranch className="h-6 w-6" />
            <span className="text-xl font-bold">Dive</span>
          </div>
          <Link href="/auth/signin">
            <Button>Sign In</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Branch your thinking
            </div>
            
            <h1 className="mb-6 text-5xl font-bold tracking-tight">
              Turn any document into a{" "}
              <span className="text-primary">branching chat tree</span>
            </h1>
            
            <p className="mb-8 text-xl text-muted-foreground">
              Dive transforms web pages and PDFs into interactive, branching conversations. 
              Explore concepts, ask focused questions, and keep perfect provenance—without losing the thread.
            </p>
            
            <div className="flex justify-center space-x-4">
              <Link href="/auth/signin">
                <Button size="lg" className="gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t bg-secondary/30 py-24">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">How it works</h2>
            
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-3">
                    <FileText className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Highlight & Capture</h3>
                <p className="text-muted-foreground">
                  Select any text on a web page or PDF to create a Concept—a captured highlight with full source provenance.
                </p>
              </div>
              
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-3">
                    <GitBranch className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Branch & Explore</h3>
                <p className="text-muted-foreground">
                  Fork conversations at any point. Each branch inherits context from its ancestors while exploring new directions.
                </p>
              </div>
              
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Sparkles className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Connect & Export</h3>
                <p className="text-muted-foreground">
                  Attach additional sources, inspect context inclusion, and export branches as structured Markdown with citations.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2025 Dive. Built for FoundersHack.
        </div>
      </footer>
    </div>
  );
}