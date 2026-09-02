import { EMAIL_SIGNATURE_QUOTE } from "@/lib/sales/outreach/signature";

/** Read-only footer shown under draft editors and opportunity email previews. */
export default function EmailSignaturePreview({ className = "" }: { className?: string }) {
  return (
    <div className={`whitespace-pre-wrap text-sm text-gray-400 ${className}`}>
      <p>--</p>
      <p>Joel DeJong</p>
      <p>Creator, Crowdsource Choir</p>
      <p>
        <span className="italic font-serif">&quot;{EMAIL_SIGNATURE_QUOTE}&quot;</span>
      </p>
      <p>—American Songwriter</p>
    </div>
  );
}
