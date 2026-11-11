import { redirect } from "next/navigation";

/** Show slides live on Live. Old links land there. */
export default function ShowsPage() {
  redirect("/admin/live");
}
