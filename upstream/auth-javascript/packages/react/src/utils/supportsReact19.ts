import { version } from 'react';

/** React 19 owns stylesheet resources and recognizes the boolean inert attribute. */
export const supportsReact19 = Number.parseInt(version, 10) >= 19;
