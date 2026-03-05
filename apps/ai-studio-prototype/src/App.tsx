import { useState } from "react";
import {
	ArrowRight,
	BookOpen,
	ChevronDown,
	ChevronUp,
	Menu,
	Music,
	Play,
	Search,
	X,
} from "lucide-react";
import { MOCK_DATA } from "./data";

export default function App() {
	const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

	const toggleLine = (index: number) => {
		const newSet = new Set(expandedLines);
		if (newSet.has(index)) {
			newSet.delete(index);
		} else {
			newSet.add(index);
		}
		setExpandedLines(newSet);
	};

	const handleGenerate = () => {
		if (urlInput) {
			setSelectedSongId(1);
			setUrlInput("");
		}
	};

	const songsList = [
		{ id: 1, title: MOCK_DATA.song.title, artist: MOCK_DATA.song.artist },
		{ id: 2, title: "Yoru ni Kakeru", artist: "YOASOBI" },
		{ id: 3, title: "Pretender", artist: "Official HIGE DANdism" },
	];

	return (
		<div className="neo-app font-sans flex h-screen overflow-hidden">
			{isSidebarOpen && (
				<button
					aria-label="Close sidebar"
					className="fixed inset-0 z-40 bg-black/50 md:hidden"
					onClick={() => setIsSidebarOpen(false)}
					type="button"
				/>
			)}

			<aside
				className={`
        neo-sidebar fixed md:static inset-y-0 left-0 z-50 w-72 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
			>
				<div className="p-6 neo-border-b flex justify-between items-center">
					<h1 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
						<Music className="w-6 h-6" />
						UtaSensei
					</h1>
					<button
						className="md:hidden"
						onClick={() => setIsSidebarOpen(false)}
						type="button"
					>
						<X className="w-6 h-6" />
					</button>
				</div>

				<div className="p-4 flex-1 overflow-y-auto">
					<h2 className="text-sm font-bold uppercase mb-4 neo-text-muted tracking-widest">
						Your Library
					</h2>
					<div className="space-y-3">
						{songsList.map((song) => (
							<button
								className={`w-full text-left p-3 ${selectedSongId === song.id ? "neo-card" : "neo-card-no-hover opacity-80 hover:opacity-100"} flex items-center gap-3`}
								key={song.id}
								onClick={() => {
									setSelectedSongId(song.id);
									setIsSidebarOpen(false);
								}}
								type="button"
							>
								<div className="w-10 h-10 neo-border bg-[var(--bg-accent)] flex items-center justify-center shrink-0">
									<Play className="w-5 h-5 text-[var(--text-on-accent)] ml-1" />
								</div>
								<div className="overflow-hidden">
									<p className="font-bold truncate">{song.title}</p>
									<p className="text-xs neo-text-muted truncate">
										{song.artist}
									</p>
								</div>
							</button>
						))}
					</div>
				</div>

				<div className="p-4 neo-border-t">
					<button
						className="w-full neo-button py-3 flex items-center justify-center gap-2"
						onClick={() => {
							setSelectedSongId(null);
							setIsSidebarOpen(false);
						}}
						type="button"
					>
						<Search className="w-5 h-5" />
						New Song
					</button>
				</div>
			</aside>

			<main className="flex-1 flex flex-col h-full overflow-hidden relative">
				<header className="md:hidden p-4 neo-border-b flex items-center gap-4 bg-[var(--bg-app)] z-30">
					<button
						className="neo-card-no-hover p-2"
						onClick={() => setIsSidebarOpen(true)}
						type="button"
					>
						<Menu className="w-6 h-6" />
					</button>
					<h1 className="text-xl font-bold uppercase truncate">
						{selectedSongId ? MOCK_DATA.song.title : "New Song"}
					</h1>
				</header>

				<div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
					<div className="max-w-4xl mx-auto">
						{!selectedSongId ? (
							<div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
								<div className="relative">
									<div className="absolute -inset-4 bg-[var(--bg-accent)] neo-border transform rotate-2 z-0" />
									<div className="neo-card-no-hover p-8 md:p-12 relative z-10 bg-[var(--bg-card)]">
										<h2 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter mb-4">
											Learn Japanese
											<br />
											From Lyrics
										</h2>
										<p className="neo-text-muted text-lg md:text-xl mb-8 font-mono">
											Paste a URL to generate a lesson.
										</p>

										<div className="flex flex-col md:flex-row gap-4">
											<input
												className="neo-input flex-1 text-lg font-mono"
												onChange={(e) => setUrlInput(e.target.value)}
												placeholder="e.g. https://genius.com/..."
												type="text"
												value={urlInput}
											/>
											<button
												className="neo-button px-8 py-4 text-lg flex items-center justify-center gap-2"
												onClick={handleGenerate}
												type="button"
											>
												Generate <ArrowRight className="w-5 h-5" />
											</button>
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-8 pb-24">
								<div className="neo-card-no-hover p-6 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
									<div>
										<h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-2">
											{MOCK_DATA.song.title}
										</h2>
										<p className="text-xl neo-text-muted font-mono flex items-center gap-2">
											<Music className="w-5 h-5" /> {MOCK_DATA.song.artist}
										</p>
									</div>
									<div className="neo-border px-4 py-2 bg-[var(--bg-accent)] text-[var(--text-on-accent)] font-bold text-sm uppercase inline-block self-start md:self-auto">
										Source: Genius
									</div>
								</div>

								<div className="space-y-4">
									{MOCK_DATA.lines.map((line) => {
										const isExpanded = expandedLines.has(line.lineIndex);
										return (
											<div
												className="neo-card-no-hover overflow-hidden"
												key={line.lineIndex}
											>
												<button
													className="w-full text-left p-4 md:p-6 flex items-start justify-between gap-4 hover:bg-[var(--bg-card-hover)] transition-colors"
													onClick={() => toggleLine(line.lineIndex)}
													type="button"
												>
													<div className="flex-1">
														<p className="text-xl md:text-2xl font-bold mb-2">
															{line.originalText}
														</p>
														<p className="text-md neo-text-muted font-mono">
															{line.translationText}
														</p>
													</div>
													<div className="neo-border p-2 bg-[var(--bg-app)] shrink-0">
														{isExpanded ? (
															<ChevronUp className="w-5 h-5" />
														) : (
															<ChevronDown className="w-5 h-5" />
														)}
													</div>
												</button>

												{isExpanded && (
													<div className="p-4 md:p-6 neo-border-t bg-[var(--bg-app)]/30">
														<div className="mb-6">
															<h4 className="font-bold uppercase tracking-widest text-sm mb-2 flex items-center gap-2">
																<BookOpen className="w-4 h-4" /> Explanation
															</h4>
															<p className="leading-relaxed font-mono text-sm md:text-base">
																{line.longFormExplanation}
															</p>
														</div>

														<div>
															<h4 className="font-bold uppercase tracking-widest text-sm mb-3">
																Vocabulary
															</h4>
															<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
																{line.vocabularies.map((vocab) => (
																	<div
																		className="neo-border p-3 bg-[var(--bg-card)]"
																		key={`${line.lineIndex}-${vocab.originalText}`}
																	>
																		<p className="font-bold mb-1">
																			{vocab.originalText}
																		</p>
																		<p className="text-xs neo-text-muted font-mono">
																			{vocab.explanation}
																		</p>
																	</div>
																))}
															</div>
														</div>
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
