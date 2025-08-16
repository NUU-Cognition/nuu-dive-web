# Contributing to nuu-dive-web

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start Convex (in one terminal)
npx convex dev

# Start Next.js (in another terminal)
npm run dev
```

## 📋 Prerequisites

- Node.js 20.x or higher (check `.nvmrc`)
- npm or pnpm
- Git

## 🌳 Branching Strategy

We use a trunk-based development workflow:

- `main` - Production branch (protected, requires PR)
- `feat/*` - New features
- `fix/*` - Bug fixes
- `chore/*` - Maintenance tasks
- `docs/*` - Documentation updates
- `test/*` - Test improvements

### Creating a Branch

```bash
# Feature
git checkout -b feat/add-user-dashboard

# Bug fix
git checkout -b fix/context-inspector-save

# Maintenance
git checkout -b chore/update-dependencies
```

## 📝 Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance/tooling
- `docs:` - Documentation
- `style:` - Formatting (no code change)
- `refactor:` - Code restructuring
- `test:` - Test changes
- `perf:` - Performance improvements

Examples:
```bash
git commit -m "feat: add dark mode toggle to settings"
git commit -m "fix: resolve context inspector save handler"
git commit -m "chore: upgrade Next.js to 14.x"
```

## 🔄 Pull Request Process

1. **Create your branch** from `main`
2. **Make your changes** with tests where applicable
3. **Run checks locally**:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```
4. **Push your branch** and create a PR
5. **Fill out the PR template** completely
6. **Wait for CI** to pass
7. **Request review** from maintainers
8. **Address feedback** if any
9. **Merge** after approval

## ✅ Code Standards

### TypeScript
- Strict mode is enabled
- No `any` types without justification
- No `@ts-ignore` or `@ts-nocheck`
- Prefer interfaces over types for objects
- Use proper return types (no implicit any)

### React/Next.js
- Use functional components with hooks
- Follow existing component patterns
- Use shadcn/ui components where applicable
- Keep components focused and testable

### Styling
- Use Tailwind CSS classes
- Follow existing patterns in the codebase
- Avoid inline styles unless necessary
- Keep dark mode in mind

### Testing
- Write tests for new features
- Maintain existing test coverage
- Use meaningful test descriptions
- Follow AAA pattern (Arrange, Act, Assert)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```

## 📚 Project Structure

```
nuu-dive-web/
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── chat/        # Chat-specific components
│   └── canvas/      # Canvas/graph components
├── lib/             # Utilities and helpers
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
├── convex/          # Convex backend
├── public/          # Static assets
└── docs/            # Documentation
```

## 🐛 Reporting Issues

1. Check existing issues first
2. Use issue templates when available
3. Provide reproduction steps
4. Include environment details
5. Add relevant logs/screenshots

## 💡 Suggesting Features

1. Check the roadmap and existing issues
2. Open a discussion first for major changes
3. Explain the use case and benefits
4. Consider implementation approach
5. Be open to feedback and alternatives

## 🔒 Security

- Never commit secrets or API keys
- Report security issues privately
- Follow secure coding practices
- Keep dependencies updated
- Use environment variables properly

## 📖 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Convex Documentation](https://docs.convex.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🤝 Code of Conduct

Please be respectful and inclusive. We want this to be a welcoming environment for all contributors.

## 📄 License

By contributing, you agree that your contributions will be licensed under the project's license.

## ❓ Questions?

- Open a discussion on GitHub
- Check existing documentation
- Ask in PR comments

Thank you for contributing! 🎉