import { Outlet, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { SongListItem } from "~/data/ai-studio";
import { SongsSidebar } from "~/components/songs/songs-sidebar";

export function SongsShell({ songsList }: { songsList: SongListItem[] }) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const pathname = useLocation({ select: (state) => state.pathname });
	const pathMatch = pathname.match(/^\/song\/(\d+)$/);
	const selectedSongId = pathMatch ? Number(pathMatch[1]) : null;
	const selectedSong = selectedSongId
		? (songsList.find((song) => song.id === selectedSongId) ?? null)
		: null;

	return (
		<div className="neo-app flex h-screen overflow-hidden font-sans">
			<AnimatePresence>
				{isSidebarOpen && (
					<>
						<motion.button
							animate={{ opacity: 1 }}
							aria-label="Close sidebar"
							className="fixed inset-0 z-40 bg-black/50 md:hidden"
							exit={{ opacity: 0 }}
							initial={{ opacity: 0 }}
							onClick={() => setIsSidebarOpen(false)}
							transition={{ duration: 0.22, ease: "easeOut" }}
							type="button"
						/>
						<motion.aside
							animate={{ x: 0 }}
							className="neo-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col md:hidden"
							exit={{ x: "-100%" }}
							initial={{ x: "-100%" }}
							transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
						>
							<SongsSidebar
								onClose={() => setIsSidebarOpen(false)}
								selectedSongId={selectedSongId}
								songsList={songsList}
							/>
						</motion.aside>
					</>
				)}
			</AnimatePresence>

			<aside className="neo-sidebar hidden md:flex md:w-72 md:flex-col">
				<SongsSidebar
					onClose={() => setIsSidebarOpen(false)}
					selectedSongId={selectedSongId}
					songsList={songsList}
				/>
			</aside>

			<main className="relative flex h-full flex-1 flex-col overflow-hidden">
				<header className="neo-border-b z-30 flex items-center gap-4 bg-[var(--bg-app)] p-4 md:hidden">
					<button
						className="neo-card-no-hover p-2"
						onClick={() => setIsSidebarOpen(true)}
						type="button"
					>
						<Menu className="h-6 w-6" />
					</button>
					<h1 className="truncate text-xl font-bold uppercase">
						{selectedSong ? selectedSong.title : "New Song"}
					</h1>
				</header>
				<div className="flex-1 overflow-y-auto">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
