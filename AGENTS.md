# Project Instructions

- When showing local images in Markdown, always use absolute paths with forward slashes. Windows backslashes can be treated as escape characters by the renderer and may break image links.
- Use this style:

  ```md
  ![图片](D:/Project/image.png)
  ```

- Do not use backslashes in Markdown image links:

  ```md
  ![图片](D:\Project\image.png)
  ```

- Prefer absolute paths over relative paths for local images in Markdown:

  ```md
  ![图片](C:/Users/youdo/Documents/.../image.png)
  ```

- When creating a new project, prefer `pnpm` over `npm`.
- When using Playwright for testing in this project, only test the landscape desktop version. Vertical/mobile portrait testing is not required.
- The local environment cannot send email verification codes. When starting the app for testing, start the API service at the same time so login and related flows can be tested correctly.
