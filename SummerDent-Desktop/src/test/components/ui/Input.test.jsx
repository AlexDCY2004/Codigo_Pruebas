import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Input from '../../../components/ui/Input';

describe('Input', () => {
  it('renderiza con label', () => {
    render(<Input label="Nombre" />);
    expect(screen.getByText('Nombre')).toBeInTheDocument();
  });

  it('renderiza input sin label si no se pasa', () => {
    const { container } = render(<Input />);
    expect(container.querySelector('label')).not.toBeInTheDocument();
  });

  it('muestra mensaje de error', () => {
    render(<Input label="Email" error="Campo requerido" />);
    expect(screen.getByText('Campo requerido')).toBeInTheDocument();
  });

  it('aplica clase input-error cuando hay error', () => {
    render(<Input error="Error" />);
    expect(screen.getByRole('textbox')).toHaveClass('input-error');
  });

  it('pasa props adicionales al input', () => {
    render(<Input placeholder="Escribe aquí" type="email" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Escribe aquí');
    expect(input).toHaveAttribute('type', 'email');
  });
});