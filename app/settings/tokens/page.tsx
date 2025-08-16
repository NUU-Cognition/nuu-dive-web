"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "next-auth/react";
import { Copy, Trash2, Key, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

type Token = {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
};

export default function TokensPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenLabel, setTokenLabel] = useState("Chrome Extension");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchTokens();
    }
  }, [status, router]);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ext/token/list");
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } catch (error) {
      console.error("Failed to fetch tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    try {
      setCreating(true);
      const res = await fetch("/api/ext/token/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: tokenLabel }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setNewToken(data.token);
        setTokenLabel("Chrome Extension");
        await fetchTokens();
      }
    } catch (error) {
      console.error("Failed to create token:", error);
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to revoke this token? This action cannot be undone.")) {
      return;
    }
    
    try {
      const res = await fetch("/api/ext/token/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });
      
      if (res.ok) {
        await fetchTokens();
      }
    } catch (error) {
      console.error("Failed to revoke token:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  if (status === "loading" || loading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Access Tokens</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage personal access tokens for the Dive Chrome extension.
        </p>
      </div>

      {/* New Token Display */}
      {newToken && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              New Token Created
            </CardTitle>
            <CardDescription>
              Copy this token now. You won&apos;t be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 bg-background rounded-md border text-sm break-all">
                {newToken}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  copyToClipboard(newToken);
                  setNewToken(null);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Token */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Token</CardTitle>
          <CardDescription>
            Tokens are used to authenticate the Chrome extension with your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="label" className="sr-only">
                Token Label
              </Label>
              <Input
                id="label"
                placeholder="Token label (e.g., Chrome Extension)"
                value={tokenLabel}
                onChange={(e) => setTokenLabel(e.target.value)}
                disabled={creating}
              />
            </div>
            <Button onClick={createToken} disabled={creating || !tokenLabel.trim()}>
              {creating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Create Token
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Token List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Tokens</CardTitle>
          <CardDescription>
            Manage your existing access tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No tokens created yet.
            </p>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{token.label}</div>
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt && (
                        <> • Last used: {new Date(token.lastUsedAt).toLocaleDateString()}</>
                      )}
                      {token.revokedAt && (
                        <span className="text-red-600"> • Revoked</span>
                      )}
                    </div>
                  </div>
                  {!token.revokedAt && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revokeToken(token.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to use tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Install the Dive Chrome extension from the Chrome Web Store</li>
            <li>Create a token above and copy it</li>
            <li>Click the Dive extension icon in your browser</li>
            <li>Paste the token when prompted to connect</li>
            <li>Start selecting text on any webpage to create concepts!</li>
          </ol>
          <div className="pt-3 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>Security note:</strong> Treat tokens like passwords. Anyone with your token
              can access your Dive workspace through the extension. Revoke tokens immediately if
              they are compromised.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}