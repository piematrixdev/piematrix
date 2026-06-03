/**
 * ImageInput — a URL field plus a "Upload" button. The admin can either
 * paste an image URL or upload a file (which lands in Supabase Storage
 * and fills the URL automatically). Shows a live preview.
 */

import { useRef, useState } from 'react';
import { uploadImage } from './uploadImage';
import { C, ui } from './adminTheme';

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** Storage subfolder, e.g. "banners" or "heroes". */
  folder: string;
  /** Preview aspect — height in px. */
  previewHeight?: number;
  placeholder?: string;
}

export default function ImageInput({
  value,
  onChange,
  folder,
  previewHeight = 130,
  placeholder = 'https://… or upload a file',
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected later.
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadImage(file, folder);
      onChange(url);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={styles.row}>
        <input
          style={ui.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          style={{ ...ui.ghostBtn, whiteSpace: 'nowrap', opacity: uploading ? 0.6 : 1 }}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : '↑ Upload'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="preview"
          style={{ ...styles.preview, height: previewHeight }}
          onError={() => setError('Could not load image from this URL.')}
        />
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', gap: 8, alignItems: 'stretch' },
  preview: {
    width: '100%',
    objectFit: 'cover',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    marginTop: 10,
    display: 'block',
  },
  error: {
    color: C.red,
    fontSize: 12,
    marginTop: 6,
  },
};
