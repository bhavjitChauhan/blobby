export function clamp(n: number, min: number, max: number) {
  return Math.max(Math.min(n, max), min)
}

/**
 * Checks if the difference of two numbers is within a outer and (optional) inner range
 *
 * @example
 * within(0, 2, 10) // true
 * within(0, 2, 1) // true
 * within(0, 2, 10, 5) // false
 */
export function within(a: number, b: number, max: number, min: number | undefined = undefined) {
  if (typeof min === 'undefined') return Math.abs(a - b) <= max
  return Math.abs(a - b) <= max && Math.abs(a - b) >= min
}

/**
 * Truncates a string to a maximum length and inserts a postfix if the string is truncated
 *
 * @example
 * truncate('Hello World', 5) // 'He...'
 */
export function truncate(str: string, length: number, postfix = '...') {
  length = Math.max(0, length)
  return str.length > length ? str.slice(0, length - postfix.length) + postfix : str
}

/**
 * Pluralizes a word if the count is not 1
 *
 * @example
 * pluralize(1, 'cat') // 'cat'
 * pluralize(2, 'cat') // 'cats'
 * pluralize(2, 'wolf', 'wolves') // 'wolves'
 */
export function pluralize(word: string, count: number, plural = `${word}s`) {
  return count === 1 ? word : plural
}

/**
 * Picks a random item from an array
 *
 * @param array The array to pick a random item from
 * @example
 * const randomEntry = pickRandom([1, 2, 3, 4]) // 1
 */
export function pickRandom<T>(array: readonly T[]): T {
  const { length } = array
  return array[Math.floor(Math.random() * length)]
}

/**
 * Unescape an escaped HTML string.
 *
 * @link https://github.com/bhavjitChauhan/Essentials/blob/4b784f6c1a1b9f082440f5597647872296504f5f/src/external/unescapeHTML.js#L17
 */
export function unescapeHTML(str: string) {
  return str.replace(
    /&amp;|&lt;|&gt;|&#39;|&quot;/g,
    (tag) =>
      ({
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&#39;': "'",
        '&quot;': '"',
      }[tag] || tag)
  )
}

/**
 * Parses a nested key delimited by periods
 *
 * @example
 * const obj = { a: { b: { c: 1 } } }
 * parseKeyPath(obj, 'a.b.c') // 1
 *
 * @todo
 * Make this type-safe
 */
export function parseKeyPath(obj: Record<string | number | symbol, unknown>, nestedKey: string) {
  const keys = nestedKey.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = obj
  for (const key of keys) value = value[key]
  return value
}

/**
 * Sorts an array of objects by properties
 *
 * @param arr The array of objects to rank
 * @param keys The keys to rank by, prefixed with a + or - to indicate ascending or descending order
 * @returns
 */
export function rank(arr: Record<string, number>[], ...keys: `${'+' | '-'}${string}`[]) {
  return arr.sort((a, b) => {
    for (const key of keys) {
      let aVal, bVal
      if (key.includes('.')) {
        aVal = parseKeyPath(a, key.slice(1))
        bVal = parseKeyPath(b, key.slice(1))
      } else {
        aVal = a[key.slice(1)]
        bVal = b[key.slice(1)]
      }
      if (key.startsWith('+')) {
        if (aVal > bVal) return 1
        if (aVal < bVal) return -1
      } else {
        if (aVal > bVal) return -1
        if (aVal < bVal) return 1
      }
    }
    return 0
  })
}

/**
 * Serializes an object to a string with keys omitted
 *
 * @see {@link deserialize}
 *
 * @example
 * const obj = { a: 1, b: 2, c: 3 }
 * serialize(obj, Object.keys(obj)) // '1,2,3'
 */
export function serialize(obj: Record<string, boolean | number | string | null>, keys: Array<string>) {
  const arr = []
  for (const key of keys) if (key in obj) arr.push(obj[key])
  const str = JSON.stringify(arr)
  return str.substring(1, str.length - 1)
}

/**
 * Deserializes an object from a string given keys
 *
 * @see {@link serialize}
 *
 * @example
 * const keys = ['a', 'b', 'c'], serialized = '1,2,3'
 * deserialize(serialized, keys) // { a: 1, b: 2, c: 3 }
 */
export function deserialize(str: string, keys: Array<string>) {
  const arr = JSON.parse(`[${str}]`)
  const obj: Record<string, boolean | number | string | null> = {}
  for (const [i, key] of keys.entries()) obj[key] = arr[i]
  return obj
}
