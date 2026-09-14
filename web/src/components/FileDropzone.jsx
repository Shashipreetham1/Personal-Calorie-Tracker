import { useRef, useState } from 'react';
import { DocumentIcon } from './icons.jsx';

/**
 * Drop or choose a single file.
 *
 * Checks type and size locally first. The server checks both again — and sniffs
 * the file's magic bytes, which a browser cannot — so this is purely to fail
 * instantly on an obvious mistake instead of after a 5MB upload.
 *
 * @param {{ Icon?: (props: object) => JSX.Element, accept: string[], maxBytes?: number,
 *   prompt: string, hint: string,
 *   busyLabel?: string, buttonLabel?: string, typeError?: string,
 *   onSelect: (file: File) => void, busy?: boolean, disabled?: boolean }} props
 */
export function FileDropzone({
  Icon = DocumentIcon,
  accept,
  maxBytes = 5 * 1024 * 1024,
  prompt,
  hint,
  busyLabel = 'Reading…',
  buttonLabel = 'Choose a file',
  typeError = 'That file type is not supported.',
  onSelect,
  busy = false,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState(null);

  function handleFile(file) {
    if (!file) return;

    if (!accept.includes(file.type)) {
      setLocalError(typeError);
      return;
    }
    if (file.size > maxBytes) {
      setLocalError(`That file is larger than ${Math.round(maxBytes / (1024 * 1024))}MB.`);
      return;
    }

    setLocalError(null);
    onSelect(file);
  }

  return (
    <div>
      <div
        className={dragging ? 'dropzone dropzone-active' : 'dropzone'}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(',')}
          className="visually-hidden"
          disabled={disabled || busy}
          onChange={(event) => {
            handleFile(event.target.files[0]);
            // Reset so choosing the same file twice still fires a change event.
            event.target.value = '';
          }}
        />

        {busy ? (
          <p className="dropzone-text" role="status">
            <span className="spinner" aria-hidden="true" /> {busyLabel}
          </p>
        ) : (
          <>
            <Icon size={24} />
            <p className="dropzone-text">{prompt}</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              {buttonLabel}
            </button>
            <p className="dropzone-hint muted">{hint}</p>
          </>
        )}
      </div>

      {localError && (
        <p className="field-error" role="alert">
          {localError}
        </p>
      )}
    </div>
  );
}
