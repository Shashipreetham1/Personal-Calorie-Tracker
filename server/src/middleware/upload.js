import multer from 'multer';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * File upload handling for the AI endpoints.
 *
 * Everything here runs BEFORE the model is called. Size, count and type are all
 * settled locally, so an oversized or unsupported file costs nothing but a
 * rejected request — no token spend, no latency, no quota consumed.
 */

/**
 * Magic byte signatures, checked against the file's actual content.
 *
 * `file.mimetype` is supplied by the client and is not evidence: a PDF renamed
 * to .jpg arrives claiming image/jpeg. Since the declared type is forwarded to
 * Gemini, trusting it means sending a mislabelled file and getting a confusing
 * upstream error instead of a clear local one.
 *
 * @type {{ mimeType: string, matches: (buffer: Buffer) => boolean }[]}
 */
const IMAGE_SIGNATURES = [
  {
    mimeType: 'image/jpeg',
    matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    matches: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    // RIFF....WEBP
    mimeType: 'image/webp',
    matches: (b) =>
      b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/** PDFs, for the bulk import endpoint. */
const PDF_SIGNATURE = {
  mimeType: 'application/pdf',
  matches: (b) => b.length > 4 && b.subarray(0, 5).toString('ascii') === '%PDF-',
};

/**
 * Identifies a buffer by its contents.
 *
 * @param {Buffer} buffer
 * @param {{ mimeType: string, matches: Function }[]} signatures
 * @returns {string | null} The detected MIME type, or null if unrecognised.
 */
function detectMimeType(buffer, signatures) {
  return signatures.find((signature) => signature.matches(buffer))?.mimeType ?? null;
}

/**
 * Builds a multer instance that keeps the file in memory.
 *
 * Memory storage, not disk: these files are forwarded to an API and then
 * discarded. Writing them to disk would mean managing a temp directory, its
 * permissions, and its cleanup, for no benefit.
 *
 * @param {string[]} allowedMimeTypes
 * @returns {import('multer').Multer}
 */
function createUploader(allowedMimeTypes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.ai.uploadMaxBytes,
      files: 1,
      // No text fields are expected alongside the file; the `type` hint is a
      // query parameter, so a multipart body with extra fields is suspicious.
      fields: 2,
    },
    fileFilter(_req, file, callback) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        callback(
          AppError.unsupportedMediaType(
            `Unsupported file type "${file.mimetype}". Allowed: ${allowedMimeTypes.join(', ')}.`,
          ),
        );
        return;
      }
      callback(null, true);
    },
  });
}

/**
 * Wraps a multer middleware so its failures become AppErrors.
 *
 * Multer reports problems as MulterError with codes rather than status codes;
 * left alone they would surface as generic 500s.
 *
 * @param {import('express').RequestHandler} middleware
 * @param {{ signatures: { mimeType: string, matches: Function }[], fieldLabel: string }} options
 * @returns {import('express').RequestHandler}
 */
function handleUpload(middleware, { signatures, fieldLabel }) {
  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          const maxMb = Math.round(config.ai.uploadMaxBytes / (1024 * 1024));

          if (error.code === 'LIMIT_FILE_SIZE') {
            return next(AppError.payloadTooLarge(`File is too large. Maximum size is ${maxMb}MB.`));
          }
          if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(
              AppError.badRequest(`Send exactly one file, in a field named "${fieldLabel}".`),
            );
          }
          return next(AppError.badRequest(`Upload failed: ${error.message}`));
        }
        return next(error);
      }

      if (!req.file) {
        return next(AppError.badRequest(`No file received. Send one in a field named "${fieldLabel}".`));
      }

      const detected = detectMimeType(req.file.buffer, signatures);
      if (!detected) {
        return next(
          AppError.unsupportedMediaType(
            'That file is not a supported image or PDF. Its contents do not match its declared type.',
          ),
        );
      }

      // Downstream code uses the DETECTED type, never the client's claim.
      req.file.detectedMimeType = detected;
      return next();
    });
  };
}

/** `POST /api/extract/image` — a single image in the `image` field. */
export const uploadImage = handleUpload(
  createUploader([...IMAGE_SIGNATURES.map((s) => s.mimeType), 'image/jpg']).single('image'),
  { signatures: IMAGE_SIGNATURES, fieldLabel: 'image' },
);

/** `POST /api/import/pdf` — a single PDF in the `file` field. */
export const uploadPdf = handleUpload(createUploader(['application/pdf']).single('file'), {
  signatures: [PDF_SIGNATURE],
  fieldLabel: 'file',
});
