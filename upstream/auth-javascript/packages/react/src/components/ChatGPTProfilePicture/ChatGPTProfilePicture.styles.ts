export const profilePictureStyleHref = 'openai-auth-profile-picture-v4';
export const profilePictureStyles = `@layer openai-auth {
  :where([data-chatgpt-profile-picture]) {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: var(--chatgpt-profile-picture-size, max-content);
    height: var(--chatgpt-profile-picture-size, auto);
    flex-shrink: 0;
    vertical-align: middle;
    overflow: hidden;
    border-radius: 50%;
    background: #eeeeee;
    color: #666666;
  }

  :where([data-chatgpt-profile-picture-default-size]) {
    width: var(--chatgpt-profile-picture-size, var(--chatgpt-button-side-size, 20px));
    height: var(--chatgpt-profile-picture-size, var(--chatgpt-button-side-size, 20px));
  }

  :where([data-chatgpt-profile-picture-sizer]) {
    display: block;
    flex-shrink: 0;
    visibility: hidden;
  }

  :where([data-chatgpt-profile-picture] > img) {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  :where([data-chatgpt-profile-picture] > img[hidden]) {
    display: none;
  }

  :where([data-chatgpt-profile-picture-fallback]) {
    position: absolute;
    inset: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  :where([data-chatgpt-profile-picture-fallback] > svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
}`;
