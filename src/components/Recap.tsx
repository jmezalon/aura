import type { AppState } from '../types';
import { THEMES } from '../data';
import { levelFor, streak, totalAura, weekStats } from '../store';
import { Icon, loadIconImage, type IconName } from '../icons';

interface Props {
  state: AppState;
  toast: (msg: string) => void;
}

function fmtDay(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
  });
}

/** Hand-paint the recap as a 1080x1920 story-sized PNG. Returns a blob. */
async function paintCard(state: AppState): Promise<Blob> {
  // Canvas doesn't wait for web fonts the way the DOM does — if we draw before
  // Space Grotesk / Inter have loaded, the text bakes in as a fallback serif.
  // Make sure the exact faces we use are ready first.
  if (document.fonts?.ready) {
    try {
      await Promise.all([
        document.fonts.load("700 220px 'Space Grotesk'"),
        document.fonts.load("600 64px 'Space Grotesk'"),
        document.fonts.load("500 42px 'Inter'"),
        document.fonts.load("600 40px 'Inter'"),
      ]);
      await document.fonts.ready;
    } catch {
      // best-effort — fall through and draw with whatever's available
    }
  }

  const theme = THEMES.find((t) => t.id === state.theme) ?? THEMES[0];
  const v = theme.vars;
  const week = weekStats(state.log, state.habits);
  const aura = totalAura(state.log, state.habits);
  const { level } = levelFor(aura);
  const currentStreak = streak(state.log);

  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, v['--bg2']);
  bg.addColorStop(1, v['--bg']);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // glow blobs
  const blob = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  };
  // a barely-there wash of the accent — calm, not glowy
  blob(W * 0.9, H * 0.08, 520, v['--a1'], 0.1);
  blob(W * 0.05, H * 0.9, 560, v['--a1'], 0.07);

  const display = (size: number, weight = 700) =>
    `${weight} ${size}px 'Space Grotesk', sans-serif`;
  const body = (size: number, weight = 500) =>
    `${weight} ${size}px 'Inter', sans-serif`;

  // header
  ctx.fillStyle = v['--muted'];
  ctx.font = body(38, 600);
  ctx.fillText('MY  WEEK  IN  AURA', 90, 200);

  // big number
  ctx.fillStyle = v['--a1'];
  ctx.font = display(220);
  ctx.fillText(`+${week.aura.toLocaleString()}`, 80, 460);

  // subtitle + sparkle
  ctx.fillStyle = v['--text'];
  ctx.font = display(64, 600);
  const subtitle = 'aura farmed this week';
  ctx.fillText(subtitle, 90, 570);
  const subW = ctx.measureText(subtitle).width;
  const sparkImg = await loadIconImage('sparkles', { color: v['--a1'], size: 56 });
  ctx.drawImage(sparkImg, 90 + subW + 18, 570 - 64 * 0.35 - 28, 56, 56);

  // stat rows
  const rows: Array<{ k: string; v: string; icon?: IconName }> = [
    { k: 'level', v: level.name, icon: level.icon },
    { k: 'streak', v: `${currentStreak} days`, icon: 'flame' },
    { k: 'quests completed', v: String(week.completions) },
    { k: 'perfect days', v: String(week.perfectDays) },
    { k: 'best day', v: week.bestDay ? `${fmtDay(week.bestDay.key)} (+${week.bestDay.points})` : '—' },
    { k: 'top quest', v: week.topHabit ? week.topHabit.habit.name : '—', icon: week.topHabit?.habit.icon },
  ];

  // preload every row icon (in parallel) so the draw loop can stay synchronous
  const ICON_SIZE = 46;
  const iconImgs = new Map<IconName, HTMLImageElement>();
  await Promise.all(
    [...new Set(rows.map((r) => r.icon).filter((n): n is IconName => !!n))].map(
      async (n) => iconImgs.set(n, await loadIconImage(n, { color: v['--a1'], size: ICON_SIZE })),
    ),
  );

  let y = 760;
  for (const row of rows) {
    ctx.fillStyle = v['--muted'];
    ctx.font = body(42);
    ctx.fillText(row.k, 90, y);

    ctx.font = display(46, 600);
    const textW = ctx.measureText(row.v).width;
    const img = row.icon ? iconImgs.get(row.icon) : undefined;
    const gap = 14;
    const totalW = (img ? ICON_SIZE + gap : 0) + textW;
    let vx = W - 90 - totalW;
    if (img) {
      ctx.drawImage(img, vx, y - 46 * 0.35 - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE);
      vx += ICON_SIZE + gap;
    }
    ctx.fillStyle = v['--text'];
    ctx.fillText(row.v, vx, y);

    // divider
    ctx.strokeStyle = v['--line'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, y + 46);
    ctx.lineTo(W - 90, y + 46);
    ctx.stroke();
    y += 130;
  }

  // footer
  ctx.fillStyle = v['--text'];
  ctx.font = display(52, 600);
  ctx.fillText(`@${state.name}`, 90, H - 160);
  if (!state.pro) {
    ctx.fillStyle = v['--muted'];
    ctx.font = body(40, 600);
    const tag = 'made with aura';
    const tagW = ctx.measureText(tag).width;
    const gemSize = 42;
    const gemImg = await loadIconImage('gem', { color: v['--muted'], size: gemSize });
    const totalTag = tagW + 10 + gemSize;
    const fx = W - 90 - totalTag;
    ctx.fillText(tag, fx, H - 160);
    ctx.drawImage(gemImg, fx + tagW + 10, H - 160 - 40 * 0.35 - gemSize / 2, gemSize, gemSize);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('could not render recap'));
    }, 'image/png');
  });
}

