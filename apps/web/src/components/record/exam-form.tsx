"use client";

import { createExamSchema } from "@vetify/types";
import { useState } from "react";
import { Field, TextArea } from "@/components/fields";
import { FileUploadField, type UploadState } from "@/components/file-upload";
import { useRecordEntries } from "@/hooks/useRecord";
import { today } from "@/lib/format";
import { QuickForm } from "./quick-form";

/**
 * An exam with an optional file. The clinic records it with its permission;
 * the owner adds results from outside labs.
 */
export function ExamForm({ petId, onSaved }: { petId: string; onSaved?: () => void }) {
  const { exams } = useRecordEntries(petId);
  const [upload, setUpload] = useState<UploadState["status"]>("idle");
  return (
    <QuickForm
      schema={createExamSchema}
      mutation={exams}
      onSaved={onSaved}
      busy={upload === "uploading" || upload === "error"}
      submitText={upload === "uploading" ? "Esperando el archivo…" : "Guardar examen"}
    >
      {(errors) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Tipo"
              name="kind"
              placeholder="Ej.: hemograma"
              error={errors.kind}
            />
            <Field
              label="Fecha"
              name="performedOn"
              type="date"
              defaultValue={today()}
              max={today()}
              error={errors.performedOn}
            />
          </div>
          <TextArea label="Resultado" name="result" error={errors.result} />
          <FileUploadField
            petId={petId}
            purpose="exam_file"
            label="Archivo del examen (opcional)"
            name="file"
            error={errors.file}
            onStatusChange={setUpload}
          />
        </>
      )}
    </QuickForm>
  );
}
