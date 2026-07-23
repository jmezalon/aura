import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';
import {
  Sprout,
  Moon,
  PhoneOff,
  Droplet,
  Footprints,
  BookOpen,
  NotebookPen,
  SprayCan,
  Salad,
  PhoneCall,
  PiggyBank,
  Flower2,
  Sparkles,
  Flame,
  Dumbbell,
  Target,
  Palette,
  Headphones,
  Brain,
  ShowerHead,
  Dog,
  Meh,
  User,
  Map as MapIcon,
  Clapperboard,
  Star,
  Wheat,
  Crown,
  Infinity as InfinityIcon,
  Zap,
  ChartColumn,
  Camera,
  Gem,
  Lock,
  Hand,
  Heart,
  Image as ImageIcon,
  Leaf,
  Check,
  Pencil,
  Trash2,
  GripVertical,
  MessageCircle,
  Send,
  Plus,
  RefreshCw,
  Sparkle,
  Eye,
  X,
} from 'lucide-react';

/**
 * Central icon registry. Every icon the app renders — as a React component
 * (habit rows, nav, buttons) and rasterised onto the recap canvas — resolves
 * through this one map, so there's a single source of truth for the name→glyph
 * mapping and the two render paths can't drift apart.
 */
export const ICONS = {
  // preset & picker habit icons
  sprout: Sprout,
  moon: Moon,
  'phone-off': PhoneOff,
  droplet: Droplet,
  footprints: Footprints,
  'book-open': BookOpen,
  'notebook-pen': NotebookPen,
  'spray-can': SprayCan,
  salad: Salad,
  'phone-call': PhoneCall,
  'piggy-bank': PiggyBank,
  'flower-2': Flower2,
  sparkles: Sparkles,
  flame: Flame,
  dumbbell: Dumbbell,
  target: Target,
  palette: Palette,
  headphones: Headphones,
  brain: Brain,
  'shower-head': ShowerHead,
  dog: Dog,
  // level icons
  meh: Meh,
  user: User,
  map: MapIcon,
  clapperboard: Clapperboard,
  star: Star,
  wheat: Wheat,
  crown: Crown,
  infinity: InfinityIcon,
  // ui / chrome
  zap: Zap,
  'chart-column': ChartColumn,
  camera: Camera,
  gem: Gem,
  lock: Lock,
  hand: Hand,
  heart: Heart,
  image: ImageIcon,
  leaf: Leaf,
  check: Check,
  pencil: Pencil,
  'trash-2': Trash2,
  'grip-vertical': GripVertical,
  'message-circle': MessageCircle,
  send: Send,
  plus: Plus,
  'refresh-cw': RefreshCw,
  sparkle: Sparkle,
  eye: Eye,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function isIconName(v: unknown): v is IconName {
  return typeof v === 'string' && v in ICONS;
}

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean;
}

/** Render a registry icon as an inline SVG. Defaults inherit the text color. */
export function Icon({ name, size = 22, strokeWidth = 2.25, ...rest }: IconProps) {
  const Cmp = ICONS[name];
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      aria-hidden
      {...rest}
    />
  );
}

/**
 * Rasterise a registry icon for the <canvas> recap card. We render the same
 * lucide component to an SVG string and load it as an image — the DOM and the
 * canvas therefore draw pixel-identical glyphs.
 */
export function loadIconImage(
  name: IconName,
  { color, size = 64, strokeWidth = 2 }: { color: string; size?: number; strokeWidth?: number },
): Promise<HTMLImageElement> {
  const Cmp = ICONS[name];
  // Render at the exact pixel size we'll draw at, with a size-relative stroke,
  // so the glyph stays crisp on the canvas.
  const markup = renderToStaticMarkup(
    createElement(Cmp, { size, color, strokeWidth }),
  );
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load icon ${name}`));
    img.src = url;
  });
}
