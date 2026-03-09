import fs from 'node:fs/promises';
import { type File } from 'formidable';
import { Resend } from 'resend';
import { methodNotAllowed, sendJson } from './_lib/http';
import { asSingleString, parseMultipart } from './_lib/multipart';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_MIME_PREFIXES = ['image/'];
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/dxf',
  'image/vnd.dxf',
  'application/x-dxf',
  'application/x-autocad'
];
const ACCEPTED_EXTENSIONS = ['.pdf', '.dxf'];

function toFileArray(input: File | File[] | undefined): File[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function looksLikeAcceptedFile(file: File): boolean {
  const mimeType = String(file.mimetype || '');
  const filename = String(file.originalFilename || '').toLowerCase();

  if (ACCEPTED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return true;
  }

  if (ACCEPTED_MIME_TYPES.includes(mimeType)) {
    return true;
  }

  return ACCEPTED_EXTENSIONS.some((extension) => filename.endsWith(extension));
}

function normalizeValue(value: string | string[] | undefined): string {
  return asSingleString(value).trim();
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const destinationEmail = process.env.BB_NOTIFY_EMAIL || 'blackbeardcnc@outlook.com';

  if (!apiKey || !fromEmail) {
    sendJson(res, 500, { error: 'Resend environment variables are not configured.' });
    return;
  }

  try {
    const { fields, files } = await parseMultipart(req, {
      maxFiles: MAX_FILES,
      maxFileSize: MAX_FILE_SIZE
    });

    const website = normalizeValue(fields.website as string | string[] | undefined);
    if (website) {
      sendJson(res, 200, { ok: true });
      return;
    }

    const name = normalizeValue(fields.name as string | string[] | undefined);
    const phone = normalizeValue(fields.phone as string | string[] | undefined);
    const email = normalizeValue(fields.email as string | string[] | undefined);
    const requestType = normalizeValue(fields.requestType as string | string[] | undefined);
    const projectDescription = normalizeValue(fields.projectDescription as string | string[] | undefined);

    const requiredEntries: Array<[string, string]> = [
      ['name', name],
      ['phone', phone],
      ['email', email],
      ['requestType', requestType],
      ['projectDescription', projectDescription]
    ];

    for (const [fieldName, value] of requiredEntries) {
      if (!value) {
        sendJson(res, 400, { error: `Missing required field: ${fieldName}` });
        return;
      }
    }

    const uploadFiles = toFileArray(files.files as File | File[] | undefined);

    if (uploadFiles.length > MAX_FILES) {
      sendJson(res, 400, { error: `Please upload at most ${MAX_FILES} files.` });
      return;
    }

    const attachments: Array<{ filename: string; content: string; type: string }> = [];

    for (const file of uploadFiles) {
      const fileSize = Number(file.size || 0);
      if (fileSize > MAX_FILE_SIZE) {
        sendJson(res, 400, { error: `${file.originalFilename || 'One file'} exceeds 10MB.` });
        return;
      }

      if (!looksLikeAcceptedFile(file)) {
        sendJson(res, 400, {
          error: `${file.originalFilename || 'One file'} is not accepted. Upload image, PDF, or DXF files.`
        });
        return;
      }

      const buffer = await fs.readFile(file.filepath);
      attachments.push({
        filename: String(file.originalFilename || file.newFilename || `attachment-${attachments.length + 1}`),
        content: buffer.toString('base64'),
        type: String(file.mimetype || 'application/octet-stream')
      });
    }

    const resend = new Resend(apiKey);

    const company = normalizeValue(fields.company as string | string[] | undefined);
    const dimensions = normalizeValue(fields.dimensions as string | string[] | undefined);
    const material = normalizeValue(fields.material as string | string[] | undefined);
    const quantity = normalizeValue(fields.quantity as string | string[] | undefined);
    const timeline = normalizeValue(fields.timeline as string | string[] | undefined);
    const budget = normalizeValue(fields.budget as string | string[] | undefined);
    const notes = normalizeValue(fields.notes as string | string[] | undefined);

    const textBody = [
      `Request Type: ${requestType}`,
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Company: ${company || 'N/A'}`,
      `Material: ${material || 'N/A'}`,
      `Dimensions: ${dimensions || 'N/A'}`,
      `Quantity: ${quantity || 'N/A'}`,
      `Timeline: ${timeline || 'N/A'}`,
      `Budget: ${budget || 'N/A'}`,
      '',
      'Project Description:',
      projectDescription,
      '',
      'Additional Notes:',
      notes || 'N/A',
      '',
      `Attachments: ${attachments.length}`
    ].join('\n');

    await resend.emails.send({
      from: fromEmail,
      to: [destinationEmail],
      subject: `Blackbeard CNC ${requestType === 'work_order' ? 'Work Order' : 'Quote'} - ${name}`,
      replyTo: email,
      text: textBody,
      attachments
    });

    sendJson(res, 200, { ok: true });
  } catch (error: any) {
    console.error(error);
    sendJson(res, 500, { error: error?.message || 'Unable to send request.' });
  }
}
