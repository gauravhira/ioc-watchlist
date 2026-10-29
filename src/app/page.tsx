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

const TYPE_COLORS: Record<string, string> = {
  ipv4:   "bg-blue-600 text-white",
  domain: "bg-purple-600 text-white",
  url:    "bg-emerald-600 text-white",
  md5:    "bg-amber-500 text-white",
  sha1:   "bg-orange-500 text-white",
  sha256: "bg-red-600 text-white",
};

export default function Home() {
  const [iocs, setIocs] = useState<Ioc[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [filterType, setFilterType] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allTags = Array.from(new Set(iocs.flatMap((i) => i.tags))).sort();

  const fetchIocs = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterTag) params.set("tag", filterTag);
    if (filterType) params.set("type", filterType);
    const res = await fetch(`/api/iocs?${params}`);
    const data = await res.json();
    setIocs(data);
  }, [filterTag, filterType]);

  useEffect(() => {
    fetchIocs();
  }, [fetchIocs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
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
        setValue("");
        setNote("");
        setTagsInput("");
        fetchIocs();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/iocs/${id}`, { method: "DELETE" });
    fetchIocs();
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">IOC Watchlist</h1>

      {/* Add form */}
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
          placeholder="Tags (comma-separated, e.g. phishing, c2)"
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
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add IOC"}
        </button>
      </form>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
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
                  className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${
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
              onClick={() => handleDelete(ioc.id)}
              className="text-sm text-red-500 hover:text-red-700 shrink-0 mt-0.5 font-bold"
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
