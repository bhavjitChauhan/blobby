---
title: Loop Protector
keywords:
  - loop
  - protector
  - timeout
  - infinite
resources:
  - name: DeKhan Library
    url: https://www.khanacademy.org/computer-programming/-/5149916573286400
---

Khan Academy "injects" a loop protector into your code that will stop the program if loop takes too long to run. This is
to prevent infinite loops from running forever and crashing the browser.

Sometimes this can get in the way, so if you know what you're doing you can disable it like this:
```js
var window = (function() { return this; })();
if (window.LoopProtector.prototype.leave) {
    window.LoopProtector.prototype.leave = null;
    Program.restart();
    throw null;
}
```
