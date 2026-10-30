// SPDX-License-Identifier: MPL-2.0
/**
 * The retained 3D scene contract: the operations a surface that shows a studio scene
 * relies on. StudioRenderer (renderer.ts) implements it for the web shell; Design's scene
 * block (plan 224) and other surfaces are meant to consume this type rather than the class.
 *
 * It names no renderer, DOM or three.js type. The drawing surface, the camera and the
 * point type are parameters, so a host with another backend can implement the same
 * contract. The lifecycle state lives with whoever mounts the host (mount.ts keeps it on
 * the marker as `data-studio-state`), because loading, cancelling and failing belong to
 * a mount, not to the renderer.
 *
 * It stays in the web shell until plan 224 consumes it; it is not part of the tool SDK.
 */
import type {
  StudioSceneV1,
  StudioSourceInfo,
  StudioVector3,
} from '../../../../../packages/core/src/studio3d-v1.ts';

/** Sample profile of one frame: live previews, still exports, or clip frames. */
export type StudioSceneQuality = 'preview' | 'export' | 'clip';

/** A mounted scene's lifecycle, as the marker's `data-studio-state` reports it. */
export type StudioSceneState = 'loading' | 'ready' | 'error' | 'cancelled';

/** Reads the bytes a source, backdrop or environment names. Same shape as source.ts's StudioRead. */
export type StudioSceneRead = (url: string, signal: AbortSignal) => Promise<Uint8Array>;

/**
 * Outlines one line of words at `fontSize` px: an SVG path with the baseline at y=0, plus its
 * advance. Same shape as source.ts's StudioShaper.
 */
export type StudioSceneShaper = (
  line: string,
  font: NonNullable<StudioSceneV1['source']['text']>,
  fontSize: number,
  signal: AbortSignal
) => Promise<{ d: string; advance: number }>;

/** Work a host has done since it was created, and the GPU resources it holds now. */
export interface StudioSceneCounters {
  /** update() calls. */
  updates: number;
  /** Sources read and prepared (geometry built from bytes, words or a primitive). */
  sourceLoads: number;
  /** Source loads that were abandoned or refused, so they built nothing. */
  sourceAborts: number;
  /** Material assignments, one per placed object, on an instantiation or a materials edit. */
  materialSets: number;
  /** Objects instantiated from a loaded source. */
  instances: number;
  /** Stage rebuilds: floor, backplate, pedestal and depth forms. */
  stageBuilds: number;
  /** Light rig rebuilds: the lights, their shadows and the hemisphere fill. */
  rigBuilds: number;
  /** Backdrop texture builds. */
  backdropBuilds: number;
  /** Environment map builds. */
  environmentBuilds: number;
  /** Frames drawn; a frame answered from the frame cache is not counted. */
  frames: number;
  /** capture() calls. */
  captures: number;
  /** GPU resources held now. */
  memory: { geometries: number; textures: number };
}

export interface StudioSceneHost<Surface, Camera, Point> {
  /** The surface every frame is drawn on. */
  readonly canvas: Surface;
  /**
   * Load what the recipe names and swap it in. A newer update cancels an older one; a
   * frozen host holds the swap until it is thawed. Only what the edit changed is rebuilt:
   * a camera or light edit re-instantiates nothing and applies no material.
   *
   * `retain` names loaded-source keys that survive this update even though it does not
   * place them, so a caller rendering a set through one host keeps the whole set's
   * sources. The keys come from the host's own `studioAssetKeys`.
   *
   * `pixels` is the long side of the output these sources are being built for. A recipe
   * whose shape detail follows the output reads its curves against it, so a preview and a
   * larger export are different sources; a recipe with a fixed curve count ignores it.
   */
  update: (
    recipe: StudioSceneV1,
    read: StudioSceneRead,
    shaper?: StudioSceneShaper,
    opts?: { retain?: string[]; pixels?: number }
  ) => Promise<StudioSourceInfo>;
  /** Draw one frame at a pixel size. `time` is the loop position from 0 to 1. */
  render: (
    width: number,
    height: number,
    quality: StudioSceneQuality,
    time?: number,
    clipSeconds?: number
  ) => void;
  /**
   * Draw one frame for an export. With `verify`, a transparent output whose subject is in
   * frame must contain some opaque pixels, or the call throws. That refusal does not break
   * the host: the blank frame is not kept, so the next capture draws it again.
   */
  capture: (
    width: number,
    height: number,
    quality: 'export' | 'clip',
    time?: number,
    clipSeconds?: number,
    verify?: boolean
  ) => void;
  inspect: () => StudioSceneCounters;
  /**
   * Drop every loaded source the last update did not place, whatever `retain` held on to
   * while a set was rendered. A host kept warm for the next document calls this first.
   */
  trimAssets: () => void;
  /**
   * While frozen, an update in flight waits before it swaps anything in, and the
   * preview-only calls below are ignored, so a capture keeps the frame it started with.
   */
  freeze: (on: boolean) => void;
  dispose: () => void;

  // Interactive and preview-only: none of these reach an export.
  /** Preview an unsaved camera, such as an orbit in progress. */
  view: (camera: Partial<StudioSceneV1['camera']>) => void;
  /** Preview an object at a new position while it is dragged. */
  moveObject: (row: number, position: StudioVector3) => void;
  /** Preview an object at a new rotation, in degrees, while it is turned; row 0 is a lone subject. */
  turnObject: (row: number, rotation: StudioVector3) => void;
  /** Preview a light at a new position while it is dragged. */
  moveLight: (index: number, position: StudioVector3) => void;
  /** The placeable light whose handle is nearest a point in normalised device coordinates. */
  pickLight: (aspect: number, x: number, y: number) => number | null;
  /** Outline one object row in previews, or none. */
  highlight: (index: number | null) => void;
  /** Show light handles in previews, marking the selected light, or hide them. */
  showLightHandles: (state: { selected: number | null } | null) => void;
  /** The zoom and target that frame every object, or one row. */
  fit: (aspect: number, row?: number) => { zoom: number; target: Point } | null;
  /** The focus distance to the subject under a point. */
  focus: (aspect: number, x: number, y: number) => number | null;
  /** The current view camera, including an unsaved orbit. */
  camera: (aspect: number) => Camera | null;
  /** The object row under a point, with the point that was hit. */
  pick: (aspect: number, x: number, y: number) => { index: number; point: Point } | null;
}
