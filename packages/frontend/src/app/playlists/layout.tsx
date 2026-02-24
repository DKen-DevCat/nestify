import type { Metadata } from "next";
import { PlaylistsLayoutClient } from "./PlaylistsLayoutClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlaylistsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlaylistsLayoutClient>{children}</PlaylistsLayoutClient>;
}
