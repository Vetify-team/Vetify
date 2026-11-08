"use client";

import { recordSectionSchema, type MedicalRecord, type Pet } from "@vetify/types";
import { Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormError } from "@/components/fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/useBilling";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { today } from "@/lib/format";
import { cardDocument, pdfFileName, recordDocument } from "@/lib/pdf-content";

/** Every page of every section: the record screen shows only the first ones. */
async function fullRecord(petId: string): Promise<MedicalRecord> {
  const record = await api.record(petId, { limit: 100 });
  for (const section of recordSectionSchema.options) {
    let cursor = record.nextCursors[section];
    for (let page = 0; cursor && page < 50; page++) {
      const next = await api.record(petId, { section, cursor, limit: 100 });
      (record[section] as unknown[]).push(...(next[section] as unknown[]));
      record.clinics.push(...next.clinics);
      record.veterinarians.push(...next.veterinarians);
      cursor = next.nextCursors[section];
    }
  }
  return record;
}

/** The public verification QR, when the owner has turned the link on. */
async function cardQr(petId: string): Promise<string | undefined> {
  const link = await api.cardLink(petId).catch(() => null);
  if (!link?.token) return undefined;
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(`${window.location.origin}/verificar#${link.token}`, {
    width: 320,
    margin: 1,
  });
}

/**
 * Downloads the vaccination card or the full record as a PDF, built in the
 * browser from data the owner can already see. It is a Premium feature once
 * payments are on; until then every owner can use it.
 */
export function ExportPdfButton({ pet, kind }: { pet: Pet; kind: "card" | "record" }) {
  const billing = useBillingStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = kind === "card" ? "Descargar carné en PDF" : "Exportar expediente en PDF";

  if (billing.data?.enabled && billing.data.plan === "free") {
    return (
      <Link href="/ajustes" className={buttonVariants({ variant: "outline" })}>
        <Download aria-hidden /> {label} · Premium
      </Link>
    );
  }

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { downloadPdf } = await import("@/lib/pdf");
      const issuedOn = today();
      if (kind === "card") {
        const [status, qr] = await Promise.all([
          api.vaccinationStatus(pet.id),
          cardQr(pet.id),
        ]);
        await downloadPdf(
          cardDocument(pet, status, issuedOn),
          pdfFileName("Carne", pet.name, issuedOn),
          qr,
        );
      } else {
        const record = await fullRecord(pet.id);
        await downloadPdf(
          recordDocument(pet, record, issuedOn),
          pdfFileName("Expediente", pet.name, issuedOn),
        );
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" disabled={busy} onClick={() => void run()}>
        <Download aria-hidden /> {busy ? "Preparando el PDF…" : label}
      </Button>
      <FormError message={error} />
    </div>
  );
}
