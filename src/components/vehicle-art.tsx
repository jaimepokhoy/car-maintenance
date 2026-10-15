import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * A soft wash of colour rising from one edge of a card, like headlights on
 * wet asphalt. Absolutely positioned behind the card's content. `from`
 * anchors it at the bottom (vehicle cards) or the top (the vehicle hero).
 */
export function CardGlow({ color, from = 'bottom' }: { color?: string; from?: 'bottom' | 'top' }) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => setSize(event.nativeEvent.layout);
  const { width, height } = size;
  const id = `glow-${from}`;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none" aria-hidden>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            {/* Measured in points so the ellipse is exactly 120% wide and 70% tall, gone by 60% of its radius. */}
            <RadialGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              cx={width / 2}
              cy={from === 'bottom' ? height : 0}
              rx={width * 1.2}
              ry={height * 0.7}>
              <Stop offset={0} stopColor={color ?? theme.accent} stopOpacity={theme.glow} />
              <Stop offset={0.6} stopColor={color ?? theme.accent} stopOpacity={0} />
              <Stop offset={1} stopColor={color ?? theme.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}

/** A line silhouette of a car, the placeholder until vehicles have photos. */
export function CarSilhouette({ width = 190 }: { width?: number }) {
  const theme = useTheme();
  const height = (width * 80) / 190;
  return (
    <View style={styles.center} aria-hidden>
      <Svg width={width} height={height} viewBox="0 0 190 80" fill="none">
        <Path
          d="M14 58h162M24 58c0-8 4-14 12-16l22-4 20-18c4-3 8-4 13-4h34c6 0 10 2 14 6l16 16 22 4c6 1 10 6 10 12v4"
          stroke={theme.textFaint}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={52} cy={60} r={12} stroke={theme.textFaint} strokeWidth={2} />
        <Circle cx={140} cy={60} r={12} stroke={theme.textFaint} strokeWidth={2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 96,
  },
});
