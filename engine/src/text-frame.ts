// SPDX-License-Identifier: MPL-2.0
/** Bounded text frame admission, separate from the story's immutable source. */
import { Ajv, type ValidateFunction } from 'ajv';
import type { TextFrameV1 } from '@lolly-tools/core';
import schema from '../../schemas/text-frame-v1.schema.json' with { type: 'json' };
import { TextSourceError } from './text-source.ts';
import { emojiTextPath } from './emoji-text-path.ts';
import { parseSvgPath } from './svg-path.ts';
import { svgPath } from './emoji-svg-syntax.ts';
let validator: ValidateFunction<TextFrameV1> | undefined;
function schemaValidator(): ValidateFunction<TextFrameV1> {
  if (!validator) validator = new Ajv({ strict:true, ownProperties:true }).compile<TextFrameV1>(schema);
  return validator;
}
export function textFrameKey(frame: TextFrameV1): string {
  const { inset,columns,path,grid } = frame;
  return JSON.stringify([frame.id,frame.storyId,frame.width,frame.height,frame.mode,[inset.top,inset.right,inset.bottom,inset.left],
    [columns.count,columns.gutter,columns.balance],frame.verticalAlign,frame.firstBaseline,grid && [grid.step,grid.offset],frame.honorWrap,
    frame.hidden ?? false,frame.locked ?? false,frame.shrink?.minSize,path && [path.d,path.start,path.end,path.baseline,path.flip,path.reverse,path.fit,path.guide]]);
}
export function parseTextFrame(value: unknown): TextFrameV1 {
  const validate = schemaValidator();
  if (!validate(value)) throw new TextSourceError('frame-schema', `Invalid text frame at ${validate.errors?.[0]?.instancePath || '/'}: ${validate.errors?.[0]?.message ?? 'schema mismatch'}`);
  if (value.mode === 'path' && !value.path || value.mode !== 'path' && value.path) throw new TextSourceError('frame-path', 'Path settings must belong to a path text frame.');
  if(value.path) {
    svgPath(value.path.d);
    const length=emojiTextPath(value.path.d).length,closed=!!parseSvgPath(value.path.d)[0]?.closed;
    if(value.path.start>=length || value.path.end>(closed?value.path.start+length:length)+.001)throw new TextSourceError('path-interval','Choose an interval within the guide, with at most one traversal of a closed path.');
    if(value.path.end <= value.path.start) throw new TextSourceError('frame-path', 'The path interval must end after it starts.');
  }
  if(value.inset.left+value.inset.right+(value.columns.count-1)*value.columns.gutter >= value.width || value.inset.top+value.inset.bottom >= value.height)
    throw new TextSourceError('frame-inset', 'Insets and gutters must leave room for text.');
  return structuredClone(value);
}
