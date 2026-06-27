import { Router } from 'express';
import multer from 'multer';
import { handleUpload } from '../controllers/uploadController.js';

const router = Router();

// Keep the file in memory — we parse it immediately and never persist to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const PPTX_MIME =
      'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const isPdf = file.mimetype === 'application/pdf' && name.endsWith('.pdf');
    const isPptx =
      (file.mimetype === PPTX_MIME ||
        file.mimetype === 'application/octet-stream') &&
      name.endsWith('.pptx');
    if (!isPdf && !isPptx) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

router.post('/', upload.single('file'), handleUpload);

export default router;
