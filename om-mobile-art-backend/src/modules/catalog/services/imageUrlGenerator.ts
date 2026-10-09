export class ImageUrlGenerator {
  generateUrl(key: string | null): string {
    if (!key) return '';
    // If it's already a full URL, return it
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }
    // Standardize key by removing leading slash
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    
    // Ensure we prefix local uploads with /uploads/
    const path = cleanKey.startsWith('uploads/') ? `/${cleanKey}` : `/uploads/${cleanKey}`;
    return `http://localhost:3000${path}`;
  }
}

export const imageUrlGenerator = new ImageUrlGenerator();
