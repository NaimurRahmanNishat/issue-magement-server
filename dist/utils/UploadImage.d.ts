export declare const uploadBufferImage: (buffer: Buffer, folder?: string) => Promise<{
    public_id: string;
    url: string;
}>;
export declare const uploadImageBase64: (image: string, folder?: string) => Promise<{
    public_id: string;
    url: string;
}>;
export declare const deleteImageFromCloudinary: (publicId: string) => Promise<boolean>;
export declare const deleteMultipleImagesFromCloudinary: (publicIds: string[]) => Promise<void>;
//# sourceMappingURL=UploadImage.d.ts.map