import { useMemo, useState, type ReactElement } from 'react';
import type { ChatGPTAuthProviderProps } from './ChatGPTAuthProvider.types.js';
import {
  assertProviderBinding,
  supportedProviderProps,
  readStylesheet,
} from './ChatGPTAuthProvider.utils.js';
import ProviderContext from './context.cjs';
import { useCommittedLayoutEffect } from '../../hooks/useCommittedLayoutEffect.js';
import { ProviderController } from './ProviderController.js';
import { warnUnsupportedProps } from '../../utils/warnUnsupportedProps.js';
import { useProfileSession } from '../../hooks/useProfileSession.js';

/** Shares one interaction attempt between descendant buttons. */
export function ChatGPTAuthProvider(props: ChatGPTAuthProviderProps): ReactElement {
  assertProviderBinding(props);
  warnUnsupportedProps(props, supportedProviderProps, 'ChatGPTAuthProvider');
  const stylesheet = readStylesheet(props);
  const [providerController] = useState(() => new ProviderController());
  const binding = useMemo(
    () => ({ client: props.client, options: props.options }),
    [props.client, props.options],
  );
  const profile = useProfileSession(binding, providerController);
  // Rendering a new configuration never mutates the active controller. A button's
  // committed event handler carries this value even before ancestor layout effects run.
  const context = useMemo(
    () => Object.freeze({ controller: providerController, binding, profile, stylesheet }),
    [providerController, binding, profile, stylesheet],
  );

  // Commit configuration changes before activating a client. Updating configuration
  // does not replace the current attempt. The core captures it when the next attempt starts.
  useCommittedLayoutEffect(() => {
    providerController.update(binding);
  }, [providerController, binding]);

  useCommittedLayoutEffect(() => providerController.activate(), [providerController]);

  return <ProviderContext.Provider value={context}>{props.children}</ProviderContext.Provider>;
}
