declare module "qrcode" {
  /** The options of `qrcode` this app uses. */
  interface QRCodeOptions {
    width: number;
    margin: number;
    /** L 7 %, M 15 %, Q 25 %, H 30 % of the code can be damaged and still read. */
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: { dark?: string; light?: string };
  }
  const QRCode: {
    toDataURL(text: string, options: QRCodeOptions): Promise<string>;
  };
  export default QRCode;
}
