import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        text: '#1E1E1E',
        subtext: '#828282',
        accent: '#00D1FF',
        surface: '#F7F8F8',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        xl: '32px',
        lg: '24px',
        md: '18px',
      },
      maxWidth: {
        bento: '980px',
      },
      minWidth: {
        bento: '860px',
      },
      boxShadow: {
        floating: '0 12px 50px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
