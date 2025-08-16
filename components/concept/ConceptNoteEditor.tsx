"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "highlight.js/styles/github.css";
import { 
  Eye, 
  Edit, 
  Save, 
  X, 
  Bold, 
  Italic, 
  Link, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Heading1, 
  Heading2,
  Heading3,
  Table
} from "lucide-react";

interface ConceptNoteEditorProps {
  conceptTitle: string;
  note: string;
  onSave: (note: string) => Promise<void>;
  onClose: () => void;
}

export function ConceptNoteEditor({
  conceptTitle,
  note,
  onSave,
  onClose,
}: ConceptNoteEditorProps) {
  const [currentNote, setCurrentNote] = useState(note);
  const [isEditing, setIsEditing] = useState(note.trim() === "");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Configure marked for better markdown rendering
  useEffect(() => {
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert line breaks to <br>
    });
  }, []);

  // Function to render markdown to safe HTML
  const renderMarkdown = (markdown: string): string => {
    if (typeof window === 'undefined') return '';
    
    try {
      const rawHtml = marked(markdown) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return DOMPurify.sanitize(markdown.replace(/\n/g, '<br>'));
    }
  };

  // Update local state when note prop changes
  useEffect(() => {
    setCurrentNote(note);
    setHasChanges(false);
    setIsEditing(note.trim() === "");
  }, [note]);

  // Track changes
  useEffect(() => {
    setHasChanges(currentNote !== note);
  }, [currentNote, note]);

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    try {
      await onSave(currentNote);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const shouldClose = window.confirm(
        "You have unsaved changes. Are you sure you want to close without saving?"
      );
      if (!shouldClose) return;
    }
    
    setCurrentNote(note); // Reset to original
    setHasChanges(false);
    setIsEditing(false);
    onClose();
  };

  const insertMarkdown = (before: string, after: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentNote.substring(start, end);
    const replacement = `${before}${selectedText || placeholder}${after}`;
    
    const newText = currentNote.substring(0, start) + replacement + currentNote.substring(end);
    setCurrentNote(newText);
    
    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + (selectedText || placeholder).length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{conceptTitle}</h1>
          <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">Note</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Edit/Preview Toggle */}
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            disabled={isSaving}
          >
            {isEditing ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </>
            )}
          </Button>

          {/* Save Button */}
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          )}

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Markdown Toolbar (only visible in edit mode) */}
      {isEditing && (
        <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("# ", "", "Heading 1")}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("## ", "", "Heading 2")}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("### ", "", "Heading 3")}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("**", "**", "bold text")}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("*", "*", "italic text")}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("`", "`", "code")}
            title="Inline Code"
          >
            <Code className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("```\n", "\n```", "code block")}
            title="Code Block"
            className="text-xs px-2"
          >
            {"{ }"}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("- ", "", "list item")}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("1. ", "", "numbered item")}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("> ", "", "quote")}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown("[", "](url)", "link text")}
            title="Link"
          >
            <Link className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertMarkdown(
              "| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n| Cell 3   | ", 
              " |", 
              "Cell 4"
            )}
            title="Table"
          >
            <Table className="h-4 w-4" />
          </Button>
          
          <div className="flex-1" />
          
          {hasChanges && (
            <span className="text-sm text-orange-600 font-medium">Unsaved changes</span>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            placeholder="Write your markdown note here...

# Getting Started
Use the toolbar above to format your text, or type markdown directly:

## Formatting
- **Bold text** with **asterisks**
- *Italic text* with *single asterisks*
- `Inline code` with backticks
- [Links](https://example.com) with brackets

## Lists & Structure
- Bullet lists with dashes
1. Numbered lists with numbers
- [ ] Task lists with checkboxes
- [x] Completed tasks

## Advanced Features
> Blockquotes with greater than symbol

```javascript
// Code blocks with syntax highlighting
function hello() {
  console.log('Hello, world!');
}
```

| Tables | Are | Supported |
|--------|-----|-----------|
| Cell 1 | Cell 2 | Cell 3 |

---

Try editing and switching to Preview mode to see the rendered result!"
            className="h-full w-full resize-none border-0 focus:ring-0 rounded-none p-4 font-mono text-sm leading-relaxed"
            disabled={isSaving}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="p-6 prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-li:leading-relaxed prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg prose-pre:p-4 prose-table:border prose-table:border-border prose-th:border prose-th:border-border prose-th:bg-muted prose-td:border prose-td:border-border prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80 prose-strong:font-semibold prose-em:italic prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4">
              {currentNote.trim() ? (
                <div 
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ 
                    __html: renderMarkdown(currentNote) 
                  }} 
                />
              ) : (
                <div className="text-center py-12">
                  <Edit className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No note yet</p>
                  <p className="text-sm text-muted-foreground">Click Edit to start writing your markdown note</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}