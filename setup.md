# Dive Web Application - Setup Guide

## Quick Setup

1. **Install dependencies:**
```bash
npm install --legacy-peer-deps
```

2. **Set up environment variables:**
Create a `.env.local` file with:
```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Convex (optional - for production)
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=your-deploy-key

# LLM Provider (optional - defaults to mock)
LLM_PROVIDER=mock
# For OpenAI:
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your-api-key
```

3. **Run the development server:**
```bash
npm run dev
```

The app will be available at http://localhost:3000 (or 3001 if port 3000 is in use).

## Features Implemented

✅ **Core Infrastructure**
- Next.js 15 with App Router
- TypeScript for type safety
- Tailwind CSS v3 for styling
- shadcn/ui component library
- NextAuth.js authentication

✅ **Backend & Data**
- Convex for real-time database
- Complete schema with users, workspaces, dives, concepts, chats, messages
- Tree-based message structure for branching

✅ **UI Components**
- Landing page with feature overview
- Authentication (sign in/sign up)
- Dive list and creation
- Concept management sidebar
- ReactFlow canvas for concept visualization
- Chat panel with branching capability
- Context inspector for inclusion control
- Markdown export functionality

✅ **LLM Integration**
- Streaming API route (`/api/chat/stream`)
- Mock adapter for testing
- OpenAI adapter ready for production
- Context assembly with message filtering
- Server-sent events for real-time streaming

✅ **Chat Features**
- Branching conversations from assistant messages
- Message tree visualization
- Context inclusion/exclusion controls
- Attachment support (URLs and PDFs)
- Export to Markdown or JSON

## Demo Credentials

For testing, you can sign in with any email address (no password required in demo mode).

## Architecture Highlights

- **Real-time sync**: Convex enables instant updates across tabs
- **Branching logic**: Tree structure with parent-child relationships
- **Context management**: Fine-grained control over what's included in AI context
- **Streaming**: Server-sent events for smooth token-by-token display
- **Type safety**: Full TypeScript coverage with generated Convex types

## Next Steps for Production

1. **Set up Convex project**: Run `npx convex dev` to initialize
2. **Configure authentication**: Add real OAuth providers
3. **Add LLM API keys**: Configure OpenAI or Anthropic
4. **Deploy to Vercel**: Push to GitHub and connect to Vercel

## Known Limitations (MVP)

- Mock data for concepts and messages (replace with Convex queries)
- File uploads need UploadThing or Convex storage setup
- Chrome extension not included (separate project)
- Multi-user collaboration not yet implemented

## Development Tips

- The app uses mock LLM responses by default
- All Convex functions are ready but need `convex dev` running
- UI is fully responsive and supports dark mode
- Export works with current mock data structure