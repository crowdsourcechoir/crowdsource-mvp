import { redirect } from "next/navigation";

/** Legacy Canvas hub — living-system domain is now Composer. */
export default function CanvasRedirectPage() {
  redirect("/admin/composer");
}
