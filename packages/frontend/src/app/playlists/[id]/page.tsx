import { PlaylistDetailView } from "./PlaylistDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlaylistPage({ params }: Props) {
  const { id } = await params;
  return <PlaylistDetailView id={id} />;
}
