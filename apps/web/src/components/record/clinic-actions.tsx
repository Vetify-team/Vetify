"use client";

import {
  createConsultationSchema,
  createDewormingSchema,
  createVaccinationSchema,
  dewormingKindSchema,
} from "@vetify/types";
import { Field, Select, TextArea } from "@/components/fields";
import { useRecordEntries, useVaccinationStatus } from "@/hooks/useRecord";
import { today } from "@/lib/format";
import { dewormingKindLabel } from "@/lib/labels";
import { ActionDialog as Action } from "./action-dialog";
import { ExamForm } from "./exam-form";
import { QuickForm } from "./quick-form";

/** What a clinic with an active permission records: the medical act. */
export function ClinicActions({ petId }: { petId: string }) {
  const entries = useRecordEntries(petId);
  // The schedule's vaccines are offered as a list so the name matches the
  // catalog and the API can compute the expiry.
  const { data: status } = useVaccinationStatus(petId);
  const scheduled = status?.vaccines.map((v) => v.vaccine) ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      <Action
        text="Desparasitación"
        title="Desparasitación"
        description="Producto, tipo y próxima dosis."
      >
        {(close) => (
          <QuickForm
            schema={createDewormingSchema}
            mutation={entries.dewormings}
            onSaved={close}
          >
            {(errors) => (
              <>
                <Field label="Producto" name="product" error={errors.product} />
                <Select
                  label="Tipo"
                  name="kind"
                  options={dewormingKindSchema.options.map((value) => ({
                    value,
                    text: dewormingKindLabel[value],
                  }))}
                  error={errors.kind}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Fecha"
                    name="appliedOn"
                    type="date"
                    defaultValue={today()}
                    max={today()}
                    error={errors.appliedOn}
                  />
                  <Field
                    label="Próxima dosis"
                    name="nextDueOn"
                    type="date"
                    error={errors.nextDueOn}
                  />
                </div>
              </>
            )}
          </QuickForm>
        )}
      </Action>

      <Action
        text="Aplicar vacuna"
        title="Aplicar vacuna"
        description="Si no indicás vencimiento, se calcula con el esquema del país."
      >
        {(close) => (
          <QuickForm
            schema={createVaccinationSchema}
            mutation={entries.vaccinations}
            onSaved={close}
          >
            {(errors) => (
              <>
                {scheduled.length > 0 ? (
                  <Select
                    label="Vacuna"
                    name="vaccine"
                    options={scheduled.map((v) => ({ value: v, text: v }))}
                    error={errors.vaccine}
                  />
                ) : (
                  <Field label="Vacuna" name="vaccine" error={errors.vaccine} />
                )}
                <Field label="Lote" name="batch" error={errors.batch} />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Aplicación"
                    name="appliedOn"
                    type="date"
                    defaultValue={today()}
                    max={today()}
                    error={errors.appliedOn}
                  />
                  <Field
                    label="Vencimiento"
                    name="expiresOn"
                    type="date"
                    error={errors.expiresOn}
                  />
                </div>
              </>
            )}
          </QuickForm>
        )}
      </Action>

      <Action
        text="Examen"
        title="Registrar examen"
        description="Resultado y archivo (PDF o imagen) del examen."
      >
        {(close) => <ExamForm petId={petId} onSaved={close} />}
      </Action>

      <Action
        primary
        text="Registrar consulta"
        title="Registrar consulta"
        description="Queda en el expediente del dueño a nombre de tu clínica."
      >
        {(close) => (
          <QuickForm
            schema={createConsultationSchema}
            mutation={entries.consultations}
            onSaved={close}
          >
            {(errors) => (
              <>
                <Field label="Motivo" name="reason" error={errors.reason} />
                <TextArea label="Diagnóstico" name="diagnosis" error={errors.diagnosis} />
                <TextArea label="Notas" name="notes" error={errors.notes} />
              </>
            )}
          </QuickForm>
        )}
      </Action>
    </div>
  );
}
