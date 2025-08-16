# NUU Dive Web Style Guide

## Overview
This style guide documents the design system, patterns, and conventions used throughout the NUU Dive Web application. The application uses Tailwind CSS for utility-first styling with custom design tokens and component patterns.

## Core Technologies
- **Tailwind CSS**: Utility-first CSS framework
- **CSS Variables**: Custom properties for theming
- **Google Fonts**: Geist Sans & Geist Mono
- **Radix UI**: Unstyled component primitives
- **class-variance-authority (CVA)**: Component variant management

## Typography

### Font Families
- **Primary Font**: Geist Sans (variable font)
  - CSS Variable: `--font-geist-sans`
  - Usage: Default body text, UI elements
  
- **Monospace Font**: Geist Mono (variable font)
  - CSS Variable: `--font-geist-mono`
  - Usage: Code snippets, technical content

### Font Sizes
Using Tailwind's default scale:
- `text-xs`: 0.75rem (12px) - Labels, helper text, metadata
- `text-sm`: 0.875rem (14px) - Body text, form inputs, buttons
- `text-base`: 1rem (16px) - Default paragraph text
- `text-lg`: 1.125rem (18px) - Section headings
- `text-xl`: 1.25rem (20px) - Page titles

### Font Weights
- `font-normal`: 400 - Body text
- `font-medium`: 500 - Labels, emphasis
- `font-semibold`: 600 - Headings, buttons

### Text Rendering
- Global `antialiased` class applied for smooth text rendering

## Color System

### Design Tokens
The application uses HSL-based CSS custom properties for dynamic theming:

#### Light Theme
```css
--background: 0 0% 100%          /* Pure white */
--foreground: 222.2 84% 4.9%     /* Dark navy */
--primary: 222.2 47.4% 11.2%     /* Navy blue */
--primary-foreground: 210 40% 98% /* Off-white */
--secondary: 210 40% 96.1%       /* Light gray */
--muted: 210 40% 96.1%          /* Light gray */
--accent: 210 40% 96.1%          /* Light gray */
--destructive: 0 84.2% 60.2%     /* Red */
--border: 214.3 31.8% 91.4%      /* Light border */
--input: 214.3 31.8% 91.4%       /* Input border */
--ring: 222.2 84% 4.9%           /* Focus ring */
```

#### Dark Theme
```css
--background: 222.2 84% 4.9%      /* Dark navy */
--foreground: 210 40% 98%        /* Off-white */
--primary: 210 40% 98%           /* Off-white */
--primary-foreground: 222.2 47.4% 11.2% /* Navy */
--secondary: 217.2 32.6% 17.5%   /* Dark gray */
--muted: 217.2 32.6% 17.5%      /* Dark gray */
--accent: 217.2 32.6% 17.5%      /* Dark gray */
--destructive: 0 62.8% 30.6%     /* Dark red */
--border: 217.2 32.6% 17.5%      /* Dark border */
```

### Ice Color Palette
Custom ice-themed colors for glassmorphism effects:
- `ice-50`: #f8fafc - Lightest ice blue
- `ice-100`: #f1f5f9 - Deep ice blue
- `ice-200`: #e2e8f0 - Medium ice blue
- `ice-300`: #cbd5e1 - Ice blue
- `ice-400`: #94a3b8 - Darker ice
- `ice-500`: #334155 - Darkest ice

### Semantic Colors
- **Primary**: Main brand color, CTAs, primary actions
- **Secondary**: Supporting UI elements, secondary actions
- **Muted**: Disabled states, subtle backgrounds
- **Accent**: Hover states, highlights
- **Destructive**: Errors, warnings, delete actions

## Spacing System

### Base Unit
Uses Tailwind's default spacing scale (1 unit = 0.25rem = 4px)

### Common Patterns
- **Component Padding**: 
  - Small: `p-2` (8px)
  - Medium: `p-3` (12px), `p-4` (16px)
  - Large: `p-6` (24px), `p-8` (32px)

- **Section Spacing**:
  - Between sections: `space-y-4` (16px)
  - Within sections: `space-y-2` (8px), `space-y-3` (12px)
  - List items: `space-y-1` (4px)

