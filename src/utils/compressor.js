/**
 * Client-side Canvas Image Compression
 * Shrinks photos down to max 1200px width/height and ~150-250KB JPEG
 */

export async function compressImage(file, maxDimension = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1];
        const sizeKb = Math.round((base64.length * 3) / 4 / 1024);

        resolve({
          name: file.name,
          dataUrl,
          base64,
          sizeKb,
          width,
          height
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressMultipleFiles(files, maxFiles = 5) {
  const fileArray = Array.from(files).slice(0, maxFiles);
  const results = [];
  
  for (const file of fileArray) {
    if (!file.type.startsWith("image/")) continue;
    try {
      const compressed = await compressImage(file);
      results.push(compressed);
    } catch (err) {
      console.warn("Failed to compress image:", file.name, err);
    }
  }
  
  return results;
}
