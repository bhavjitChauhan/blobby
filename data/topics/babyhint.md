---
title: BabyHint
keywords:
  - babyhint
  - error
resources:
  - name: Live Editor Wiki
    url: https://github.com/Khan/live-editor/wiki/How-the-live-editor-works#babyhint
  - name: Ben Burrill's program
    url: https://www.khanacademy.org/computer-programming/-/6623480075124736
  - name: Source code
    url: https://github.com/Khan/live-editor/blob/master/js/output/pjs/babyhint.js
---

[BabyHint](https://github.com/Khan/live-editor/blob/master/js/output/pjs/babyhint.js) is a project made by Khan Academy to give more friendly error messages. It does all sorts of things, like giving [code suggestions](https://github.com/Khan/live-editor/blob/fb69175850f3e27b4bc9303b37c4f889a7b50c74/js/output/pjs/babyhint.js#L121), enforcing [function parameter counts](https://github.com/Khan/live-editor/blob/fb69175850f3e27b4bc9303b37c4f889a7b50c74/js/output/pjs/babyhint.js#L73) and banning [certain properties](https://github.com/Khan/live-editor/blob/fb69175850f3e27b4bc9303b37c4f889a7b50c74/js/output/pjs/babyhint.js#L138).

It works entirely using regular expressions, so it's not perfect. If you want to disable it, you can add a hacky `void(/\/*/);` line after all multiline comments in your program. (The rest of the code will be interpreted as a multiline comment by BabyHint, and so will be ignored).
