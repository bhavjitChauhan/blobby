---
title: new Operator
keywords:
  - memory
  - leak
  - object
  - class
  - constructor
resources:
  - name: KA Hearth Post
    url: https://ka-hearth.learnerpages.com/posts/fix-for-new-issues
  - name: DeKhan Library
    url: https://www.khanacademy.org/computer-programming/-/5149916573286400
---

In the Processing.js environment, code is transformed such that any object created using the `new` keyword is stored in an array in memory. The garbage collector cannot reclaim the memory, and programs will slow down as the array grows.

This fix for this bug was popularized by [Vexcess](https://www.khanacademy.org/profile/vxs):
```js
var window = (function() { return this; })();
window.Processing.instances[0].PJSCodeInjector.applyInstance = function(constructor) {
   return function () {
      return window.Reflect.construct(constructor, arguments);
   };
};
```
