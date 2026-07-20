import type { Habit, Level, ThemeId } from './types';

export const PRESET_HABITS: Habit[] = [
  { id: 'p1', name: 'Touch grass', icon: 'sprout', points: 15 },
  { id: 'p2', name: '8 hrs of sleep', icon: 'moon', points: 20 },
  { id: 'p3', name: 'No doomscrolling', icon: 'phone-off', points: 25 },
  { id: 'p4', name: 'Drink water', icon: 'droplet', points: 10 },
  { id: 'p5', name: 'Move your body', icon: 'footprints', points: 20 },
  { id: 'p6', name: 'Read 10 pages', icon: 'book-open', points: 15 },
  { id: 'p7', name: 'Journal', icon: 'notebook-pen', points: 15 },
  { id: 'p8', name: 'Skincare', icon: 'spray-can', points: 10 },
  { id: 'p9', name: 'Eat something green', icon: 'salad', points: 10 },
  { id: 'p10', name: 'Call someone you love', icon: 'phone-call', points: 15 },
  { id: 'p11', name: 'Save $5', icon: 'piggy-bank', points: 20 },
  { id: 'p12', name: 'Meditate 5 min', icon: 'flower-2', points: 15 },
];

export const LEVELS: Level[] = [
  { name: 'NPC', icon: 'meh', min: 0 },
  { name: 'Background Character', icon: 'user', min: 100 },
  { name: 'Side Quest', icon: 'map', min: 300 },
  { name: 'Plot Relevant', icon: 'clapperboard', min: 700 },
  { name: 'Main Character', icon: 'star', min: 1500 },
  { name: 'Aura Farmer', icon: 'wheat', min: 3000 },
  { name: 'Certified Icon', icon: 'crown', min: 6000 },
  { name: 'Limitless', icon: 'infinity', min: 12000 },
];

export interface Theme {
  id: ThemeId;
  name: string;
  pro: boolean;
  /** opt this theme back into the vibrant gradient treatment (default: flat) */
  gradient?: boolean;
  /** [bg, card, accent1, accent2, text] */
  vars: Record<string, string>;
}

// A calm, human palette family — warm off-white paper, soft "ink" text, and a
// single muted earthy accent per theme. No neon, no vibrant gradients.
export const THEMES: Theme[] = [
  {
    id: 'midnight',
    name: 'Slate Blue',
    pro: false,
    vars: {
      '--bg': '#F2F1EC',
      '--bg2': '#FBFAF6',
      '--card': '#FFFFFF',
      '--card2': '#F4F3ED',
      '--line': '#E4E3DC',
      '--text': '#2C2F36',
      '--muted': '#7C828C',
      '--a1': '#5B7A99',
      '--a2': '#4E6B87',
      '--a3': '#6E93B0',
    },
  },
  {
    id: 'sunset',
    name: 'Clay',
    pro: false,
    vars: {
      '--bg': '#F6F1EA',
      '--bg2': '#FCF8F1',
      '--card': '#FFFFFF',
      '--card2': '#F7F1E9',
      '--line': '#EAE1D3',
      '--text': '#2E2823',
      '--muted': '#8A8072',
      '--a1': '#C56A4E',
      '--a2': '#B25A40',
      '--a3': '#D89B6A',
    },
  },
  {
    id: 'matcha',
    name: 'Sage',
    pro: true,
    vars: {
      '--bg': '#F1EFE6',
      '--bg2': '#FAF9F1',
      '--card': '#FBFAF4',
      '--card2': '#EEEDE2',
      '--line': '#E1E0D2',
      '--text': '#33352E',
      '--muted': '#83887A',
      '--a1': '#6F8562',
      '--a2': '#5E7452',
      '--a3': '#A9B58F',
    },
  },
  {
    id: 'cherry',
    name: 'Dusty Rose',
    pro: true,
    vars: {
      '--bg': '#F6EFEE',
      '--bg2': '#FCF6F5',
      '--card': '#FFFFFF',
      '--card2': '#F6EEED',
      '--line': '#EADCDB',
      '--text': '#33292B',
      '--muted': '#8C7C7E',
      '--a1': '#B0687A',
      '--a2': '#9C5566',
      '--a3': '#CF9AA4',
    },
  },
  {
    id: 'vapor',
    name: 'Stone',
    pro: true,
    vars: {
      '--bg': '#F0F1F0',
      '--bg2': '#FAFAF9',
      '--card': '#FBFBFA',
      '--card2': '#EBEDEC',
      '--line': '#DEE0DE',
      '--text': '#2D3033',
      '--muted': '#7E8488',
      '--a1': '#6E8386',
      '--a2': '#5C7275',
      '--a3': '#93A6A3',
    },
  },
  // The original dark-neon look — brought back by popular demand as a pro theme.
  // `gradient: true` re-enables the vibrant gradient treatment for this theme only.
  {
    id: 'neon',
    name: 'Midnight',
    pro: true,
    gradient: true,
    vars: {
      '--bg': '#0b0b13',
      '--bg2': '#13131f',
      '--card': '#191926',
      '--card2': '#20202f',
      '--line': '#2b2b3d',
      '--text': '#f2f1f7',
      '--muted': '#8a89a3',
      '--a1': '#a78bfa',
      '--a2': '#f472b6',
      '--a3': '#38e0c8',
    },
  },
];

/** Free plan cap — Aura+ unlocks unlimited habits */
export const FREE_HABIT_LIMIT = 5;

export const PRO_PRICE = '$2.49/mo';