/**
 * Share the recap. On mobile this opens the native share sheet (so it can go
 * straight to a story); everywhere else it downloads the PNG. Uses an object
 * URL rather than a multi-MB data: URL, which mobile Safari refuses to download.
 */
async function shareCard(state: AppState): Promise<'shared' | 'saved'> {
  const blob = await paintCard(state);
  const file = new File([blob], 'my-aura-recap.png', { type: 'image/png' });

  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: 'my week in aura',
        text: 'my week in aura ✨',
      });
      return 'shared';
    } catch (err) {
      // user hit cancel on the share sheet — don't fall through to a download
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'shared';
      }
      // otherwise fall back to saving the file
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = 'my-aura-recap.png';
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'saved';
}

export function Recap({ state, toast }: Props) {
  const week = weekStats(state.log, state.habits);
  const aura = totalAura(state.log, state.habits);
  const { level } = levelFor(aura);
  const currentStreak = streak(state.log);

  const share = async () => {
    try {
      const how = await shareCard(state);
      toast(how === 'shared' ? 'shared — post it' : 'recap saved — post it');
    } catch {
      toast("couldn't make your recap — try again");
    }
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>weekly recap</h1>
      <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
        your week, wrapped. flex it on your story.
      </p>

      <div className="recap-layout">
      <div className="recap-card">
        <div className="rc-label">my week in aura</div>
        <div className="rc-aura grad-text">+{week.aura.toLocaleString()}</div>
        <div className="rc-sub" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          aura farmed this week
          <Icon name="sparkles" size={16} color="var(--a1)" />
        </div>
        <div className="rc-rows">
          <div className="rc-row">
            <span className="k">level</span>
            <span className="v"><Icon name={level.icon} size={16} /> {level.name}</span>
          </div>
          <div className="rc-row">
            <span className="k">streak</span>
            <span className="v"><Icon name="flame" size={16} /> {currentStreak} days</span>
          </div>
          <div className="rc-row">
            <span className="k">quests completed</span>
            <span className="v">{week.completions}</span>
          </div>
          <div className="rc-row">
            <span className="k">perfect days</span>
            <span className="v">{week.perfectDays}</span>
          </div>
          <div className="rc-row">
            <span className="k">best day</span>
            <span className="v">
              {week.bestDay ? `${fmtDay(week.bestDay.key)} (+${week.bestDay.points})` : '—'}
            </span>
          </div>
          <div className="rc-row">
            <span className="k">top quest</span>
            <span className="v">
              {week.topHabit ? (
                <>
                  <Icon name={week.topHabit.habit.icon} size={16} />
                  {week.topHabit.habit.name}
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
        </div>
        <div className="rc-foot">
          <span>@{state.name}</span>
          <span>made with aura <Icon name="gem" size={13} /></span>
        </div>
      </div>

      <div className="recap-actions">
        <button className="btn" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={share}>
          download share card
          <Icon name="camera" size={17} />
        </button>
      </div>
      </div>
    </div>
  );
}
