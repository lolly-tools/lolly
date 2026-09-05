// SPDX-License-Identifier: MPL-2.0
/**
 * A small, DOM-free description of an exportable Lolly application surface.
 *
 * Tools export their authored canvas. Application UI is different: it needs an
 * explicit sample/current-data decision and semantic component names before it
 * becomes a Penpot document. This model is the common hand-off between a shell
 * fixture and the existing, well-tested Penpot box lowering. It intentionally
 * does not attempt to model arbitrary HTML or interactive behaviour.
 */
import { boxesToPenpotDoc, type BoxesToPenpotOptions, type PenpotDoc } from './penpot-file.ts';

export type AppSurfaceDataPolicy = 'sample' | 'redacted' | 'current-consented';
export type AppSurfaceRole = 'surface' | 'control' | 'selection' | 'badge' | 'text';

export interface AppSurfaceComponent {
  /** Stable production component or pattern name, e.g. `SegmentedControl`. */
  name: string;
  /** A documented visual variant, e.g. `primary` or `compact`. */
  variant?: string;
  /** A deterministic rendered state, e.g. `selected` or `disabled`. */
  state?: string;
}

interface AppSurfaceNodeBase {
  id: string;
  name: string;
  /** Parent frame id. Omit only for a frame/pasteboard node. */
  frame?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  component?: AppSurfaceComponent;
}

export interface AppSurfaceFrame extends AppSurfaceNodeBase {
  type: 'frame';
  background: string;
  order?: number;
}

export interface AppSurfaceRect extends AppSurfaceNodeBase {
  type: 'rect';
  role: Exclude<AppSurfaceRole, 'text'>;
  background: string;
  radius?: number;
  border?: { color: string; width?: number };
}

export interface AppSurfaceText extends AppSurfaceNodeBase {
  type: 'text';
  role: 'text';
  text: string;
  color: string;
  fontSize?: number;
  weight?: number;
  font?: 'sans' | 'mono' | string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
}

export type AppSurfaceNode = AppSurfaceFrame | AppSurfaceRect | AppSurfaceText;

export interface AppSurface {
  /** Stable id suitable for telemetry/export reports, never personal data. */
  id: string;
  name: string;
  canvas: { w: number; h: number };
  background: string;
  /** A fixture is sample/redacted unless a caller explicitly records consent. */
  dataPolicy: AppSurfaceDataPolicy;
  nodes: readonly AppSurfaceNode[];
}

export interface AppSurfaceExportReport {
  surfaceId: string;
  dataPolicy: AppSurfaceDataPolicy;
  nodeCount: number;
  /** App surfaces are editable Penpot frames/shapes, not guessed Penpot v2 components. */
  componentMode: 'named-editable-frames';
  /** Token records travel in tokens.json; native per-property binding is intentionally not claimed. */
  tokenBindingMode: 'token-document';
  fallbacks: readonly string[];
}

/** The machine-readable, user-facing truth about an app surface export. */
export function appSurfaceExportReport(surface: AppSurface): AppSurfaceExportReport {
  return {
    surfaceId: surface.id,
    dataPolicy: surface.dataPolicy,
    nodeCount: surface.nodes.length,
    componentMode: 'named-editable-frames',
    tokenBindingMode: 'token-document',
    fallbacks: [],
  };
}

/** Lower semantic app nodes to the Design-box dialect consumed by the Penpot writer. */
export function appSurfaceBoxes(surface: AppSurface): Array<Record<string, unknown>> {
  return surface.nodes.map((node) => {
    const component = node.component
      ? ` [${node.component.name}${node.component.variant ? `/${node.component.variant}` : ''}${node.component.state ? `/${node.component.state}` : ''}]`
      : '';
    if (node.type === 'frame') {
      return { id: node.id, kind: 'frame', name: `${node.name}${component}`, order: node.order ?? 0, x: node.x, y: node.y, w: node.w, h: node.h, bg: node.background };
    }
    if (node.type === 'text') {
      return {
        id: node.id, kind: 'text', frame: node.frame, name: `${node.name}${component}`,
        x: node.x, y: node.y, w: node.w, h: node.h, text: node.text, fg: node.color,
        fontSize: node.fontSize ?? 14, weight: node.weight ?? 400, font: node.font ?? 'sans',
        align: node.align ?? 'left', valign: node.valign ?? 'top', lineHeight: node.lineHeight ?? 1.25,
      };
    }
    return {
      id: node.id, kind: 'box', frame: node.frame, name: `${node.name}${component}`,
      x: node.x, y: node.y, w: node.w, h: node.h, bg: node.background,
      shape: node.radius ? 'rounded' : 'rect', radius: node.radius ?? 0,
      stroke: node.border?.color, strokeW: node.border?.width ?? 0,
    };
  });
}

/** Build the same editable Penpot document Design uses, from a declared app fixture. */
export function appSurfaceToPenpotDoc(
  surface: AppSurface,
  options: Omit<BoxesToPenpotOptions, 'name' | 'canvas' | 'background'> = {},
): PenpotDoc {
  return boxesToPenpotDoc(appSurfaceBoxes(surface), {
    ...options,
    name: surface.name,
    canvas: surface.canvas,
    background: surface.background,
  });
}
