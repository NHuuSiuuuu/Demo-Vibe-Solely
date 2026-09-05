import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

describe('App', () => {
  it('renders the base shoe store shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Shoe Store' })).toBeTruthy();
    expect(screen.getByText('Local shoe store MVP is running.')).toBeTruthy();
  });
});
