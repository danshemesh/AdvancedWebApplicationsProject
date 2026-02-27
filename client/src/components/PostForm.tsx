import { useState, useRef } from 'react';
import { apiRequest, getUploadsUrl } from '../api/client';

interface PostFormProps {
  initialContent?: string;
  initialImagePath?: string;
  postId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function PostForm({
  initialContent = '',
  initialImagePath = '',
  postId,
  onSuccess,
  onCancel,
}: PostFormProps) {
  const [content, setContent] = useState(initialContent);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(initialImagePath ? getUploadsUrl(initialImagePath) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(postId);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  function clearImage() {
    setImageFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('content', content.trim());
    if (imageFile) {
      formData.append('image', imageFile);
    }

    const url = isEdit ? `/post/${postId}` : '/post';
    const method = isEdit ? 'PUT' : 'POST';

    const { ok, data } = await apiRequest<{ error?: string }>(url, {
      method,
      body: formData,
    });

    setSubmitting(false);

    if (ok) {
      if (!isEdit) {
        setContent('');
        clearImage();
      }
      onSuccess();
    } else {
      const errMsg = data && typeof data === 'object' && 'error' in data
        ? (data as { error: string }).error
        : 'Failed to save post';
      setError(errMsg);
    }
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      {error && <p className="error">{error}</p>}
      <textarea
        className="post-form-textarea"
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
      />
      <div className="post-form-image-section">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          id={`image-input-${postId || 'new'}`}
          style={{ display: 'none' }}
        />
        <label htmlFor={`image-input-${postId || 'new'}`} className="post-form-image-btn">
          {previewUrl ? 'Change Image' : 'Add Image'}
        </label>
        {previewUrl && (
          <button type="button" className="post-form-clear-btn" onClick={clearImage}>
            Remove
          </button>
        )}
      </div>
      {previewUrl && (
        <div className="post-form-preview">
          <img src={previewUrl} alt="Preview" />
        </div>
      )}
      <div className="post-form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Update' : 'Post'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
