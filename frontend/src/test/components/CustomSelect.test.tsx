import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomSelect from '../../components/CustomSelect';

const options = [
  { value: '', label: '-- Seleccionar --' },
  { value: 'España', label: 'España' },
  { value: 'Italia', label: 'Italia' },
];

describe('CustomSelect', () => {
  it('uses the label prop as accessible name', () => {
    render(
      <CustomSelect
        value=""
        options={options}
        onChange={() => {}}
        label="Grupo A, 1º clasificado"
        placeholder="-- Seleccionar --"
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Grupo A, 1º clasificado' })).toBeInTheDocument();
  });

  it('opens a listbox and picks an option with the arrow keys and Enter', () => {
    const onChange = vi.fn();
    render(<CustomSelect value="" options={options} onChange={onChange} label="Grupo A" />);
    const combo = screen.getByRole('combobox');

    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(combo).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);

    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'ArrowUp' });
    expect(combo.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /España/ }).id,
    );

    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('España');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes with Escape without choosing', () => {
    const onChange = vi.fn();
    render(<CustomSelect value="Italia" options={options} onChange={onChange} label="Grupo A" />);
    const combo = screen.getByRole('combobox');
    fireEvent.click(combo);
    expect(screen.getByRole('option', { name: /Italia/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(combo, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
