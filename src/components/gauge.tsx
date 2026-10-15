import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const SWEEP = 270;

/**
 * An instrument arc, open at the bottom like a speedometer. `progress` fills
 * the arc from 0 to 1 in `color`; children sit inside the dial.
 */
export function Gauge({
  progress,
  color,
  size = 270,
  stroke = 14,
  children,
}: PropsWithChildren<{ progress: number; color: string; size?: number; stroke?: number }>) {
  const theme = useTheme();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = (circumference * SWEEP) / 360;
  const filled = arc * Math.min(1, Math.max(0, progress));
  const center = size / 2;
  // Rotate so the gap sits centred at the bottom.
  const rotation = 90 + (360 - SWEEP) / 2;
  // The arc's lowest point sits 45° below the horizontal, so the box ends there, not at the circle's bottom.
  const height = Math.ceil(center + radius * Math.SQRT1_2 + stroke);

  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={size} aria-hidden style={styles.svg}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={theme.surfaceRaised}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          transform={`rotate(${rotation} ${center} ${center})`}
        />
        {filled > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(${rotation} ${center} ${center})`}
          />
        ) : null}
      </Svg>
      {/* Centred on the dial's centre, inset so text clears the arc. */}
      <View style={[styles.inner, { height: size, paddingHorizontal: stroke * 3 }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  inner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
