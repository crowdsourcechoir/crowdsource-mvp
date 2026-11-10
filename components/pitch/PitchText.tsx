import { pitchTextParts } from "@/lib/pitches/rich-text";

export function PitchText({ text }: { text: string }) {
  return pitchTextParts(text).map((part, index) =>
    part.bold ? (
      <strong key={index} className="font-bold">
        {part.text}
      </strong>
    ) : (
      <span key={index}>{part.text}</span>
    )
  );
}
