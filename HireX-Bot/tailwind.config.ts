import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAFA',
        surface: '#FFFFFF',
        subtle: '#F4F4F5',
        obsidian: '#0A0A0B',
        hairline: '#E4E4E7',
        focus: '#18181B',
        ink: {
          primary: '#0A0A0B',
          secondary: '#52525B',
          muted: '#71717A',
        },
      },
      borderRadius: {
        pill: '9999px',
        stage: '28px',
        bento: '20px',
        compact: '14px',
      },
      fontFamily: {
        display: ["'Google Sans Flex'", 'Arial', 'Helvetica', 'sans-serif'],
        sans: ["'Raleway'", '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
      boxShadow: {
        navbar:
          '0 10px 30px -5px rgba(10, 10, 11, 0.05), 0 1px 3px rgba(10, 10, 11, 0.03)',
        card: '0 2px 10px rgba(10, 10, 11, 0.02)',
      },
    },
  },
  plugins: [],
};

export default config;
