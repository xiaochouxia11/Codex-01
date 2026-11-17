/** Shared server/client tree: hydration must use exactly the markup emitted by the packed SDK. */
export function lifecycleTree(React, Provider, Button, Picture, sdk, { adapter, buttonRef }) {
  function ObserveProfileAndInteraction() {
    const profile = sdk.useChatGPTProfile();
    const interaction = sdk.useChatGPTSignInState();
    return React.createElement(
      'output',
      { 'data-observed-session': '' },
      `${interaction.status}:${profile?.subject ?? 'none'}`,
    );
  }
  return React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      Provider,
      { options: { adapter }, stylesheet: 'external' },
      React.createElement(Button, { id: 'primary', ref: buttonRef }),
      React.createElement(sdk.ChatGPTSignInButton, { id: 'secondary' }),
      React.createElement(Picture, { alt: 'Account picture' }),
      React.createElement(ObserveProfileAndInteraction),
    ),
  );
}
