"use client";

import { createFeedingEntrySchema, createWeightEntrySchema } from "@vetify/types";
import { Field, TextArea } from "@/components/fields";
import { useRecordEntries } from "@/hooks/useRecord";
import { today } from "@/lib/format";
import { QuickForm } from "./quick-form";

/** Today's weight: recorded by the owner. */
export function WeightForm({ petId }: { petId: string }) {
  const { weight } = useRecordEntries(petId);
  return (
    <QuickForm
      schema={createWeightEntrySchema}
      mutation={weight}
      submitText="Registrar peso de hoy"
      transform={(d) => ({
        ...d,
        weightKg: d.weightKg === undefined ? undefined : Number(d.weightKg),
      })}
    >
      {(errors) => (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Peso (kg)"
            name="weightKg"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            error={errors.weightKg}
          />
          <Field
            label="Fecha"
            name="recordedOn"
            type="date"
            defaultValue={today()}
            max={today()}
            error={errors.recordedOn}
          />
        </div>
      )}
    </QuickForm>
  );
}

/** Feeding or a day-to-day observation. */
export function FeedingForm({ petId }: { petId: string }) {
  const { feeding } = useRecordEntries(petId);
  return (
    <QuickForm
      title="Anotar una observación"
      schema={createFeedingEntrySchema}
      mutation={feeding}
      submitText="Guardar observación"
    >
      {(errors) => (
        <>
          <TextArea
            label="Alimentación, comportamiento o lo que notaste"
            name="notes"
            placeholder="Ej.: comió menos de lo normal"
            error={errors.notes}
          />
          <Field
            label="Fecha"
            name="recordedOn"
            type="date"
            defaultValue={today()}
            max={today()}
            error={errors.recordedOn}
          />
        </>
      )}
    </QuickForm>
  );
}
