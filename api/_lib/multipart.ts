import formidable, { type Fields, type Files } from 'formidable';

export async function parseMultipart(req: any, options?: Parameters<typeof formidable>[0]): Promise<{ fields: Fields; files: Files }> {
  const form = formidable({
    multiples: true,
    maxFiles: 6,
    keepExtensions: true,
    ...options
  });

  return await new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files });
    });
  });
}

export function asSingleString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? '');
  }
  return String(value ?? '');
}
