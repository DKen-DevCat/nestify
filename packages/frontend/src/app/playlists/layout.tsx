import { PlaylistsLayoutClient } from "./PlaylistsLayoutClient";

export default function PlaylistsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlaylistsLayoutClient>{children}</PlaylistsLayoutClient>;
}
