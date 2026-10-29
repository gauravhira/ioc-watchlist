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
  ipv4: "bg-blue-100 text-blue-800",
  domain: "bg-purple-100 text-purple-800",
  url: "bg-green-100 text-green-800",
  md5: "bg-yellow-100 text-yellow-800",
  sha1: "bg-orange-100 text-orange-800",
  sha256: "bg-red-100 text-red-800",
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
      <h1 className="text-2xl font-bold">IOC Watchlist</h1>

      {/* Add form */}
      <form
        onSubmit={handleSubmit}
        className="border rounded-lg p-4 space-y-3 bg-white shadow-sm"
      >
        <h2 className="font-semibold text-lg">Add Indicator</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm font-mono"
            placeholder="IP, domain, URL, hash (defanged OK)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Tags (comma-separated, e.g. phishing, c2)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add IOC"}
        </button>
      </form>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <span className="text-sm font-medium text-gray-500">Filter:</span>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
          {["ipv4", "domain", "url", "md5", "sha1", "sha256"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {(filterTag || filterType) && (
          <button
            className="text-xs text-blue-600 underline"
            onClick={() => {
              setFilterTag("");
              setFilterType("");
            }}
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400">
          {iocs.length} indicator{iocs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* IOC list */}
      <div className="space-y-2">
        {iocs.length === 0 && (
          <p className="text-gray-400 text-sm">No indicators found.</p>
        )}
        {iocs.map((ioc) => (
          <div
            key={ioc.id}
            className="border rounded-lg p-3 flex items-start gap-3 bg-white shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded-full font-semibold ${
                    TYPE_COLORS[ioc.type] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {ioc.type}
                </span>
                <span className="font-mono text-sm break-all">{ioc.value}</span>
              </div>
              {ioc.note && (
                <p className="text-xs text-gray-500 mt-1">{ioc.note}</p>
              )}
              {ioc.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {ioc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full cursor-pointer hover:bg-gray-200"
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
              className="text-xs text-red-500 hover:text-red-700 shrink-0 mt-0.5"
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
