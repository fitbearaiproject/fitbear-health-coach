// Utility functions for image processing and upload
import { supabase } from '@/integrations/supabase/client';

export class ImageProcessor {
  
  /**
   * Downscale image to max 1280px while maintaining aspect ratio
   */
  static async downscaleImage(file: File, maxWidth = 1280, quality = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          } else {
            width = (width * maxWidth) / height;
            height = maxWidth;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(processedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Upload image to ingest bucket and get signed URL
   */
  static async uploadToIngest(file: File): Promise<string> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2);
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `${timestamp}_${random}.${extension}`;
      const filePath = `temp/${fileName}`;

      // Upload to ingest bucket
      const { data, error } = await supabase.storage
        .from('ingest')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get signed URL (5 minutes expiry)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('ingest')
        .createSignedUrl(filePath, 300); // 5 minutes

      if (urlError) {
        throw new Error(`Failed to get signed URL: ${urlError.message}`);
      }

      return urlData.signedUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  }

  /**
   * Process and upload image for scanner use
   */
  static async processAndUpload(file: File): Promise<{
    signedUrl: string;
    originalSize: number;
    processedSize: number;
  }> {
    const originalSize = file.size;
    
    // Downscale if needed
    const processedFile = await this.downscaleImage(file);
    const processedSize = processedFile.size;
    
    // Upload and get signed URL
    const signedUrl = await this.uploadToIngest(processedFile);
    
    return {
      signedUrl,
      originalSize,
      processedSize
    };
  }

  /**
   * Cleanup uploaded file from ingest bucket
   */
  static async cleanup(signedUrl: string): Promise<void> {
    try {
      // Extract file path from signed URL
      const url = new URL(signedUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/ingest\/(.+)\?/);
      
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        
        await supabase.storage
          .from('ingest')
          .remove([filePath]);
      }
    } catch (error) {
      console.log('Cleanup failed (non-critical):', error.message);
    }
  }
}

export interface ScannerDiagnostics {
  request_id: string;
  status: 'success' | 'error';
  latency_ms: number;
  model: string;
  error_class?: string;
  image_px: string;
  json_parse_ok: boolean;
  duplicate_warning?: boolean;
}

export interface MenuScanRequest {
  image_url: string;
  bps_profile: {
    diet_type?: string;
    conditions?: string[];
    activity_level?: string;
    health_goals?: string;
    allergies?: string[];
    cuisines?: string[];
  };
  targets: {
    calories_per_day?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
  };
}

export interface MealScanRequest {
  image_url: string;
  bps_profile: {
    diet_type?: string;
    conditions?: string[];
    activity_level?: string;
    health_goals?: string;
    allergies?: string[];
    cuisines?: string[];
  };
  targets: {
    calories_per_day?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
  };
}