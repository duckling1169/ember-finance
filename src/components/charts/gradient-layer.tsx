import { CHART_COLORS } from './theme';

/**
 * Factory that creates a Nivo custom layer drawing a gradient fill under the line.
 * Each chart instance needs a unique gradient ID to avoid SVG conflicts.
 */
export function createAreaGradientLayer(gradientId: string) {
  return function AreaGradientLayer(props: Record<string, unknown>) {
    const { series, xScale, yScale, innerHeight } = props as {
      series: { data: { data: { x: Date; y: number } }[] }[];
      xScale: (v: Date) => number;
      yScale: (v: number) => number;
      innerHeight: number;
    };
    if (!series?.[0]?.data?.length) return null;
    const points = series[0].data;
    const path = points
      .map((p, i) => {
        const x = xScale(p.data.x);
        const y = yScale(p.data.y);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    const lastX = xScale(points[points.length - 1].data.x);
    const firstX = xScale(points[0].data.x);
    const areaPath = `${path} L ${lastX} ${innerHeight} L ${firstX} ${innerHeight} Z`;

    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
            <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
      </>
    );
  };
}
