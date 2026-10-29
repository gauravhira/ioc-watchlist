"use client";

import { useEffect, useState, useCallback } from "react";

type Ioc = {
  id: number;
  value: string;
  type: string;
  note: string | null;
  createdAt: string;
  tags: string[];
};

type DeletedIoc = Ioc & { deletedAt: string; expiresAt: string };

const TYPE_COLORS: Record<string, string> = {
  ipv4:   "bg-blue-600 text-white",
  domain: "bg-purple-600 text-white",
  url:    "bg-emerald-600 text-white",
  md5:    "bg-amber-500 text-white",
  sha1:   "bg-orange-500 text-white",
  sha256: "bg-red-600 text-white",
};

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

// Simple confirm modal
function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <p className="text-gray-900 text-sm mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [iocs, setIocs] = useState<Ioc[]>([]);
  const [deleted, setDeleted] = useState<DeletedIoc[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [filterType, setFilterType] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // confirm state: pending delete id
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmPermanentId, setConfirmPermanentId] = useState<number | null>(null);

  const allTags = Array.from(new Set(iocs.flatMap((i) => i.tags))).sort();

  const fetchIocs = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterTag) params.set("tag", filterTag);
    if (filterType) params.set("type", filterType);
    const res = await fetch(`/api/iocs?${params}`);
    setIocs(await res.json());
  }, [filterTag, filterType]);

  const fetchDeleted = useCallback(async () => {
    const res = await fetch("/api/iocs/deleted");
    setDeleted(await res.json());
  }, []);

  useEffect(() => { fetchIocs(); }, [fetchIocs]);
  useEffect(() => { if (showTrash) fetchDeleted(); }, [showTrash, fetchDeleted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/iocs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, note: note || undefined, tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setValue(""); setNote(""); setTagsInput("");
        fetchIocs();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Soft delete (moves to trash)
  async function handleDelete(id: number) {
    await fetch(`/api/iocs/${id}`, { method: "DELETE" });
    fetchIocs();
    if (showTrash) fetchDeleted();
  }

  // Restore from trash
  async function handleRestore(id: number) {
    await fetch(`/api/iocs/${id}`, { method: "PATCH" });
    fetchDeleted();
    fetchIocs();
  }

  // Permanent delete
  async function handlePermanentDelete(id: number) {
    await fetch(`/api/iocs/${id}`, { method: "PUT" });
    fetchDeleted();
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Confirm soft-delete dialog */}
      {confirmId !== null && (
        <ConfirmDialog
          message={`Move this indicator to the trash? It will be permanently deleted after 7 days.`}
          onConfirm={() => { handleDelete(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Confirm permanent delete dialog */}
      {confirmPermanentId !== null && (
        <ConfirmDialog
          message="Permanently delete this indicator? This cannot be undone."
          onConfirm={() => { handlePermanentDelete(confirmPermanentId); setConfirmPermanentId(null); }}
          onCancel={() => setConfirmPermanentId(null)}
        />
      )}

      <h1 className="text-2xl font-bold text-gray-900">IOC Watchlist</h1>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left column: Add form */}
        <div className="w-full md:w-80 shrink-0">
          <form
            onSubmit={handleSubmit}
            className="border border-gray-300 rounded-lg p-4 space-y-3 bg-white shadow-sm"
          >
            <h2 className="font-semibold text-lg text-gray-900">Add Indicator</h2>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="IP, domain, URL, hash (defanged OK)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tags (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            {error && (
              <p className="text-red-700 text-sm bg-red-50 border border-red-300 rounded px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add IOC"}
            </button>
          </form>
        </div>

        {/* Right column: filters + list + recently deleted */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filters */}
          <div className="flex gap-2 items-center flex-wrap">
            <select
              className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All types</option>
              {["ipv4", "domain", "url", "md5", "sha1", "sha256"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {(filterTag || filterType) && (
              <button
                className="text-xs text-blue-600 underline hover:text-blue-800"
                onClick={() => { setFilterTag(""); setFilterType(""); }}
              >
                Clear
              </button>
            )}
            <span className="ml-auto text-sm text-gray-500">
              {iocs.length} indicator{iocs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* IOC list */}
          <div className="space-y-2">
            {iocs.length === 0 && (
              <p className="text-gray-500 text-sm">No indicators found.</p>
            )}
            {iocs.map((ioc) => (
              <div
                key={ioc.id}
                className="border border-gray-300 rounded-lg p-3 flex items-start gap-3 bg-white shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded font-semibold shrink-0 ${
                        TYPE_COLORS[ioc.type] ?? "bg-gray-500 text-white"
                      }`}
                    >
                      {ioc.type}
                    </span>
                    <span className="font-mono text-sm text-gray-900 break-all">{ioc.value}</span>
                  </div>
                  {ioc.note && (
                    <p className="text-xs text-gray-600 mt-1">{ioc.note}</p>
                  )}
                  {ioc.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {ioc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full cursor-pointer hover:bg-gray-300 font-medium"
                          onClick={() => setFilterTag(tag)}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setConfirmId(ioc.id)}
                  className="text-sm text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                  title="Move to trash"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Recently Deleted */}
          <div className="border border-gray-300 rounded-lg bg-white shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => setShowTrash((v) => !v)}
            >
              <span>Recently Deleted</span>
              <span className="text-gray-400 text-xs">{showTrash ? "▲" : "▼"}</span>
            </button>

            {showTrash && (
              <div className="border-t border-gray-200 divide-y divide-gray-100">
                {deleted.length === 0 && (
                  <p className="text-gray-500 text-sm px-4 py-3">Trash is empty.</p>
                )}
                {deleted.map((ioc) => {
                  const days = daysUntil(ioc.expiresAt);
                  return (
                    <div key={ioc.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-mono px-2 py-0.5 rounded font-semibold opacity-60 shrink-0 ${
                              TYPE_COLORS[ioc.type] ?? "bg-gray-500 text-white"
                            }`}
                          >
                            {ioc.type}
                          </span>
                          <span className="font-mono text-sm text-gray-400 break-all line-through">
                            {ioc.value}
                          </span>
                        </div>
                        {ioc.note && (
                          <p className="text-xs text-gray-400 mt-0.5">{ioc.note}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {days > 0
                            ? `Permanently deleted in ${days} day${days !== 1 ? "s" : ""}`
                            : "Expires today"}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0 mt-0.5">
                        <button
                          onClick={() => handleRestore(ioc.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => setConfirmPermanentId(ioc.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
