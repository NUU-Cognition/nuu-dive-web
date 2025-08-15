# Dive - Branch Your Thinking

Turn any document or web page into a branching chat tree for structured exploration and knowledge work.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui components, Radix UI
- **Backend**: Convex (real-time database), NextAuth.js
- **Canvas**: ReactFlow for concept visualization
- **Markdown**: react-markdown with syntax highlighting

## Quick Start

1. **Install dependencies**:
```bash
npm install --legacy-peer-deps
```

2. **Set up environment variables**:
```bash
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

3. **Initialize Convex**:
```bash
npx convex dev
```

4. **Run the development server**:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Features

- 🌳 **Branching Conversations**: Fork any assistant response to explore multiple paths
- 📌 **Concept Anchoring**: Capture highlights with full source provenance
- 🔗 **Context Management**: Inspect and control what context is included in each branch
- 📎 **Multi-Source**: Attach PDFs and URLs to any chat node
- 📝 **Markdown Export**: Export branches with citations and formatting

## Project Structure

```
/app              # Next.js app router pages
/components       # React components
  /ui            # shadcn/ui components
  /canvas        # ReactFlow canvas components
  /chat          # Chat interface components
/convex          # Convex backend functions
/lib             # Utility functions and configurations
```

## Development

This project was built for the FoundersHack hackathon (Aug 15-17, 2025).

### Key Implementation Areas

1. **Authentication**: NextAuth.js with credentials/OAuth providers
2. **Real-time Sync**: Convex for instant updates across tabs
3. **Streaming**: Server-sent events for LLM token streaming
4. **Context Assembly**: Smart ancestor message inclusion with overrides
5. **Branching Logic**: Tree structure with parent-child message relationships

## MVP Scope

- ✅ Core web app with authentication
- ✅ Dive (workspace) creation and management
- ✅ Concept creation from text snippets
- ✅ Chat tree with branching
- 🚧 LLM integration with streaming
- 🚧 Context inspector
- 🚧 Attachment support
- 🚧 Markdown export

## License

Built for FoundersHack 2025