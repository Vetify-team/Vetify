"use client";

import { Paperclip } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";

/**
 * Opens an exam's file. The link is asked for on each click and works only
 * for a few minutes, so a copied link soon stops working.
 */
export function ExamFileButton({
  petId,
  examId,
  format,
}: {
  petId: string;
  examId: string;
  format: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    // Opened during the click so the browser does not block it as a pop-up.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setPending(true);
    setError(null);
    try {
      const { url } = await api.examFileLink(petId, examId);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="flex flex-col items-start gap-0.5">
      <Button
        type="button"
        variant="link"
        size="xs"
        className="h-auto px-0"
        disabled={pending}
        onClick={() => void open()}
      >
        <Paperclip aria-hidden />
        {pending ? "Abriendo…" : `Ver archivo (${format.toUpperCase()})`}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
