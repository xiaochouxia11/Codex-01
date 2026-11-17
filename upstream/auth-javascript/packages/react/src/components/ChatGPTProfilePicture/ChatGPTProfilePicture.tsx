import { useCallback, useContext, useState, type ReactElement } from 'react';
import { supportsReact19 } from '../../utils/supportsReact19.js';
import ProviderContext from '../ChatGPTAuthProvider/context.cjs';
import { useChatGPTProfile } from '../../hooks/useChatGPTProfile.js';
import type { ChatGPTAuthProfilePictureProps } from './ChatGPTProfilePicture.types.js';
import { profilePictureStyleHref, profilePictureStyles } from './ChatGPTProfilePicture.styles.js';

function EmptyProfilePicture(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 24v-3a8 8 0 0 1 16 0v3Z" />
    </svg>
  );
}

function ProfilePicture({
  picture,
  size,
  defaultSize,
  alt = '',
  className,
  style,
  fallback = <EmptyProfilePicture />,
}: ChatGPTAuthProfilePictureProps & {
  readonly picture: string | undefined;
  readonly size: number;
  readonly defaultSize: boolean;
}): ReactElement {
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const loaded = picture !== undefined && imageStatus === 'loaded';
  const imageRef = useCallback((element: HTMLImageElement | null) => {
    // A cached image can finish before its load event reaches React.
    if (element?.complete && element.naturalWidth > 0) {
      setImageStatus('loaded');
    }
  }, []);

  return (
    <span
      data-chatgpt-profile-picture=""
      data-chatgpt-profile-picture-default-size={defaultSize ? '' : undefined}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={className}
      style={style}
    >
      <svg
        data-chatgpt-profile-picture-sizer=""
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      />
      {!loaded && (
        <span data-chatgpt-profile-picture-fallback="" aria-hidden="true">
          {fallback}
        </span>
      )}
      {picture && imageStatus !== 'error' && (
        <img
          src={picture}
          referrerPolicy="no-referrer"
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          hidden={!loaded}
          draggable={false}
          ref={imageRef}
          onLoad={() => setImageStatus('loaded')}
          onError={() => setImageStatus('error')}
        />
      )}
    </span>
  );
}

/** Displays the consented picture from the adapter's current session, or a neutral fallback. */
export function ChatGPTProfilePicture(props: ChatGPTAuthProfilePictureProps): ReactElement {
  const profile = useChatGPTProfile();
  const context = useContext(ProviderContext);
  const explicitSize =
    typeof props.size === 'number' && Number.isFinite(props.size) && props.size > 0
      ? props.size
      : undefined;
  const picture = profile?.picture;

  return (
    <>
      {context?.stylesheet === 'auto' &&
        (supportsReact19 ? (
          <style href={profilePictureStyleHref} precedence="openai-auth">
            {profilePictureStyles}
          </style>
        ) : (
          <style
            data-chatgpt-style={profilePictureStyleHref}
            dangerouslySetInnerHTML={{ __html: profilePictureStyles }}
          />
        ))}
      <ProfilePicture
        key={JSON.stringify([profile?.subject, picture])}
        {...props}
        size={explicitSize ?? 20}
        defaultSize={explicitSize === undefined}
        picture={picture}
      />
    </>
  );
}
