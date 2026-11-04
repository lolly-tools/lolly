// SPDX-License-Identifier: MPL-2.0
import { Text, useIsScreenReaderEnabled } from 'ink';
import type { TerminalBrand } from '../brand-theme.ts';
import { theme } from '../theme.ts';

/** Compact identity and colour samples; text remains useful without colour. */
export function BrandStrip({ brand, columns }: { brand: TerminalBrand; columns: number }) {
  const screenReader = useIsScreenReaderEnabled();
  const monochrome = process.env.NO_COLOR !== undefined || screenReader;
  return (
    <Text wrap="truncate-end">
      {!monochrome && columns >= 48
        ? brand.swatches.slice(0, columns < 80 ? 3 : 6).map((swatch) => (
            <Text key={swatch.value} color={swatch.value}>
              ██
            </Text>
          ))
        : null}
      <Text color={theme.accentName}>{` ${brand.label}`}</Text>
      {brand.choices.length ? (
        <Text color={theme.dim}>{` / ${brand.choices.join(', ')}`}</Text>
      ) : null}
    </Text>
  );
}
