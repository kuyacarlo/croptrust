import { Bookmark, X } from "lucide-react";

interface BookmarkEntry {
  id: string;
  label: string;
  coords: { lat: number; lng: number }[];
  center: { lat: number; lng: number };
  bbox: { west: number; south: number; east: number; north: number };
  createdAt: number;
}

interface Props {
  bookmarks: BookmarkEntry[];
  onRestore: (entry: BookmarkEntry) => void;
  onDelete: (id: string) => void;
}

export default function BookmarkList({ bookmarks, onRestore, onDelete }: Props) {
  if (bookmarks.length === 0) return null;

  return (
    <div className="card-farm overflow-y-auto p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-600">
        <Bookmark size={12} className="inline mr-1.5" />
        Saved Areas
      </h3>
      <div className="space-y-1.5">
        {bookmarks.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-left transition hover:border-farm-200"
          >
            <button
              onClick={() => onRestore(b)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium text-stone-700">{b.label}</p>
              <p className="text-[10px] text-stone-400">
                {b.coords.length} pts &middot; {b.center.lat.toFixed(4)}, {b.center.lng.toFixed(4)}
              </p>
            </button>
            <button
              onClick={() => onDelete(b.id)}
              className="ml-2 shrink-0 rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-500"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}