---
title: Keyboard Inputs
keywords:
  - keyboard
  - handler
  - inputs
  - controls
  - interactivity
  - keyCode
  - key
---

The preferred method of detecting keypresses in the PJS environment is to make
use of `keyCode`, `key`, `keyPressed`, and `keyReleased` rather than `keyIsPressed` and the `draw` function.

The gist is to maintain a mapping of key codes or textual representations to their physically pressed keys.

A typical example:
```js
var inputs = [];

/*
 * There does not exist a PJS keyDown endpoint, else we would be using that.
 * This "wastefully" (necessarily) sets each pressed key as true in the mapping.
 */
keyPressed = function () {
    inputs[keyCode] = inputs[key] = true;
};

keyReleased = function () {
    inputs[keyCode] = inputs[key] = false;
};

/* Poll for currently held keys to determine proper responses */
draw = function () {
    if (inputs['a']) {
        // e.g. move left
    }

    if (inputs[83]) { // equivalent to 's'
        // e.g. move down
    }

    // etc
};
```

Many users only set `inputs[keyCode]` to true, meaning they have to make use of numerical keycodes to determine input (83 in the above example). Some users (most notably [Bob Lyon](https://www.khanacademy.org/profile/kaid_1116520053705160540512971/projects)) argue for using `key` by default and falling back to keyCode as necessary. The above implementation allows both.