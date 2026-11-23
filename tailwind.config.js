/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'tavern-dark': '#1A1410',
        'board-wood': '#2A211B',
        'row-leather': '#362920',
        'parchment': '#E6D5B8',
        'bronze': '#6E5536',
        'gold': '#D97706',
        'gold-bright': '#FDE047',
        'strength-normal': '#FFFFFF',
        'strength-buff': '#4ADE80',
        'strength-nerf': '#F87171',
        'gem-ruby': '#DC2626',
        'gem-ash': '#44403C',
        'northern': '#1D4ED8',
        'nilfgaard': '#18181B',
        'monsters': '#991B1B',
        'scoiatael': '#15803D',
        'neutral': '#57534E',
        'weather-frost': '#38BDF8',
        'weather-fog': '#94A3B8',
        'weather-rain': '#60A5FA',
        'scorch': '#EA580C',
      },
    },
  },
  plugins: [],
};
