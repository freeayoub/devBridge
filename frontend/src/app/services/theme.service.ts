import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeColor = 'blue-gray' | 'pink' | 'cyan' | 'purple';

export interface Theme {
  name: string;
  color: ThemeColor;
  isDark: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(false);
  darkMode$ = this.darkMode.asObservable();

  private currentTheme = new BehaviorSubject<Theme>({
    name: 'Bleu Gris',
    color: 'blue-gray',
    isDark: false,
  });
  currentTheme$ = this.currentTheme.asObservable();

  availableThemes: Theme[] = [
    { name: 'Bleu Gris Clair', color: 'blue-gray', isDark: false },
    { name: 'Bleu Gris Sombre', color: 'blue-gray', isDark: true },
    { name: 'Rose Clair', color: 'pink', isDark: false },
    { name: 'Rose Sombre', color: 'pink', isDark: true },
    { name: 'Cyan Clair', color: 'cyan', isDark: false },
    { name: 'Cyan Sombre', color: 'cyan', isDark: true },
    { name: 'Violet Clair', color: 'purple', isDark: false },
    { name: 'Violet Sombre', color: 'purple', isDark: true },
  ];

  constructor() {
    // Check if user has a theme preference in localStorage
    const savedTheme = localStorage.getItem('currentTheme');
    const savedDarkMode = localStorage.getItem('darkMode');

    if (savedTheme) {
      const theme = JSON.parse(savedTheme);
      this.currentTheme.next(theme);
      this.darkMode.next(theme.isDark);
      this.applyTheme(theme);
    } else if (savedDarkMode) {
      const isDark = savedDarkMode === 'true';
      const theme = {
        name: isDark ? 'Bleu Gris Sombre' : 'Bleu Gris Clair',
        color: 'blue-gray' as ThemeColor,
        isDark,
      };
      this.darkMode.next(isDark);
      this.currentTheme.next(theme);
      this.applyTheme(theme);
    } else {
      // Check if user prefers dark mode at OS level
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      const theme = {
        name: prefersDark ? 'Bleu Gris Sombre' : 'Bleu Gris Clair',
        color: 'blue-gray' as ThemeColor,
        isDark: prefersDark,
      };
      this.darkMode.next(prefersDark);
      this.currentTheme.next(theme);
      this.applyTheme(theme);
    }
  }

  toggleDarkMode(): void {
    const currentTheme = this.currentTheme.value;
    const newTheme = { ...currentTheme, isDark: !currentTheme.isDark };
    newTheme.name = newTheme.isDark
      ? newTheme.name.replace('Clair', 'Sombre')
      : newTheme.name.replace('Sombre', 'Clair');

    this.setTheme(newTheme);
  }

  setTheme(theme: Theme): void {
    this.currentTheme.next(theme);
    this.darkMode.next(theme.isDark);
    localStorage.setItem('currentTheme', JSON.stringify(theme));
    localStorage.setItem('darkMode', String(theme.isDark));
    this.applyTheme(theme);
  }

  private applyTheme(theme: Theme): void {
    // Remove all theme classes
    document.documentElement.classList.remove(
      'dark',
      'theme-blue-gray',
      'theme-pink',
      'theme-cyan',
      'theme-purple'
    );

    // Apply dark mode
    if (theme.isDark) {
      document.documentElement.classList.add('dark');
    }

    // Apply color theme
    document.documentElement.classList.add(`theme-${theme.color}`);

    console.log(`Theme applied: ${theme.name} (${theme.color})`);
  }

  getCurrentTheme(): Theme {
    return this.currentTheme.value;
  }

  isDarkMode(): boolean {
    return this.darkMode.value;
  }
}
