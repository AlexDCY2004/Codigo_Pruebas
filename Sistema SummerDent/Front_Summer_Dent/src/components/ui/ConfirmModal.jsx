import React from 'react';
import './ConfirmModal.css';

export default function ConfirmModal({ isOpen, title = 'Confirmar', message = '', onConfirm, onCancel, isLoading = false, confirmLabel = 'Eliminar', cancelLabel = 'Cancelar', children = null, hideFooter = false }) {
  if (!isOpen) return null;

  return (
    <div
      className="cm-modal-overlay"
      onClick={(e) => {
        // only close when clicking the backdrop itself
        if (e.target === e.currentTarget && typeof onCancel === 'function') onCancel();
      }}
    >
      <div className="cm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="cm-modal-header">
          <h2 className="cm-modal-title">{title}</h2>
          <button
            type="button"
            className="cm-modal-close"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onCancel === 'function') onCancel();
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="cm-modal-body">
          {children ? (
            <div className="cm-modal-children">{children}</div>
          ) : (
            <p className="cm-modal-message">{message}</p>
          )}
        </div>

        {!hideFooter && (
          <div className="cm-modal-footer">
            <button type="button" className="cm-btn cm-btn-cancel" onClick={onCancel} disabled={isLoading}>{cancelLabel}</button>
            <button type="button" className="cm-btn cm-btn-confirm" onClick={onConfirm} disabled={isLoading}>{isLoading ? (confirmLabel === 'Eliminar' ? 'Eliminando...' : 'Procesando...') : confirmLabel}</button>
          </div>
        )}
      </div>
    </div>
  );
}
