---
title: ES6+
keywords:
  - ES6
  - ES6+
  - ESNext
---

Khan Academy's PJS environment only supports [ES5](https://www.w3schools.com/js/js_es5.asp) (released in 2009 and updated in 2011) by default, meaning features like [JS classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [Arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions), and [`async/await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) are not supported. There have been many attempted workarounds, the [most comprehensive of which](https://www.khanacademy.org/computer-programming/-/4972461264257024) was made by Aliquis.

In the HTML environment, it's as easy as adding the attribute `type` to your `<script>` tags. Any of the following will work:

```html
<script type>
<script type="application/javascript">
<script type="module">
```

Note that for the first two variants, you'll have to wrap any code using `let` and `const` inside a block scope, preferably an IIFE
```js
(function () {
    // Code goes here
})();

/* Now that we can use ES6+ arrow functions, why not? */
(() => {
    // Code goes here
})();
```