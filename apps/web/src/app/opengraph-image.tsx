import { ImageResponse } from "next/og";

export const alt = "Vetify — El expediente de tu mascota, siempre con vos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview image shared links show, in the app's palette. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 96px",
        background: "#f4efe5",
        color: "#1d1b18",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ fontSize: 26, letterSpacing: 8, color: "#8a5c14" }}>
        EXPEDIENTE CLÍNICO COMPARTIDO
      </div>
      <div style={{ fontSize: 150, lineHeight: 1, marginTop: 24 }}>Vetify</div>
      <div style={{ fontSize: 52, lineHeight: 1.15, marginTop: 28, maxWidth: 900 }}>
        El expediente de tu mascota, siempre con vos.
      </div>
      <div style={{ fontSize: 30, marginTop: 36, color: "#6a645a" }}>
        Vacunas, consultas y carné digital con QR · Costa Rica
      </div>
    </div>,
    size,
  );
}
