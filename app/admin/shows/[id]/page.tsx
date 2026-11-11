import ShowEditor from "@/components/show/ShowEditor";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default function ShowEditorPage({ params }: PageProps) {
  return <ShowEditor showId={params.id} />;
}
