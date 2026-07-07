import './ConfirmModal.css';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, isLoading }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal__header">
          <h3>{title}</h3>
        </div>
        <div className="confirm-modal__body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal__footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary confirm-modal__confirm" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Eliminando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
