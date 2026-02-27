import { useState, useRef, useEffect } from 'react';

interface PostMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

export default function PostMenu({ onEdit, onDelete }: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleEdit() {
    setOpen(false);
    onEdit();
  }

  function handleDelete() {
    setOpen(false);
    onDelete();
  }

  return (
    <div className="post-menu" ref={menuRef}>
      <button
        type="button"
        className="post-menu-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Post options"
      >
        ⋮
      </button>
      {open && (
        <div className="post-menu-dropdown">
          <button type="button" onClick={handleEdit}>Edit</button>
          <button type="button" className="danger" onClick={handleDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}
