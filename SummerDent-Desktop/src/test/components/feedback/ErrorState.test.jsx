import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ErrorState from '../../../components/feedback/ErrorState';

describe('ErrorState', () => {
  it('renderiza título y mensaje', () => {
    render(<ErrorState title="Error" message="Algo salió mal" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });

  it('renderiza botón de reintento y llama onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Error" message="Algo salió mal" onRetry={onRetry} />);
    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('no renderiza botón de reintento si no hay onRetry', () => {
    render(<ErrorState title="Error" message="Algo salió mal" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});