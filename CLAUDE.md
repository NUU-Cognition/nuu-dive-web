# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Never npm run dev the user will do it manually

## Common Commands

### Development
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript compiler check
npm run format       # Format code with Prettier
```

### Convex Backend
```bash
npm run convex:dev   # Start Convex development server
npm run convex:deploy # Deploy to Convex
npx convex dev       # Initialize Convex project
```

### Development Dependencies
Install with: `npm install --legacy-peer-deps` (required for peer dependency compatibility)

## Architecture Overview

### Core Data Flow
The application uses a **tree-based message structure** where every message has an optional `parentMessageId`, enabling branching conversations. This is the fundamental architecture that drives the entire chat system.

### Key Architecture Components

**State Management:**
- `contexts/WorkspaceContext.tsx` - Central state management for concepts, chats, and messages
- Currently uses mock data with local state; ready for Convex integration
- Manages concept-to-chat relationships and message tree operations

**Message Tree System:**
- Messages form a tree via `parentMessageId` relationships
- Each message has a `depth` property for rendering indentation
- Branching occurs when multiple messages share the same `parentMessageId`
- See `components/chat/ChatPanel.tsx:187-206` for tree building logic

**Database Schema (Convex):**
- `convex/schema.ts` defines the complete data model
- **Key relationships:**
  - Users → Workspaces → Dives → Concepts
  - Chats belong to Dives, optionally linked to Concepts  
  - Messages form tree structure within Chats
  - InclusionOverrides control context assembly per message

**Streaming Chat System:**
- `app/api/chat/stream/route.ts` - Server-sent events for real-time LLM responses
- `hooks/useStreamChat.ts` - Client-side streaming hook
- `lib/context/assembleContext.ts` - Smart context assembly from message ancestors
- Authentication bypass available with `ALLOW_DEV_NO_AUTH=1` in development

**LLM Integration:**
- Provider abstraction in `lib/llm/` with mock and OpenAI adapters
- Configurable via `LLM_PROVIDER` environment variable
- Defaults to mock adapter for development

### Development State Management
- **Mock Data Mode**: App works entirely with local state when Convex isn't configured
- **Convex Integration**: Ready but requires `NEXT_PUBLIC_CONVEX_URL` environment variable
- All UI components and data flows are implemented; primarily needs backend connection

### Component Architecture
- **Three-panel layout**: Concepts sidebar (collapsible) + Canvas + Chat panel
- **ReactFlow Canvas**: Concept visualization (placeholder implementation)
- **Branching Chat UI**: Tree rendering with depth-based indentation
- **Context Control**: Include/exclude messages from LLM context per branch

### Context Assembly Logic
The system assembles context for LLM requests by:
1. Walking up the message tree from current message to roots
2. Applying inclusion/exclusion overrides per message branch
3. Converting to LLM format with citations from source attachments
4. This enables focused conversations while maintaining full tree provenance

### Environment Configuration
```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Convex (optional)
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# LLM Provider (defaults to mock)
LLM_PROVIDER=mock  # or 'openai'
OPENAI_API_KEY=your-api-key  # if using openai

# Development (bypass auth for testing)
ALLOW_DEV_NO_AUTH=1
```

## Key Implementation Details

**Message Tree Rendering:**
- `buildMessageTree()` and `renderMessageTree()` in ChatPanel handle tree visualization
- Recent updates include deduplication and stable path-based keys for React rendering
- Each message can be branched from, creating new conversation paths

**Concept-Chat Relationship:**
- Every concept automatically gets an associated chat with an initial "note" message
- Concepts maintain source provenance (URL, PDF) for citation tracking
- Users can extract new concepts from any chat message

**Real-time Considerations:**
- Convex provides live updates across browser tabs
- Message streaming uses Server-Sent Events
- Context changes immediately reflected in chat interface

**Authentication Flow:**
- Landing page redirects authenticated users to `/d`
- Protected routes redirect to `/auth/signin` when unauthenticated
- Demo mode allows any email address for testing