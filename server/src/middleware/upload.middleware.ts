import upload from 'multer';

// Configure multer for memory storage (files stored in Buffer)
const multerUpload = upload({
  storage: upload.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    console.log('[UploadMiddleware] File filter called:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    
    if (file.mimetype.startsWith('image/')) {
      console.log('[UploadMiddleware] File type OK, accepting');
      cb(null, true);
    } else {
      console.error('[UploadMiddleware] Invalid file type:', file.mimetype);
      cb(new Error('只允许上传图片文件'));
    }
  },
});

// Add logging middleware
const uploadLoggingMiddleware = (req: any, res: any, next: any) => {
  console.log('[UploadMiddleware] Request received:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    contentType: req.headers['content-type'],
  });
  next();
};

export const uploadMiddleware = multerUpload.single('avatar') as any;
export { uploadLoggingMiddleware };
