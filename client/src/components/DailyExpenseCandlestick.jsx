import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Stock-style candlestick for daily expense: open/close track day-over-day
 * optimized total; high/low also include actual spend that day (current total).
 */
export default function DailyExpenseCandlestick({
  data,
  chartColors,
  formatDateLabel,
}) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(400);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth || 400);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 260;
  const margin = { top: 10, right: 10, bottom: 30, left: 46 };
  const innerW = Math.max(1, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const { minY, maxY, points } = useMemo(() => {
    if (!data?.length) {
      return { minY: 0, maxY: 1, points: [] };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
      min = Math.min(min, d.low, d.high, d.open, d.close);
      max = Math.max(max, d.low, d.high, d.open, d.close);
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    if (min === max) {
      min = Math.max(0, min - 1);
      max += 1;
    }
    const pad = (max - min) * 0.08 || 8;
    const y0 = Math.max(0, min - pad);
    const y1 = max + pad;
    const n = data.length;
    const band = innerW / n;
    const candleW = Math.max(3, Math.min(14, band * 0.55));

    const scaleY = (v) => margin.top + innerH - ((v - y0) / (y1 - y0)) * innerH;

    const pts = data.map((d, i) => {
      const cx = margin.left + i * band + band / 2;
      const yHigh = scaleY(d.high);
      const yLow = scaleY(d.low);
      const yOpen = scaleY(d.open);
      const yClose = scaleY(d.close);
      const top = Math.min(yOpen, yClose);
      const bot = Math.max(yOpen, yClose);
      const bullish = d.close >= d.open;
      return {
        ...d,
        cx,
        candleW,
        yHigh,
        yLow,
        yOpen,
        yClose,
        bodyTop: top,
        bodyH: Math.max(bot - top, 1),
        bullish,
      };
    });

    return { minY: y0, maxY: y1, points: pts };
  }, [data, innerH, innerW, margin.left, margin.top]);

  const [hover, setHover] = useState(null);

  const yTicks = useMemo(() => {
    const ticks = 5;
    const out = [];
    for (let i = 0; i <= ticks; i += 1) {
      const t = minY + ((maxY - minY) * i) / ticks;
      out.push(t);
    }
    return out;
  }, [minY, maxY]);

  const scaleY = useCallback(
    (v) => margin.top + innerH - ((v - minY) / (maxY - minY)) * innerH,
    [innerH, margin.top, minY, maxY]
  );

  const xTickStep = data.length > 20 ? Math.ceil(data.length / 10) : 1;

  if (!data?.length) return null;

  return (
    <div ref={wrapRef} className="daily-candlestick-wrap">
      <svg
        width={width}
        height={height}
        className="daily-candlestick-svg"
        role="img"
        aria-label="Daily expense candlestick chart"
      >
        {yTicks.map((t, ti) => {
          const y = scaleY(t);
          return (
            <g key={`yt-${ti}`}>
              <line
                x1={margin.left}
                x2={margin.left + innerW}
                y1={y}
                y2={y}
                stroke={chartColors.grid}
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <text
                x={margin.left - 8}
                y={y + 4}
                textAnchor="end"
                fill={chartColors.text}
                fontSize={10}
              >
                ₹{Math.round(t)}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const active = hover === i;
          const fill = p.bullish ? chartColors.accent : "transparent";
          const stroke = p.bullish ? chartColors.accent : "var(--error)";
          return (
            <g
              key={p.dateKey}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <line
                x1={p.cx}
                x2={p.cx}
                y1={p.yHigh}
                y2={p.yLow}
                stroke={active ? chartColors.textHeading : stroke}
                strokeWidth={active ? 2 : 1.25}
              />
              <rect
                x={p.cx - p.candleW / 2}
                y={p.bodyTop}
                width={p.candleW}
                height={p.bodyH}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
                rx={1}
              />
            </g>
          );
        })}
        {data.map((d, i) => {
          if (i % xTickStep !== 0 && i !== data.length - 1) return null;
          const cx = points[i]?.cx ?? margin.left;
          return (
            <text
              key={`x-${d.dateKey}`}
              x={cx}
              y={height - 8}
              textAnchor="middle"
              fill={chartColors.text}
              fontSize={10}
            >
              {d.day}
            </text>
          );
        })}
      </svg>
      {hover != null && points[hover] && (
        <div
          className="daily-candlestick-tooltip"
          style={{
            borderColor: chartColors.border,
            color: "var(--text-h)",
            background: "var(--bg-elevated)",
          }}
        >
          <div className="daily-candlestick-tooltip-date">
            {formatDateLabel(points[hover].dateKey)}
          </div>
          <div className="small muted">
            Open ₹{Math.round(points[hover].open)} · High ₹
            {Math.round(points[hover].high)} · Low ₹
            {Math.round(points[hover].low)} · Close ₹
            {Math.round(points[hover].close)}
          </div>
          <div className="small muted">
            Actual (orders) ₹{Math.round(points[hover].currentTotal)} · Orders{" "}
            {points[hover].orders}
          </div>
        </div>
      )}
    </div>
  );
}
