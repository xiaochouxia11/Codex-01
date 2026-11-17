/** Partner styles can place the button without changing its branding or interaction. */
export const buttonLayoutProperties = [
  'width',
  'minWidth',
  'maxWidth',
  'inlineSize',
  'minInlineSize',
  'maxInlineSize',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginBlock',
  'marginBlockStart',
  'marginBlockEnd',
  'marginInline',
  'marginInlineStart',
  'marginInlineEnd',
  'alignSelf',
  'justifySelf',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'order',
  'verticalAlign',
] as const;

export type ButtonLayoutProperty = (typeof buttonLayoutProperties)[number];
const allowedProperties = new Set<string>(buttonLayoutProperties);

/** Both renderers validate the same allowlist before mutation. Errors never echo CSS input. */
export function snapshotButtonStyle(
  value: unknown,
): Readonly<Record<string, string | number | undefined>> | undefined {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw null;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) {
    throw null;
  }
  const entries: [string, string | number | undefined][] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowedProperties.has(key)) {
      throw null;
    }
    const entry: unknown = Reflect.get(value, key);
    if (
      entry !== undefined &&
      typeof entry !== 'string' &&
      !(typeof entry === 'number' && Number.isFinite(entry))
    ) {
      throw null;
    }
    entries.push([key, entry]);
  }
  return Object.freeze(Object.fromEntries(entries));
}
