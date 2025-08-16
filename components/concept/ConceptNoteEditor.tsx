"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { Eye, Edit, Save, X } from "lucide-react";

interface ConceptNoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  conceptTitle: string;
  note: string;
  onSave: (note: string) => Promise<void>;
}

export function ConceptNoteEditor({
  isOpen,
  onClose,
  conceptTitle,
  note,
  onSave,
}: ConceptNoteEditorProps) {
  const [currentNote, setCurrentNote] = useState(note);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when note prop changes
  useEffect(() => {
    setCurrentNote(note);
    setHasChanges(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Note: {conceptTitle}</span>
            <div className="flex items-center gap-2">
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                disabled={isSaving}
              >
                {isEditing ? (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
          {isEditing ? (
            <Textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Write your markdown note here..."
              className="h-full resize-none border-0 focus:ring-0 rounded-none"
              disabled={isSaving}
            />
          ) : (
            <div className="h-full overflow-y-auto p-4 prose prose-sm max-w-none">
              {currentNote.trim() ? (
                <ReactMarkdown>{currentNote}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">No note yet. Click Edit to add one.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {hasChanges && (
                <span className="text-orange-600">Unsaved changes</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
              >
                Close
              </Button>
              {hasChanges && (
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}