- **Inline Spacing**:
  - Icon gaps: `gap-1` (4px), `gap-2` (8px)
  - Button content: `gap-2` (8px)
  - Form elements: `gap-3` (12px), `gap-4` (16px)

## Layout Patterns

### Container
- Centered with `container` class
- Default padding: `2rem`
- Max width at 2xl: `1400px`

### Three-Panel Layout
1. **Left Sidebar**: Concepts list (collapsible)
2. **Center Canvas**: Main content area with ReactFlow
3. **Right Panel**: Chat interface or document viewer

### Borders
- Default color: `border` (CSS variable)
- Common usage: `border-b`, `border-l`, `border-r`, `border-t`
- Focus states: `focus:ring-1 focus:ring-ring`

## Component Patterns

### Buttons
Using CVA for variant management:

#### Variants
- **default**: Primary action - `bg-primary text-primary-foreground`
- **secondary**: Secondary action - `bg-secondary text-secondary-foreground`
- **outline**: Bordered button - `border border-input bg-background`
- **ghost**: Minimal button - `hover:bg-accent`
- **destructive**: Dangerous action - `bg-destructive text-destructive-foreground`
- **link**: Text link style - `text-primary underline-offset-4`

#### Sizes
- **sm**: `h-8 px-3 text-xs`
- **default**: `h-9 px-4 py-2`
- **lg**: `h-10 px-8`
- **icon**: `h-9 w-9`

### Cards & Panels
- Background: `bg-background` or `bg-card`
- Borders: `border` with optional `rounded-lg`
- Padding: `p-4` or `p-6`
- Headers: `border-b px-4 py-3`

### Forms
- Input fields: `border border-input bg-transparent px-3 py-2`
- Focus state: `focus-visible:ring-1 focus-visible:ring-ring`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`
- Labels: `text-sm font-medium`
- Helper text: `text-xs text-muted-foreground`

### Dialogs & Modals
- Overlay: `bg-black/80` with fade animation
- Content: `bg-background` with slide/zoom animations
- Max width: `max-w-lg`
- Padding: `p-6`
- Close button positioned absolutely: `absolute right-4 top-4`

## Special Effects

### Glassmorphism
Custom glass-frosted effect:
```css
.glass-frosted {
  background: rgb(var(--ice-400));
  backdrop-filter: blur(5px);
  padding: 10px;
  margin: 10px;
  border-radius: 10px;
  transition: all 0.1s ease;
  transform: translateY(-2px);
  cursor: pointer;
}
```

### Animations
- Accordion: `accordion-down` / `accordion-up` (0.2s ease-out)
- Dialog states: `animate-in`, `fade-in-0`, `zoom-in-95`
- Loading: `animate-pulse`

## Border Radius
- Small: `rounded-sm` (calc(var(--radius) - 4px))
- Medium: `rounded-md` (calc(var(--radius) - 2px))
- Large: `rounded-lg` (var(--radius))
- Default radius: `0.5rem`

## Accessibility
- Screen reader only text: `sr-only` class
- Focus visible states on all interactive elements
- Semantic HTML structure
- ARIA attributes via Radix UI primitives

## Code Conventions

### Component Structure
1. Use TypeScript for type safety
2. Implement forwardRef for component flexibility
3. Use cn() utility for className merging
4. Separate variant logic with CVA

### Styling Approach
1. Prefer Tailwind utilities over custom CSS
2. Use CSS variables for theme values
3. Keep component-specific styles minimal
4. Maintain consistent spacing and sizing scales

### State Styles
- Hover: `hover:` prefix
- Focus: `focus:` or `focus-visible:` prefix
- Active: `active:` prefix
- Disabled: `disabled:` prefix
- Data attributes: `data-[state=open]:` syntax

## File Organization
- Global styles: `/app/globals.css`
- Tailwind config: `/tailwind.config.ts`
- Component styles: Inline with Tailwind utilities
- UI components: `/components/ui/`
- Feature components: `/components/[feature]/`

## Best Practices
1. **Consistency**: Use design tokens consistently across components
2. **Responsiveness**: Mobile-first approach with responsive modifiers
3. **Performance**: Minimize custom CSS, leverage Tailwind's purging
4. **Maintainability**: Document component variants and patterns
5. **Accessibility**: Ensure proper contrast ratios and focus states
6. **Dark Mode**: Test all components in both light and dark themes