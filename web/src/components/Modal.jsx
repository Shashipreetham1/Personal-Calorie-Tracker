import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons.jsx';

/**
 * A dialog rendered over the page.
 *
 * Uses the native `<dialog>` element so focus trapping, Escape, and the
 * inert backdrop come from the browser rather than being reimplemented — the
 * usual home-made modal gets at least one of those wrong.
 *
 * @param {{ open: boolean, title: string, onClose: () => void, children: React.ReactNode,
 *   footer?: React.ReactNode, wide?: boolean }} props
 */
export function Modal({ open, title, onClose, children, footer, wide = false }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    // Escape and the backdrop both fire `cancel`/`close`; route them through
    // the same callback so parent state cannot drift out of sync with the DOM.
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className={wide ? 'modal modal-wide' : 'modal'} aria-label={title}>
      <div className="modal-header">
        <h2 className="modal-title">{title}</h2>
        <button type="button" className="button button-ghost" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="modal-body">{children}</div>

      {footer && <div className="modal-footer">{footer}</div>}
    </dialog>
  );
}
