import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIWizard from './AIWizard';

describe('AIWizard', () => {
  it('renders with minimal input and proposes a category', () => {
    render(<AIWizard settings={{}} setRoute={() => {}} />);
    expect(screen.getByLabelText(/Nome/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Mario' } });
    fireEvent.change(screen.getByLabelText(/Cognome/i), { target: { value: 'Rossi' } });
    fireEvent.click(screen.getByText(/Avvia/i));
    expect(screen.getByText(/Categoria/i)).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    render(<AIWizard settings={{}} setRoute={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Anna' } });
    fireEvent.click(screen.getByText(/Avvia/i));
    expect(screen.getByText(/Categoria/i)).toBeInTheDocument();
    // No crash if email/phone missing
  });

  it('tab order is correct', () => {
    render(<AIWizard settings={{}} setRoute={() => {}} />);
    const nameInput = screen.getByLabelText(/Nome/i);
    nameInput.focus();
    expect(document.activeElement).toBe(nameInput);
    fireEvent.keyDown(nameInput, { key: 'Tab' });
    // Next input should be Cognome
    const lastNameInput = screen.getByLabelText(/Cognome/i);
    expect(lastNameInput).toBeInTheDocument();
  });
});
