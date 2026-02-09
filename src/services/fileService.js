const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Bucket names
const BUCKETS = {
    PRODUCTS: 'product-images',
    INVOICES: 'invoices',
    AVATARS: 'avatars',
    DELIVERY_PROOFS: 'delivery-proofs'
};

/**
 * Upload a file to Supabase Storage
 * @param {Buffer|Blob} file - File buffer or blob
 * @param {string} bucket - Bucket name
 * @param {string} path - File path in bucket
 * @param {string} contentType - MIME type
 * @returns {Promise<{url: string, path: string}>}
 */
const uploadFile = async (file, bucket, path, contentType) => {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
                contentType,
                upsert: true
            });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

        return {
            url: urlData.publicUrl,
            path: data.path
        };
    } catch (error) {
        console.error('Supabase upload error:', error);
        throw new Error('Failed to upload file');
    }
};

/**
 * Upload product image
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} productId - Product ID
 * @param {number} index - Image index
 * @param {string} mimeType - Image MIME type
 */
const uploadProductImage = async (imageBuffer, productId, index, mimeType = 'image/jpeg') => {
    const extension = mimeType.split('/')[1] || 'jpg';
    const path = `${productId}/${Date.now()}_${index}.${extension}`;
    return uploadFile(imageBuffer, BUCKETS.PRODUCTS, path, mimeType);
};

/**
 * Upload user avatar
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} userId - User ID
 * @param {string} mimeType - Image MIME type
 */
const uploadAvatar = async (imageBuffer, userId, mimeType = 'image/jpeg') => {
    const extension = mimeType.split('/')[1] || 'jpg';
    const path = `${userId}/avatar.${extension}`;
    return uploadFile(imageBuffer, BUCKETS.AVATARS, path, mimeType);
};

/**
 * Upload invoice PDF
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {string} orderId - Order ID
 * @param {string} invoiceNumber - Invoice number
 */
const uploadInvoice = async (pdfBuffer, orderId, invoiceNumber) => {
    const path = `${orderId}/${invoiceNumber}.pdf`;
    return uploadFile(pdfBuffer, BUCKETS.INVOICES, path, 'application/pdf');
};

/**
 * Upload delivery proof image
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} deliveryId - Delivery ID
 */
const uploadDeliveryProof = async (imageBuffer, deliveryId) => {
    const path = `${deliveryId}/proof_${Date.now()}.jpg`;
    return uploadFile(imageBuffer, BUCKETS.DELIVERY_PROOFS, path, 'image/jpeg');
};

/**
 * Delete a file from Supabase Storage
 * @param {string} bucket - Bucket name
 * @param {string} path - File path
 */
const deleteFile = async (bucket, path) => {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Supabase delete error:', error);
        throw new Error('Failed to delete file');
    }
};

/**
 * Delete product images folder
 * @param {string} productId - Product ID
 */
const deleteProductImages = async (productId) => {
    try {
        const { data: files, error: listError } = await supabase.storage
            .from(BUCKETS.PRODUCTS)
            .list(productId);

        if (listError) throw listError;

        if (files && files.length > 0) {
            const filePaths = files.map(file => `${productId}/${file.name}`);
            const { error } = await supabase.storage
                .from(BUCKETS.PRODUCTS)
                .remove(filePaths);

            if (error) throw error;
        }

        return true;
    } catch (error) {
        console.error('Delete product images error:', error);
        throw new Error('Failed to delete product images');
    }
};

/**
 * Get signed URL for private files (invoices)
 * @param {string} bucket - Bucket name
 * @param {string} path - File path
 * @param {number} expiresIn - Expiry time in seconds
 */
const getSignedUrl = async (bucket, path, expiresIn = 3600) => {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);

        if (error) throw error;
        return data.signedUrl;
    } catch (error) {
        console.error('Get signed URL error:', error);
        throw new Error('Failed to get signed URL');
    }
};

module.exports = {
    supabase,
    BUCKETS,
    uploadFile,
    uploadProductImage,
    uploadAvatar,
    uploadInvoice,
    uploadDeliveryProof,
    deleteFile,
    deleteProductImages,
    getSignedUrl
};
