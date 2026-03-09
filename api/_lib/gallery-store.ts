import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { del, list, put } from '@vercel/blob';

export type GalleryPhoto = {
  id: string;
  title: string;
  category: string;
  alt: string;
  url: string;
  source: 'seed' | 'uploaded';
  createdAt: string;
  imagePathname?: string;
  metaPathname?: string;
};

type PhotoUpdates = {
  title?: string;
  category?: string;
  alt?: string;
};

function readWriteConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function normalizeText(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
}

async function listSeedPhotos(): Promise<GalleryPhoto[]> {
  const seedPath = path.join(process.cwd(), 'data', 'seed-photos.json');
  const raw = await fs.readFile(seedPath, 'utf8');
  return JSON.parse(raw) as GalleryPhoto[];
}

async function listUploadedPhotos(): Promise<GalleryPhoto[]> {
  if (!readWriteConfigured()) {
    return [];
  }

  const metaList = await list({ prefix: 'gallery/meta/' });
  const photos: GalleryPhoto[] = [];

  for (const blob of metaList.blobs) {
    try {
      const response = await fetch(blob.url);
      if (!response.ok) continue;
      const photo = (await response.json()) as GalleryPhoto;
      photos.push(photo);
    } catch {
      continue;
    }
  }

  return photos;
}

export async function listAllPhotos(): Promise<GalleryPhoto[]> {
  const [seed, uploaded] = await Promise.all([listSeedPhotos(), listUploadedPhotos()]);
  const all = [...uploaded, ...seed];
  all.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  return all;
}

async function readMetaById(id: string): Promise<GalleryPhoto | null> {
  if (!readWriteConfigured()) {
    return null;
  }

  const result = await list({ prefix: `gallery/meta/${id}.json` });
  const blob = result.blobs[0];
  if (!blob) {
    return null;
  }

  const response = await fetch(blob.url);
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GalleryPhoto;
}

export async function createUploadedPhoto(input: {
  title: unknown;
  category: unknown;
  alt: unknown;
  originalFilename: string;
  contentType: string;
  buffer: Buffer;
}): Promise<GalleryPhoto> {
  if (!readWriteConfigured()) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured.');
  }

  const id = randomUUID();
  const safeFilename = sanitizeFilename(input.originalFilename || `${id}.jpg`);

  const imagePathname = `gallery/images/${id}-${safeFilename}`;
  const imageBlob = await put(imagePathname, input.buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: input.contentType
  });

  const photo: GalleryPhoto = {
    id,
    title: normalizeText(input.title, 'Untitled Project'),
    category: normalizeText(input.category, 'General'),
    alt: normalizeText(input.alt, 'Blackbeard CNC project photo'),
    url: imageBlob.url,
    source: 'uploaded',
    createdAt: new Date().toISOString(),
    imagePathname: imageBlob.pathname,
    metaPathname: `gallery/meta/${id}.json`
  };

  await put(photo.metaPathname, JSON.stringify(photo), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json'
  });

  return photo;
}

export async function updateUploadedPhoto(id: string, updates: PhotoUpdates): Promise<GalleryPhoto> {
  const existing = await readMetaById(id);
  if (!existing) {
    throw new Error('Photo not found.');
  }

  const next: GalleryPhoto = {
    ...existing,
    title: normalizeText(updates.title, existing.title),
    category: normalizeText(updates.category, existing.category),
    alt: normalizeText(updates.alt, existing.alt)
  };

  if (!next.metaPathname) {
    throw new Error('Photo metadata path missing.');
  }

  await put(next.metaPathname, JSON.stringify(next), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json'
  });

  return next;
}

export async function deleteUploadedPhoto(id: string): Promise<void> {
  const existing = await readMetaById(id);
  if (!existing) {
    throw new Error('Photo not found.');
  }

  if (existing.source !== 'uploaded') {
    throw new Error('Seed photos cannot be deleted.');
  }

  const paths = [existing.metaPathname, existing.imagePathname].filter(Boolean) as string[];
  if (!paths.length) {
    return;
  }

  await del(paths);
}
