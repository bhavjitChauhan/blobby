---
title: new
keywords:
  - memory
  - leak
  - object
---

In the PJS environment, code is transformed such that any object created in a typical fashion (using the `new` keyword or literal syntax) is stored in an array in memory, allowing the memory usage of programs to balloon in size if objects are dereferenced willy-nilly. The garbage collector cannot reclaim the memory, and programs will slow down as the array grows.

Throughout KA's history, there have arisen several ways to deal with the problem. Aside from creating and using complex object pools that shift the burden onto the programmer, the following are methods of restoring "expected" behavior back to `new`

1. Using Object.create (Commonly attributed to ([Bob Lyon](https://www.khanacademy.org/profile/kaid_1116520053705160540512971/projects) and [KWC](https://www.khanacademy.org/profile/kaid_1116520053705160540512971/projects))?)
    ```js
    (function NewFix () {

        // The original doc comment by KWC
        /**
         * This function constructs an
         * instance of its binding.
         *
         * @created_by MKaelin368 (KWC) (c) 2017
         */

        // The original doc comment by Bob Lyon
        /*
         * Give every object a "new" method that works around
         * the Khan Academy leak.
         */

        this.Function.prototype.new = function () {
            var obj = Object.create(this.prototype);
            this.apply(obj, arguments);
            return obj;
        }
    })();

    /* Requires different syntax to work */
    function Foo () {
        this.a = 1;
    }

    // Foo.new is Function#new.
    var bar = Foo.new();
    ```

2. Using reflection (Commonly attributed to Vexcess (profile not available))
    ```js
    (function NewFix () {
        var Reflect = this.Reflect;

        this.Processing.instances[0].PJSCodeInjector.applyInstance = function (constructor) {
            return function () {
                return Reflect.construct(constructor, arguments);
            };
        };
    })();

    /* Does not require different syntax */
    function Foo () {
        this.a = 1;
    }

    var bar = new Foo();
    ```