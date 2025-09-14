'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

export default function PhotoUploader() {
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Choose an image first');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const upRes = await fetch('/api/ut/upload', { method: 'POST', body: fd });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(upJson?.error || 'Upload failed');
      const key = upJson.key as string;

      const igRes = await fetch('/api/photos/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const igJson = await igRes.json();
      if (!igRes.ok) throw new Error(igJson?.error || 'Ingest failed');

      setFile(null);
      router.push(`/p/${igJson.id}`);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setError(m || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className='mt-4 flex flex-col gap-3'>
      <input
        type='file'
        accept='image/*'
        onChange={e => setFile(e.currentTarget.files?.[0] || null)}
      />
      <button
        disabled={loading || !file}
        className='w-min rounded border px-3 py-1 disabled:opacity-60'
        type='submit'
      >
        {loading ? 'Uploading…' : 'Upload'}
      </button>
      {error ? <div className='text-sm text-red-600'>{error}</div> : null}
    </form>
  );
}
