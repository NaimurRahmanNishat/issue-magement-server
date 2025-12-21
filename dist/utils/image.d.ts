import sharp from "sharp";
export declare const compressImage: (buffer: Buffer, width?: number, quality?: number) => Promise<Buffer>;
export declare const getImageMetadata: (buffer: Buffer) => Promise<sharp.Metadata>;
export declare const convertImageFormat: (buffer: Buffer, format?: "jpeg" | "png" | "webp", quality?: number) => Promise<Buffer>;
//# sourceMappingURL=image.d.ts.map