import fs from 'node:fs/promises';
import { type File } from 'formidable';
import { requireAdmin } from './_lib/auth';
import {
  createUploadedPhoto,
  deleteUploadedPhoto,
  listAllPhotos,
  updateUploadedPhoto
} from './_lib/gallery-store';
import { methodNotAllowed, sanitizeText, sendJson } from './_lib/http';
import { readJsonBody } from './_lib/json-body';
import { asSingleString, parseMultipart } from './_lib/multipart';

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

function getFirstFile(fileInput: File | File[] | undefined): File | undefined {
  if (!fileInput) {
    return undefined;
  }
  return Array.isArray(fileInput) ? fileInput[0] : fileInput;
}

function ensureImage(file: File): string | null {
  const mimeType = String(file.mimetype || '');
  if (!mimeType.startsWith('image/')) {
    return 'Only image files are allowed for gallery photos.';
  }

  if (Number(file.size || 0) > MAX_IMAGE_SIZE) {
    return 'Photo exceeds maximum size limit of 15MB.';
  }

  return null;
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method === 'GET') {
    if (String(req.query?.admin || '') === '1' && !requireAdmin(req, res)) {
      return;
    }

    try {
      const photos = await listAllPhotos();
      sendJson(res, 200, { photos });
      return;
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: 'Unable to load photos.' });
      return;
    }
  }

  if (!['POST', 'PATCH', 'DELETE'].includes(req.method || '')) {
    methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
    return;
  }

  if (!requireAdmin(req, res)) {
    return;
  }

  if (req.method === 'POST') {
    try {
      const { fields, files } = await parseMultipart(req, {
        maxFiles: 1,
        maxFileSize: MAX_IMAGE_SIZE
      });

      const photoFile = getFirstFile(files.photo as File | File[] | undefined);
      if (!photoFile) {
        sendJson(res, 400, { error: 'Photo file is required.' });
        return;
      }

      const fileError = ensureImage(photoFile);
      if (fileError) {
        sendJson(res, 400, { error: fileError });
        return;
      }

      const buffer = await fs.readFile(photoFile.filepath);
      const photo = await createUploadedPhoto({
        title: asSingleString(fields.title as string | string[] | undefined),
        category: asSingleString(fields.category as string | string[] | undefined),
        alt: asSingleString(fields.alt as string | string[] | undefined),
        originalFilename: String(photoFile.originalFilename || photoFile.newFilename || 'upload.jpg'),
        contentType: String(photoFile.mimetype || 'image/jpeg'),
        buffer
      });

      sendJson(res, 201, { photo });
      return;
    } catch (error: any) {
      console.error(error);
      sendJson(res, 500, { error: error?.message || 'Photo upload failed.' });
      return;
    }
  }

  const id = sanitizeText(req.query?.id);
  if (!id) {
    sendJson(res, 400, { error: 'Photo id is required.' });
    return;
  }

  if (req.method === 'PATCH') {
    try {
      const body = await readJsonBody(req);
      const photo = await updateUploadedPhoto(id, {
        title: sanitizeText((body as any).title),
        category: sanitizeText((body as any).category),
        alt: sanitizeText((body as any).alt)
      });

      sendJson(res, 200, { photo });
      return;
    } catch (error: any) {
      console.error(error);
      sendJson(res, 400, { error: error?.message || 'Unable to update photo.' });
      return;
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteUploadedPhoto(id);
      sendJson(res, 200, { ok: true });
      return;
    } catch (error: any) {
      console.error(error);
      sendJson(res, 400, { error: error?.message || 'Unable to delete photo.' });
      return;
    }
  }
}
