import type { Metadata } from "next";
import FieldLabClient from "./FieldLabClient";

export const metadata: Metadata = {
  title: "Field test",
  robots: { index: false, follow: false },
};

export default function FieldLabPage() {
  return <FieldLabClient />;
}
